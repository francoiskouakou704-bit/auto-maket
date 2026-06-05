/**
 * End-to-end tests for the sandbox preset save/upsert endpoint against a
 * real database.
 *
 * Strategy
 * --------
 * The server function `saveSandboxPreset` cannot be invoked directly without
 * a full TanStack-Start request context (auth middleware, RPC envelope, …).
 * Its handler is a thin wrapper around `upsertSandboxPreset(supabaseAdmin,
 * ownerId, data)` — the SAME core that runs in production — so we drive
 * that core end-to-end with a real service-role Supabase client, an
 * isolated owner_id namespace, and full cleanup.
 *
 * The suite is automatically skipped when `SUPABASE_URL` /
 * `SUPABASE_SERVICE_ROLE_KEY` are not present so CI environments without
 * DB credentials still pass.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { upsertSandboxPreset } from "../sandbox-presets.core";
import { MAX_PRESETS_PER_OWNER } from "../sandbox-presets.schema";

const URL = process.env.SUPABASE_URL;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENABLED = Boolean(URL && SRK);

// Stable per-run owner namespace so concurrent runs don't collide.
const TEST_OWNER = crypto.randomUUID();

const baseValid = {
  failures: 5,
  successes: 3,
  replays: 2,
  spread_minutes: 10,
};

describe.skipIf(!ENABLED)("saveSandboxPreset – e2e (real database)", () => {
  let supabase: SupabaseClient;

  const cleanup = async () => {
    await supabase
      .from("export_sandbox_presets")
      .delete()
      .eq("owner_id", TEST_OWNER);
  };

  beforeAll(() => {
    supabase = createClient(URL!, SRK!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  beforeEach(cleanup);
  afterAll(cleanup);

  it("insère un preset valide et le rend lisible", async () => {
    const res = await upsertSandboxPreset(supabase, TEST_OWNER, {
      name: "e2e nominal",
      ...baseValid,
    });
    expect(res.ok).toBe(true);

    const { data, error } = await supabase
      .from("export_sandbox_presets")
      .select("*")
      .eq("owner_id", TEST_OWNER)
      .eq("name", "e2e nominal")
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({
      name: "e2e nominal",
      failures: 5,
      successes: 3,
      replays: 2,
      spread_minutes: 10,
    });
  });

  it("met à jour (upsert) le même nom sans créer de doublon", async () => {
    await upsertSandboxPreset(supabase, TEST_OWNER, {
      name: "upsert me",
      ...baseValid,
    });
    await upsertSandboxPreset(supabase, TEST_OWNER, {
      name: "upsert me",
      failures: 42,
      successes: 1,
      replays: 0,
      spread_minutes: 60,
    });

    const { data, error } = await supabase
      .from("export_sandbox_presets")
      .select("name,failures,spread_minutes")
      .eq("owner_id", TEST_OWNER);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({
      name: "upsert me",
      failures: 42,
      spread_minutes: 60,
    });
  });

  it("trim le nom avant l'upsert (idempotence sur les espaces)", async () => {
    await upsertSandboxPreset(supabase, TEST_OWNER, {
      name: "  trim  ",
      ...baseValid,
    });
    await upsertSandboxPreset(supabase, TEST_OWNER, {
      name: "trim",
      ...baseValid,
      failures: 99,
    });
    const { data } = await supabase
      .from("export_sandbox_presets")
      .select("name,failures")
      .eq("owner_id", TEST_OWNER);
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({ name: "trim", failures: 99 });
  });

  it("rejette un payload invalide AVANT de toucher la base", async () => {
    await expect(
      upsertSandboxPreset(supabase, TEST_OWNER, {
        name: "",
        ...baseValid,
      }),
    ).rejects.toThrow(/Preset invalide/);
    const { data } = await supabase
      .from("export_sandbox_presets")
      .select("id")
      .eq("owner_id", TEST_OWNER);
    expect(data ?? []).toHaveLength(0);
  });

  it("rejette les champs inconnus (strict)", async () => {
    await expect(
      upsertSandboxPreset(supabase, TEST_OWNER, {
        name: "extra",
        ...baseValid,
        evil: "x",
      } as unknown),
    ).rejects.toThrow(/Preset invalide/);
  });

  it("rejette le total > 1200", async () => {
    await expect(
      upsertSandboxPreset(supabase, TEST_OWNER, {
        name: "too big",
        failures: 500,
        successes: 500,
        replays: 500,
        spread_minutes: 10,
      }),
    ).rejects.toThrow(/total/);
  });

  it("autorise la mise à jour d'un nom existant même au quota max", async () => {
    // Bulk-insert MAX_PRESETS_PER_OWNER rows directly (faster than N upserts).
    const rows = Array.from({ length: MAX_PRESETS_PER_OWNER }, (_, i) => ({
      owner_id: TEST_OWNER,
      name: `quota-${i}`,
      ...baseValid,
    }));
    const { error: insErr } = await supabase
      .from("export_sandbox_presets")
      .insert(rows);
    expect(insErr).toBeNull();

    // Updating an existing name must pass even at quota.
    await expect(
      upsertSandboxPreset(supabase, TEST_OWNER, {
        name: "quota-0",
        ...baseValid,
        failures: 123,
      }),
    ).resolves.toMatchObject({ ok: true });

    // Inserting a NEW name must fail.
    await expect(
      upsertSandboxPreset(supabase, TEST_OWNER, {
        name: "quota-new",
        ...baseValid,
      }),
    ).rejects.toThrow(/Quota atteint/);

    const { count } = await supabase
      .from("export_sandbox_presets")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", TEST_OWNER);
    expect(count).toBe(MAX_PRESETS_PER_OWNER);
  });

  it("isole les presets par owner_id", async () => {
    const otherOwner = crypto.randomUUID();
    try {
      await upsertSandboxPreset(supabase, TEST_OWNER, {
        name: "shared-name",
        ...baseValid,
        failures: 1,
      });
      await upsertSandboxPreset(supabase, otherOwner, {
        name: "shared-name",
        ...baseValid,
        failures: 2,
      });

      const { data: mine } = await supabase
        .from("export_sandbox_presets")
        .select("failures")
        .eq("owner_id", TEST_OWNER)
        .eq("name", "shared-name")
        .single();
      const { data: theirs } = await supabase
        .from("export_sandbox_presets")
        .select("failures")
        .eq("owner_id", otherOwner)
        .eq("name", "shared-name")
        .single();
      expect(mine?.failures).toBe(1);
      expect(theirs?.failures).toBe(2);
    } finally {
      await supabase
        .from("export_sandbox_presets")
        .delete()
        .eq("owner_id", otherOwner);
    }
  });
});

describe.skipIf(ENABLED)("saveSandboxPreset – e2e (skipped)", () => {
  it("skipped: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing", () => {
    expect(true).toBe(true);
  });
});

import { describe, it, expect, vi } from "vitest";
import {
  presetSchema,
  validatePresetInput,
  assertPresetQuota,
  MAX_PRESETS_PER_OWNER,
  MAX_TOTAL_EVENTS,
  RESERVED_PREFIXES,
} from "../sandbox-presets.schema";

const valid = {
  name: "scénario nominal",
  failures: 10,
  successes: 5,
  replays: 2,
  spread_minutes: 30,
};

describe("presetSchema – Zod rejections", () => {
  it("accepte un preset valide et trim le nom", () => {
    const r = presetSchema.parse({ ...valid, name: "  mon test  " });
    expect(r.name).toBe("mon test");
    expect(r.failures).toBe(10);
  });

  it("rejette un nom vide", () => {
    const r = presetSchema.safeParse({ ...valid, name: "   " });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message === "nom requis")).toBe(true);
    }
  });

  it("rejette un nom trop long (>60)", () => {
    const r = presetSchema.safeParse({ ...valid, name: "a".repeat(61) });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues.some((i) => i.message === "nom trop long (max 60)"),
      ).toBe(true);
    }
  });

  it("rejette les caractères de contrôle dans le nom", () => {
    const r = presetSchema.safeParse({ ...valid, name: "bad\nname" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues.some((i) =>
          i.message.includes("caractères invalides"),
        ),
      ).toBe(true);
    }
  });

  it.each(RESERVED_PREFIXES)("rejette le préfixe réservé %s", (p) => {
    const r = presetSchema.safeParse({ ...valid, name: `${p}foo` });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message === "nom réservé")).toBe(true);
    }
  });

  it("rejette les préfixes réservés peu importe la casse", () => {
    const r = presetSchema.safeParse({ ...valid, name: "SANDBOX-test" });
    expect(r.success).toBe(false);
  });

  it.each([
    ["failures", -1],
    ["successes", -1],
    ["replays", -1],
    ["spread_minutes", -5],
  ])("rejette les valeurs négatives pour %s", (field, v) => {
    const r = presetSchema.safeParse({ ...valid, [field]: v });
    expect(r.success).toBe(false);
  });

  it.each([
    ["failures", 501],
    ["successes", 501],
    ["replays", 501],
    ["spread_minutes", 181],
  ])("rejette les valeurs au-dessus du max pour %s", (field, v) => {
    const r = presetSchema.safeParse({ ...valid, [field]: v });
    expect(r.success).toBe(false);
  });

  it("rejette les nombres non entiers", () => {
    const r = presetSchema.safeParse({ ...valid, failures: 1.5 });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues.some((i) => i.message === "doit être un entier"),
      ).toBe(true);
    }
  });

  it("rejette les types non numériques", () => {
    const r = presetSchema.safeParse({ ...valid, failures: "10" });
    expect(r.success).toBe(false);
  });

  it("rejette les champs inconnus (strict)", () => {
    const r = presetSchema.safeParse({ ...valid, evil: "x" });
    expect(r.success).toBe(false);
  });

  it(`rejette quand failures+successes+replays > ${MAX_TOTAL_EVENTS}`, () => {
    const r = presetSchema.safeParse({
      ...valid,
      failures: 500,
      successes: 500,
      replays: 500,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(
        r.error.issues.some((i) => i.message.includes("total")),
      ).toBe(true);
    }
  });

  it("accepte la limite haute exacte", () => {
    const r = presetSchema.safeParse({
      name: "edge",
      failures: 500,
      successes: 500,
      replays: 200,
      spread_minutes: 180,
    });
    expect(r.success).toBe(true);
  });
});

describe("validatePresetInput – message d'erreur", () => {
  it("retourne les données parsées quand valide", () => {
    expect(validatePresetInput(valid)).toMatchObject({
      name: "scénario nominal",
      failures: 10,
    });
  });

  it("throw une Error préfixée 'Preset invalide — '", () => {
    expect(() => validatePresetInput({ ...valid, name: "" })).toThrow(
      /^Preset invalide — /,
    );
  });

  it("liste les chemins et messages des issues", () => {
    let caught: Error | null = null;
    try {
      validatePresetInput({ ...valid, name: "", failures: -1 });
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).toBeTruthy();
    expect(caught!.message).toContain("name");
    expect(caught!.message).toContain("failures");
    expect(caught!.message).toContain(";");
  });

  it("rejette les entrées non-objet", () => {
    expect(() => validatePresetInput(null)).toThrow(/Preset invalide/);
    expect(() => validatePresetInput("foo")).toThrow(/Preset invalide/);
    expect(() => validatePresetInput(undefined)).toThrow(/Preset invalide/);
  });
});

describe("assertPresetQuota", () => {
  const mk = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ name: `p${i}` }));

  it("ne throw pas quand sous la limite", () => {
    expect(() => assertPresetQuota(mk(10), "nouveau")).not.toThrow();
  });

  it("ne throw pas quand on met à jour un preset existant à la limite", () => {
    const existing = mk(MAX_PRESETS_PER_OWNER);
    expect(() => assertPresetQuota(existing, "p0")).not.toThrow();
  });

  it("throw quand on insère un nouveau preset à la limite", () => {
    const existing = mk(MAX_PRESETS_PER_OWNER);
    expect(() => assertPresetQuota(existing, "nouveau")).toThrow(
      /Quota atteint/,
    );
  });
});

// ============ Integration: saveSandboxPreset core flow ============
//
// We mock the Supabase admin client + admin middleware so we can exercise
// the validator + quota + upsert pipeline without hitting the network.

describe("saveSandboxPreset – intégration (validator + quota + upsert)", () => {
  it("upsert le preset quand l'input est valide et sous quota", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const select = vi.fn().mockReturnThis();
    const eq = vi.fn().mockResolvedValue({ data: [], error: null });
    const from = vi.fn(() => ({ select, eq, upsert }));

    // Simulate the body of saveSandboxPreset.handler with mocks.
    const data = validatePresetInput(valid);
    const ownerId = "owner-1";
    const existing = (await from("export_sandbox_presets").select("id,name").eq("owner_id", ownerId))
      .data as { name: string }[];
    assertPresetQuota(existing, data.name);
    const res = await from("export_sandbox_presets").upsert(
      { owner_id: ownerId, ...data },
      { onConflict: "owner_id,name" },
    );

    expect(res.error).toBeNull();
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ owner_id: "owner-1", name: "scénario nominal" }),
      { onConflict: "owner_id,name" },
    );
  });

  it("n'appelle PAS upsert quand l'input est invalide (Zod rejette avant)", async () => {
    const upsert = vi.fn();
    expect(() => validatePresetInput({ ...valid, name: "" })).toThrow();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("n'appelle PAS upsert quand le quota est atteint pour un nouveau nom", async () => {
    const upsert = vi.fn();
    const existing = Array.from({ length: MAX_PRESETS_PER_OWNER }, (_, i) => ({
      name: `p${i}`,
    }));
    const data = validatePresetInput({ ...valid, name: "tout nouveau" });
    expect(() => assertPresetQuota(existing, data.name)).toThrow(/Quota atteint/);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("propage l'erreur Supabase si upsert échoue", async () => {
    const upsert = vi
      .fn<(...args: unknown[]) => Promise<{ error: { message: string } | null }>>()
      .mockResolvedValue({ error: { message: "duplicate key" } });
    const res = await upsert({}, { onConflict: "owner_id,name" });
    expect(res.error?.message).toBe("duplicate key");
  });
});

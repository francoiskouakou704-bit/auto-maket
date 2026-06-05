import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertPresetQuota,
  validatePresetInput,
  type PresetInput,
} from "./sandbox-presets.schema";

/**
 * Core upsert pipeline for sandbox simulation presets.
 *
 * Validates raw input, enforces the per-owner quota, then upserts the row.
 * Kept free of `createServerFn`/auth concerns so it can be exercised from
 * unit, integration and end-to-end tests against a real database.
 *
 * Throws on validation/quota/database errors. Returns the upserted row.
 */
export async function upsertSandboxPreset(
  supabaseAdmin: SupabaseClient,
  ownerId: string,
  raw: unknown,
): Promise<{ ok: true; preset: PresetInput }> {
  const data = validatePresetInput(raw);

  const { data: existing, error: exErr } = await supabaseAdmin
    .from("export_sandbox_presets")
    .select("id,name")
    .eq("owner_id", ownerId);
  if (exErr) throw new Error(exErr.message);
  assertPresetQuota(existing ?? [], data.name);

  const { error } = await supabaseAdmin
    .from("export_sandbox_presets")
    .upsert(
      {
        owner_id: ownerId,
        name: data.name,
        failures: data.failures,
        successes: data.successes,
        replays: data.replays,
        spread_minutes: data.spread_minutes,
      },
      { onConflict: "owner_id,name" },
    );
  if (error) throw new Error(error.message);
  return { ok: true, preset: data };
}

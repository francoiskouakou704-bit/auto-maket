import { z } from "zod";

// Strict server-side schema for sandbox simulation presets.
// Kept in its own module so it can be unit-tested without pulling in
// server-only dependencies (Supabase client, auth middleware, …).

const int = (max: number) =>
  z
    .number({ error: (iss) => (iss.input === undefined ? "doit être un entier" : "doit être un entier") })
    .int("doit être un entier")
    .finite()
    .min(0)
    .max(max);

export const RESERVED_PREFIXES = [
  "sandbox-",
  "[sandbox]",
  "system:",
  "__",
];
export const MAX_TOTAL_EVENTS = 1200;
export const MAX_PRESETS_PER_OWNER = 100;

export const presetSchema = z
  .object({
    name: z
      .string()
      .transform((s) => s.trim())
      .pipe(
        z
          .string()
          .min(1, "nom requis")
          .max(60, "nom trop long (max 60)")
          .regex(
            /^[^\u0000-\u001F\u007F]+$/,
            "nom contient des caractères invalides",
          )
          .refine(
            (v) =>
              !RESERVED_PREFIXES.some((p) =>
                v.toLowerCase().startsWith(p),
              ),
            "nom réservé",
          ),
      ),
    failures: int(500),
    successes: int(500),
    replays: int(500),
    spread_minutes: int(180),
  })
  .strict()
  .refine(
    (v) => v.failures + v.successes + v.replays <= MAX_TOTAL_EVENTS,
    `total (failures + successes + replays) doit être ≤ ${MAX_TOTAL_EVENTS}`,
  );

export type PresetInput = z.infer<typeof presetSchema>;

/**
 * Validate raw preset input. Throws an `Error` whose message starts with
 * `"Preset invalide — "` and lists each Zod issue (path: message; …).
 * Used as the `inputValidator` of the `saveSandboxPreset` server function.
 */
export function validatePresetInput(d: unknown): PresetInput {
  const parsed = presetSchema.safeParse(d);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.join(".") || "preset"}: ${i.message}`)
      .join("; ");
    throw new Error(`Preset invalide — ${msg}`);
  }
  return parsed.data;
}

/**
 * Quota check used before upserting a preset. Throws when the owner already
 * owns `MAX_PRESETS_PER_OWNER` presets AND the incoming name is new.
 */
export function assertPresetQuota(
  existing: { name: string }[],
  incomingName: string,
): void {
  const isNew = !existing.some((p) => p.name === incomingName);
  if (isNew && existing.length >= MAX_PRESETS_PER_OWNER) {
    throw new Error(
      `Quota atteint: max ${MAX_PRESETS_PER_OWNER} presets par admin`,
    );
  }
}

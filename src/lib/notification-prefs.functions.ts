import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SeverityEnum = z.enum(["info", "warning", "critical"]);

const PrefsInput = z.object({
  email_enabled: z.boolean(),
  slack_enabled: z.boolean(),
  severities: z.array(SeverityEnum).min(0).max(3),
  notify_on_resolved: z.boolean(),
  email_override: z.string().email().max(320).nullable().optional(),
});

export const getMyNotificationPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("admin_notification_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (
      data ?? {
        user_id: userId,
        email_enabled: true,
        slack_enabled: true,
        severities: ["critical"],
        notify_on_resolved: true,
        email_override: null,
      }
    );
  });

export const updateMyNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PrefsInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row = {
      user_id: userId,
      email_enabled: data.email_enabled,
      slack_enabled: data.slack_enabled,
      severities: data.severities,
      notify_on_resolved: data.notify_on_resolved,
      email_override: data.email_override ?? null,
    };
    const { error } = await supabase
      .from("admin_notification_preferences")
      .upsert(row, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

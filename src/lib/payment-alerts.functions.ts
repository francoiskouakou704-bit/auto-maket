import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  detectInconsistencies,
  recordAlerts,
  type PaymentRow,
} from "./payment-alerts.server";

async function ensureAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

/**
 * Scan every payment, detect inconsistencies, persist new alerts, return summary.
 */
export const scanPaymentAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.userId);

    const { data: payments, error } = await supabaseAdmin
      .from("payments")
      .select("id, provider, provider_ref, status, amount, refunded_amount, currency, reconciled_at");
    if (error) throw new Error(error.message);

    let totalIssues = 0;
    let totalInserted = 0;
    for (const p of payments ?? []) {
      const issues = detectInconsistencies(p as PaymentRow);
      if (issues.length === 0) continue;
      totalIssues += issues.length;
      const res = await recordAlerts(p.id, issues);
      totalInserted += res.inserted;
    }
    return {
      scanned: payments?.length ?? 0,
      issuesFound: totalIssues,
      alertsCreated: totalInserted,
    };
  });

/**
 * Acknowledge or resolve an alert.
 */
export const updateAlertStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        alertId: z.string().uuid(),
        status: z.enum(["acknowledged", "resolved", "open"]),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("payment_alerts")
      .update({
        status: data.status,
        acknowledged_by: data.status === "open" ? null : context.userId,
        acknowledged_at: data.status === "open" ? null : new Date().toISOString(),
      })
      .eq("id", data.alertId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

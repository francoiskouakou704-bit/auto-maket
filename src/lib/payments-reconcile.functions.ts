import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { checkAndAlert, type PaymentRow } from "./payment-alerts.server";

async function runAlertCheck(paymentId: string) {
  const { data } = await supabaseAdmin
    .from("payments")
    .select("id, provider, provider_ref, status, amount, refunded_amount, currency, reconciled_at")
    .eq("id", paymentId)
    .single();
  if (data) await checkAndAlert(data as PaymentRow);
}

/**
 * Admin reconciliation: re-applies the latest stored webhook event for a given
 * payment row, useful when an event was received but reconciliation failed.
 */
export const reconcilePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ paymentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    // Verify admin
    const { data: role } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("Forbidden");

    const { data: payment, error: pErr } = await supabaseAdmin
      .from("payments")
      .select("*")
      .eq("id", data.paymentId)
      .single();
    if (pErr || !payment) throw new Error("Payment not found");

    const { data: lastEvent } = await supabaseAdmin
      .from("payment_events")
      .select("*")
      .eq("payment_id", data.paymentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastEvent) {
      // Nothing to reconcile against — just stamp it
      const { error } = await supabaseAdmin
        .from("payments")
        .update({ reconciled_at: new Date().toISOString() })
        .eq("id", data.paymentId);
      if (error) throw new Error(error.message);
      return { ok: true, message: "Aucun événement, paiement marqué réconcilié." };
    }

    const payload = lastEvent.payload as { status?: string } | null;
    const allowed = ["pending", "succeeded", "failed", "refunded"] as const;
    const rawStatus = payload?.status;
    const status = (allowed as readonly string[]).includes(rawStatus ?? "")
      ? (rawStatus as (typeof allowed)[number])
      : (payment.status as (typeof allowed)[number]);

    const { error } = await supabaseAdmin
      .from("payments")
      .update({
        status,
        reconciled_at: new Date().toISOString(),
        raw_event: lastEvent.payload,
      })
      .eq("id", data.paymentId);
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("payment_events")
      .update({ processed: true, error: null })
      .eq("id", lastEvent.id);

    return { ok: true, message: "Paiement réconcilié." };
  });

/**
 * Admin refund: marks a payment refunded (full or partial). Does NOT call the
 * payment provider's API — that is provider-specific and should be triggered
 * from Stripe Dashboard or the Mobile Money operator's portal; the resulting
 * webhook will land here automatically. Use this when you need to record a
 * refund manually after an out-of-band action.
 */
export const refundPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        paymentId: z.string().uuid(),
        amount: z.number().positive().optional(), // omit = full refund
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const { data: role } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("Forbidden");

    const { data: payment, error: pErr } = await supabaseAdmin
      .from("payments")
      .select("amount, refunded_amount, status")
      .eq("id", data.paymentId)
      .single();
    if (pErr || !payment) throw new Error("Payment not found");

    const refundAmount = data.amount ?? Number(payment.amount);
    const totalRefunded = Number(payment.refunded_amount ?? 0) + refundAmount;
    if (totalRefunded > Number(payment.amount)) {
      throw new Error("Montant du remboursement supérieur au paiement initial");
    }

    const { error } = await supabaseAdmin
      .from("payments")
      .update({
        refunded_amount: totalRefunded,
        status: totalRefunded >= Number(payment.amount) ? "refunded" : payment.status,
        reconciled_at: new Date().toISOString(),
      })
      .eq("id", data.paymentId);
    if (error) throw new Error(error.message);

    return { ok: true, refundedAmount: totalRefunded };
  });

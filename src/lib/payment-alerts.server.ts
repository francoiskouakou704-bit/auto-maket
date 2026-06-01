import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PaymentRow = {
  id: string;
  provider: string | null;
  provider_ref: string | null;
  status: "pending" | "succeeded" | "failed" | "refunded";
  amount: number | string;
  refunded_amount: number | string | null;
  currency: string;
  reconciled_at: string | null;
};

export type Inconsistency = {
  type:
    | "missing_provider"
    | "missing_provider_ref"
    | "refund_without_amount"
    | "refunded_status_without_refund"
    | "overrefund"
    | "succeeded_but_no_reconciliation"
    | "amount_mismatch";
  severity: "info" | "warning" | "critical";
  message: string;
  details?: Record<string, unknown>;
};

/**
 * Detect inconsistencies on a payment row. Pure function — returns the list
 * of issues without touching the DB.
 */
export function detectInconsistencies(p: PaymentRow): Inconsistency[] {
  const issues: Inconsistency[] = [];
  const amount = Number(p.amount);
  const refunded = Number(p.refunded_amount ?? 0);

  if ((p.status === "succeeded" || p.status === "refunded") && !p.provider) {
    issues.push({
      type: "missing_provider",
      severity: "critical",
      message: `Paiement ${p.status} sans provider renseigné`,
    });
  }
  if ((p.status === "succeeded" || p.status === "refunded") && !p.provider_ref) {
    issues.push({
      type: "missing_provider_ref",
      severity: "critical",
      message: `Paiement ${p.status} sans provider_ref (référence externe)`,
    });
  }
  if (p.status === "refunded" && refunded <= 0) {
    issues.push({
      type: "refunded_status_without_refund",
      severity: "warning",
      message: "Statut 'refunded' mais aucun montant remboursé enregistré",
    });
  }
  if (refunded > 0 && p.status !== "refunded") {
    issues.push({
      type: "refund_without_amount",
      severity: "warning",
      message: `Montant remboursé (${refunded}) mais statut '${p.status}'`,
    });
  }
  if (refunded > amount + 0.0001) {
    issues.push({
      type: "overrefund",
      severity: "critical",
      message: `Remboursement (${refunded}) supérieur au montant payé (${amount})`,
      details: { amount, refunded },
    });
  }
  if (p.status === "succeeded" && !p.reconciled_at && p.provider_ref) {
    issues.push({
      type: "succeeded_but_no_reconciliation",
      severity: "info",
      message: "Paiement 'succeeded' jamais réconcilié via webhook",
    });
  }
  return issues;
}

/**
 * Persist inconsistencies as payment_alerts rows (one per type, deduplicated
 * by open alerts of the same type for the same payment) and log them.
 */
export async function recordAlerts(paymentId: string, issues: Inconsistency[]) {
  if (issues.length === 0) return { inserted: 0 };

  // Fetch open alerts to avoid duplicates
  const { data: existing } = await supabaseAdmin
    .from("payment_alerts")
    .select("alert_type")
    .eq("payment_id", paymentId)
    .eq("status", "open");
  const openTypes = new Set((existing ?? []).map((a) => a.alert_type));

  const toInsert = issues
    .filter((i) => !openTypes.has(i.type))
    .map((i) => ({
      payment_id: paymentId,
      alert_type: i.type,
      severity: i.severity,
      message: i.message,
      details: (i.details ?? null) as never,
      status: "open",
    }));

  if (toInsert.length === 0) return { inserted: 0 };

  // Log to server logs so they show up in observability
  for (const i of issues) {
    const label = `[payment-alert][${i.severity}] ${paymentId} ${i.type} :: ${i.message}`;
    if (i.severity === "critical") console.error(label, i.details ?? "");
    else if (i.severity === "warning") console.warn(label, i.details ?? "");
    else console.info(label, i.details ?? "");
  }

  const { error } = await supabaseAdmin.from("payment_alerts").insert(toInsert);
  if (error) {
    console.error("[payment-alert] failed to insert alerts", error);
    return { inserted: 0, error: error.message };
  }
  return { inserted: toInsert.length };
}

/**
 * Convenience: detect + record in one call.
 */
export async function checkAndAlert(payment: PaymentRow) {
  const issues = detectInconsistencies(payment);
  if (issues.length === 0) return { issues: [], inserted: 0 };
  const res = await recordAlerts(payment.id, issues);
  return { issues, ...res };
}

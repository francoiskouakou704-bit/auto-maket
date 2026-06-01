import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function ensureAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}

const FilterSchema = z.object({
  status: z.enum(["open", "acknowledged", "resolved", "all"]).default("open"),
  severity: z.enum(["info", "warning", "critical", "all"]).default("all"),
  assignment: z.enum(["any", "mine", "unassigned"]).default("any"),
  search: z.string().max(200).optional(),
  limit: z.number().int().min(1).max(500).default(100),
});

export const listAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => FilterSchema.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);

    let query = supabaseAdmin
      .from("payment_alerts")
      .select(
        "id, payment_id, alert_type, severity, message, details, status, assigned_to, assigned_at, acknowledged_by, acknowledged_at, resolution_comment, proof_refund_ref, proof_screenshot_url, proof_payload, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.status !== "all") query = query.eq("status", data.status);
    if (data.severity !== "all") query = query.eq("severity", data.severity);
    if (data.assignment === "mine") query = query.eq("assigned_to", context.userId);
    if (data.assignment === "unassigned") query = query.is("assigned_to", null);
    if (data.search && data.search.trim()) {
      const s = data.search.trim();
      query = query.or(`message.ilike.%${s}%,alert_type.ilike.%${s}%,payment_id.eq.${s}`);
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    // Fetch related payment info
    const paymentIds = Array.from(new Set((rows ?? []).map((r) => r.payment_id).filter(Boolean) as string[]));
    let payments: Record<string, { provider: string | null; provider_ref: string | null; status: string; amount: number | string; refunded_amount: number | string | null; currency: string }> = {};
    if (paymentIds.length > 0) {
      const { data: pays } = await supabaseAdmin
        .from("payments")
        .select("id, provider, provider_ref, status, amount, refunded_amount, currency")
        .in("id", paymentIds);
      payments = Object.fromEntries((pays ?? []).map((p) => [p.id, p]));
    }

    return { alerts: rows ?? [], payments };
  });

export const assignAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        alertId: z.string().uuid(),
        assignTo: z.union([z.string().uuid(), z.literal("self"), z.null()]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);
    const assignee = data.assignTo === "self" ? context.userId : data.assignTo;
    const { error } = await supabaseAdmin
      .from("payment_alerts")
      .update({
        assigned_to: assignee,
        assigned_at: assignee ? new Date().toISOString() : null,
        status: assignee ? "acknowledged" : "open",
      })
      .eq("id", data.alertId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resolveAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        alertId: z.string().uuid(),
        comment: z.string().trim().min(3, "Le commentaire est requis").max(2000),
        refundRef: z.string().trim().max(255).optional(),
        screenshotUrl: z.string().trim().max(1000).optional(),
        providerPayload: z.string().trim().max(20000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await ensureAdmin(context.userId);

    let parsedPayload: unknown = null;
    if (data.providerPayload) {
      try {
        parsedPayload = JSON.parse(data.providerPayload);
      } catch {
        parsedPayload = { raw: data.providerPayload };
      }
    }

    const { error } = await supabaseAdmin
      .from("payment_alerts")
      .update({
        status: "resolved",
        acknowledged_by: context.userId,
        acknowledged_at: new Date().toISOString(),
        resolution_comment: data.comment,
        proof_refund_ref: data.refundRef || null,
        proof_screenshot_url: data.screenshotUrl || null,
        proof_payload: (parsedPayload as never) ?? null,
      })
      .eq("id", data.alertId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context.userId);
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const ids = (roles ?? []).map((r) => r.user_id);
    if (ids.length === 0) return { admins: [] as { id: string; full_name: string | null }[] };
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .in("id", ids);
    return { admins: profiles ?? [] };
  });

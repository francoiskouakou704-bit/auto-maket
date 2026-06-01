import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Unified payments webhook for Stripe and Mobile Money providers.
 *
 * URL: /api/public/payments/webhook?provider=stripe
 *      /api/public/payments/webhook?provider=mobile_money
 *
 * Features:
 *  - Signature verification (HMAC-SHA256)
 *  - Idempotency: every event_id is stored once in `payment_events`
 *  - Duplicate control: unique (provider, provider_ref) on `payments`
 *  - Final status mapping (succeeded / failed / refunded)
 *  - Partial & full refunds tracked via `refunded_amount`
 */

type ProviderName = "stripe" | "mobile_money";

type NormalizedEvent = {
  eventId: string;
  eventType: string;
  providerRef: string; // payment intent / transaction id
  amount: number | null;
  currency: string | null;
  status: "pending" | "succeeded" | "failed" | "refunded" | null;
  refundedAmount: number | null;
  userId: string | null;
  vehicleId: string | null;
  kind: string | null;
};

function verifyStripeSignature(secret: string, payload: string, header: string | null): boolean {
  if (!header) return false;
  // header format: t=timestamp,v1=signature[,v1=...]
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k, v];
    })
  );
  if (!parts.t || !parts.v1) return false;
  const signed = `${parts.t}.${payload}`;
  const expected = createHmac("sha256", secret).update(signed).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(parts.v1, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

function verifyHmacSignature(secret: string, payload: string, header: string | null): boolean {
  if (!header) return false;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(header, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

function normalizeStripe(evt: any): NormalizedEvent | null {
  const obj = evt?.data?.object;
  if (!obj) return null;
  let status: NormalizedEvent["status"] = null;
  let refundedAmount: number | null = null;

  switch (evt.type) {
    case "payment_intent.succeeded":
    case "checkout.session.completed":
      status = "succeeded";
      break;
    case "payment_intent.payment_failed":
    case "checkout.session.async_payment_failed":
      status = "failed";
      break;
    case "charge.refunded":
    case "refund.created":
    case "refund.updated":
      status = "refunded";
      refundedAmount = (obj.amount_refunded ?? obj.amount ?? 0) / 100;
      break;
    default:
      status = null;
  }

  return {
    eventId: evt.id,
    eventType: evt.type,
    providerRef: obj.payment_intent ?? obj.id,
    amount: typeof obj.amount === "number" ? obj.amount / 100 : null,
    currency: obj.currency ? String(obj.currency).toUpperCase() : null,
    status,
    refundedAmount,
    userId: obj.metadata?.user_id ?? null,
    vehicleId: obj.metadata?.vehicle_id ?? null,
    kind: obj.metadata?.kind ?? null,
  };
}

function normalizeMobileMoney(evt: any): NormalizedEvent | null {
  // Generic Mobile Money shape (Orange / MTN / Wave aggregators usually expose
  // a flat payload — adapters can be added per operator if needed).
  if (!evt?.transaction_id && !evt?.id) return null;
  const status = (evt.status ?? "").toLowerCase();
  let mapped: NormalizedEvent["status"] = null;
  if (["successful", "success", "completed", "paid"].includes(status)) mapped = "succeeded";
  else if (["failed", "cancelled", "canceled", "rejected"].includes(status)) mapped = "failed";
  else if (["refunded", "reversed"].includes(status)) mapped = "refunded";
  else if (["pending", "processing"].includes(status)) mapped = "pending";

  return {
    eventId: evt.event_id ?? evt.id ?? evt.transaction_id,
    eventType: evt.event_type ?? `mm.${status || "unknown"}`,
    providerRef: evt.transaction_id ?? evt.id,
    amount: evt.amount != null ? Number(evt.amount) : null,
    currency: evt.currency ?? null,
    status: mapped,
    refundedAmount: mapped === "refunded" ? Number(evt.refunded_amount ?? evt.amount ?? 0) : null,
    userId: evt.metadata?.user_id ?? evt.user_id ?? null,
    vehicleId: evt.metadata?.vehicle_id ?? evt.vehicle_id ?? null,
    kind: evt.metadata?.kind ?? evt.kind ?? null,
  };
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const provider = (url.searchParams.get("provider") ?? "stripe") as ProviderName;
        const rawBody = await request.text();

        // 1) Verify signature
        let verified = false;
        if (provider === "stripe") {
          const secret = process.env.STRIPE_WEBHOOK_SECRET;
          if (!secret) return new Response("Webhook secret not configured", { status: 500 });
          verified = verifyStripeSignature(secret, rawBody, request.headers.get("stripe-signature"));
        } else if (provider === "mobile_money") {
          const secret = process.env.MOBILE_MONEY_WEBHOOK_SECRET;
          if (!secret) return new Response("Webhook secret not configured", { status: 500 });
          verified = verifyHmacSignature(
            secret,
            rawBody,
            request.headers.get("x-webhook-signature") ?? request.headers.get("x-signature")
          );
        } else {
          return new Response("Unknown provider", { status: 400 });
        }

        if (!verified) return new Response("Invalid signature", { status: 401 });

        // 2) Parse + normalize
        let evt: unknown;
        try {
          evt = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const norm =
          provider === "stripe" ? normalizeStripe(evt) : normalizeMobileMoney(evt);
        if (!norm) return new Response("Unrecognized event shape", { status: 400 });

        // 3) Idempotency — insert into payment_events; conflict = already processed
        const { data: eventRow, error: insertEventErr } = await supabaseAdmin
          .from("payment_events")
          .insert({
            provider,
            event_id: norm.eventId,
            event_type: norm.eventType,
            provider_ref: norm.providerRef,
            signature:
              request.headers.get("stripe-signature") ??
              request.headers.get("x-webhook-signature") ??
              null,
            payload: evt as Record<string, unknown>,
            processed: false,
          })
          .select()
          .single();

        if (insertEventErr) {
          // Unique violation = duplicate delivery: acknowledge silently
          if (insertEventErr.code === "23505") {
            return Response.json({ ok: true, duplicate: true });
          }
          console.error("[payments.webhook] event insert error", insertEventErr);
          return new Response("Storage error", { status: 500 });
        }

        // 4) Reconcile against payments table
        try {
          // Look up existing payment by (provider, provider_ref)
          const { data: existing } = await supabaseAdmin
            .from("payments")
            .select("*")
            .eq("provider", provider)
            .eq("provider_ref", norm.providerRef)
            .maybeSingle();

          let paymentId: string | null = existing?.id ?? null;

          if (existing) {
            const patch: Record<string, unknown> = {
              raw_event: evt as Record<string, unknown>,
              reconciled_at: new Date().toISOString(),
            };
            if (norm.status) patch.status = norm.status;
            if (norm.status === "refunded" && norm.refundedAmount != null) {
              patch.refunded_amount = norm.refundedAmount;
            }
            const { error: upErr } = await supabaseAdmin
              .from("payments")
              .update(patch)
              .eq("id", existing.id);
            if (upErr) throw upErr;
          } else if (norm.userId && norm.amount != null && norm.currency) {
            // Late binding: create the payment row if Stripe/MM hits before our app did
            const { data: created, error: createErr } = await supabaseAdmin
              .from("payments")
              .insert({
                user_id: norm.userId,
                vehicle_id: norm.vehicleId,
                kind: (norm.kind as "boost" | "subscription" | "feature") ?? "boost",
                amount: norm.amount,
                currency: norm.currency,
                provider,
                provider_ref: norm.providerRef,
                status: norm.status ?? "pending",
                refunded_amount: norm.refundedAmount ?? 0,
                raw_event: evt as Record<string, unknown>,
                reconciled_at: new Date().toISOString(),
              })
              .select("id")
              .single();
            if (createErr) throw createErr;
            paymentId = created.id;
          }
          // else: no existing row and no user metadata → log only, do not create orphan

          await supabaseAdmin
            .from("payment_events")
            .update({ processed: true, payment_id: paymentId })
            .eq("id", eventRow.id);

          return Response.json({ ok: true, payment_id: paymentId });
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Reconciliation failed";
          console.error("[payments.webhook] reconcile error", err);
          await supabaseAdmin
            .from("payment_events")
            .update({ processed: false, error: message })
            .eq("id", eventRow.id);
          return new Response("Reconciliation error", { status: 500 });
        }
      },

      // Allow simple health probe
      GET: async () => Response.json({ ok: true, service: "payments.webhook" }),
    },
  },
});

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLAN_LIMITS, type Plan } from "./premium";

// Get the current user's plan info + today's usage
export const getMyPlanInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const { data: planData } = await supabaseAdmin.rpc("get_user_plan", { _uid: userId });
    const { data: countData } = await supabaseAdmin.rpc("count_searches_today", { _uid: userId });
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("plan, expires_at, activated_at, source")
      .eq("user_id", userId)
      .maybeSingle();

    const plan = (planData ?? "free") as Plan;
    const limits = PLAN_LIMITS[plan];
    return {
      plan,
      usedToday: countData ?? 0,
      dailyLimit: limits.dailySearches,
      historyKept: limits.historyKept,
      expiresAt: sub?.expires_at ?? null,
      activatedAt: sub?.activated_at ?? null,
      source: sub?.source ?? null,
    };
  });

// Demo: activate Premium for 30 days (no payment)
export const activatePremiumDemo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const expires = new Date();
    expires.setDate(expires.getDate() + 30);
    const { error } = await supabaseAdmin.from("subscriptions").upsert({
      user_id: context.userId,
      plan: "premium",
      activated_at: new Date().toISOString(),
      expires_at: expires.toISOString(),
      source: "demo",
    });
    if (error) throw new Error(error.message);
    return { ok: true, expiresAt: expires.toISOString() };
  });

export const cancelPremium = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update({ plan: "free", expires_at: null, source: null })
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// List history — free users limited to N most recent
export const listMyHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: planData } = await supabaseAdmin.rpc("get_user_plan", { _uid: userId });
    const plan = (planData ?? "free") as Plan;
    const limits = PLAN_LIMITS[plan];

    let q = supabase
      .from("search_history")
      .select("id, query, synthesis, sources, created_at")
      .order("created_at", { ascending: false });
    if (limits.historyKept !== "unlimited") q = q.limit(limits.historyKept);
    else q = q.limit(500);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return { plan, items: data ?? [] };
  });

export const getHistoryItem = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: item, error } = await context.supabase
      .from("search_history")
      .select("id, query, synthesis, sources, created_at")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!item) throw new Error("Not found");
    return item;
  });

export const deleteHistoryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("search_history").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

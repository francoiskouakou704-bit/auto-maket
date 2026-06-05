import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listExportLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        success: z.enum(["all", "true", "false"]).optional(),
        format: z.enum(["all", "pdf", "docx"]).optional(),
        search: z.string().max(200).optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        limit: z.number().int().min(1).max(500).optional(),
        offset: z.number().int().min(0).optional(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    let q = supabaseAdmin.from("export_logs").select("*", { count: "exact" });

    if (data.success && data.success !== "all") {
      q = q.eq("success", data.success === "true");
    }
    if (data.format && data.format !== "all") {
      q = q.eq("format", data.format);
    }
    if (data.dateFrom) {
      q = q.gte("created_at", data.dateFrom + "T00:00:00.000Z");
    }
    if (data.dateTo) {
      q = q.lt("created_at", data.dateTo + "T23:59:59.999Z");
    }
    if (data.search) {
      const term = `%${data.search}%`;
      q = q.or(`query.ilike.${term},nonce.ilike.${term},error.ilike.${term}`);
    }

    const limit = data.limit ?? 100;
    const offset = data.offset ?? 0;

    const { data: rows, error, count } = await q
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(error.message);

    const userIds = [...new Set((rows ?? []).map((r) => r.user_id))];
    const profilesMap: Record<string, { full_name: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id,full_name")
        .in("id", userIds);
      for (const p of profs ?? []) {
        profilesMap[p.id] = p;
      }
    }

    return { logs: rows ?? [], count: count ?? 0, profiles: profilesMap };
  });

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
  return supabaseAdmin;
}

export const listExportAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        status: z.enum(["all", "open", "acknowledged", "resolved"]).optional(),
      })
      .parse(d ?? {})
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    let q = supabaseAdmin.from("export_alerts").select("*");
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { alerts: rows ?? [] };
  });

export const updateExportAlertStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["acknowledged", "resolved", "open"]),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const patch: {
      status: "open" | "acknowledged" | "resolved";
      acknowledged_by?: string;
      acknowledged_at?: string;
    } = { status: data.status };
    if (data.status === "acknowledged") {
      patch.acknowledged_by = context.userId;
      patch.acknowledged_at = new Date().toISOString();
    }
    const { error } = await supabaseAdmin
      .from("export_alerts")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const runExportAlertCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.rpc("check_export_alerts");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getExportSystemState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("export_system_state")
      .select("*")
      .eq("id", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { state: data };
  });

export const updateExportSystemState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        auto_mitigation_enabled: z.boolean().optional(),
        base_rate_limit_per_min: z.number().int().min(1).max(1000).optional(),
        degraded_rate_limit_per_min: z.number().int().min(1).max(1000).optional(),
        clear_degraded: z.boolean().optional(),
        sandbox_mode: z.boolean().optional(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const patch: {
      auto_mitigation_enabled?: boolean;
      base_rate_limit_per_min?: number;
      degraded_rate_limit_per_min?: number;
      degraded_until?: string | null;
      sandbox_mode?: boolean;
      updated_at: string;
    } = { updated_at: new Date().toISOString() };
    if (data.auto_mitigation_enabled !== undefined) patch.auto_mitigation_enabled = data.auto_mitigation_enabled;
    if (data.base_rate_limit_per_min !== undefined) patch.base_rate_limit_per_min = data.base_rate_limit_per_min;
    if (data.degraded_rate_limit_per_min !== undefined) patch.degraded_rate_limit_per_min = data.degraded_rate_limit_per_min;
    if (data.clear_degraded) patch.degraded_until = null;
    if (data.sandbox_mode !== undefined) patch.sandbox_mode = data.sandbox_mode;
    const { error } = await supabaseAdmin
      .from("export_system_state")
      .update(patch)
      .eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const simulateExportAbuse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        failures: z.number().int().min(0).max(500).optional(),
        replays: z.number().int().min(0).max(500).optional(),
        successes: z.number().int().min(0).max(500).optional(),
        spread_minutes: z.number().int().min(0).max(180).optional(),
      })
      .parse(d ?? {})
  )
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { data: result, error } = await supabaseAdmin.rpc("simulate_export_abuse", {
      _caller: context.userId,
      _failures: data.failures ?? 12,
      _replays: data.replays ?? 6,
      _successes: data.successes ?? 0,
      _spread_minutes: data.spread_minutes ?? 0,
    });
    if (error) throw new Error(error.message);
    return { result };
  });


export const clearSandboxData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { data: result, error } = await supabaseAdmin.rpc("clear_sandbox_data", {
      _caller: context.userId,
    });
    if (error) throw new Error(error.message);
    return { result };
  });

export const listExportUserBlocks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { data: blocks, error } = await supabaseAdmin
      .from("export_user_blocks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const userIds = [...new Set((blocks ?? []).map((b) => b.user_id))];
    const profilesMap: Record<string, { full_name: string | null }> = {};
    if (userIds.length) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id,full_name")
        .in("id", userIds);
      for (const p of profs ?? []) profilesMap[p.id] = p;
    }
    return { blocks: blocks ?? [], profiles: profilesMap };
  });

export const unblockExportUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("export_user_blocks")
      .update({ blocked_until: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============= Sandbox simulation presets =============

const presetSchema = z.object({
  name: z.string().min(1).max(60),
  failures: z.number().int().min(0).max(500),
  successes: z.number().int().min(0).max(500),
  replays: z.number().int().min(0).max(500),
  spread_minutes: z.number().int().min(0).max(180),
});

export const listSandboxPresets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { data, error } = await supabaseAdmin
      .from("export_sandbox_presets")
      .select("*")
      .eq("owner_id", context.userId)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return { presets: data ?? [] };
  });

export const saveSandboxPreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => presetSchema.parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("export_sandbox_presets")
      .upsert(
        { owner_id: context.userId, ...data },
        { onConflict: "owner_id,name" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSandboxPreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("export_sandbox_presets")
      .delete()
      .eq("id", data.id)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

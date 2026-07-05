import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["vehicle_status"];

function supabaseForUser(ctx: ToolContext) {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

// Minimum viable fields for a listing to be publishable. Kept intentionally
// small — the DB / RLS remains the source of truth; this is defensive UX.
function validateForPublish(v: Record<string, unknown>): string[] {
  const errs: string[] = [];
  if (!v.title || String(v.title).trim().length < 3) errs.push("title (min 3 chars)");
  if (!v.brand) errs.push("brand");
  if (!v.model) errs.push("model");
  if (typeof v.year !== "number") errs.push("year");
  if (typeof v.price !== "number" || (v.price as number) <= 0) errs.push("price > 0");
  if (typeof v.mileage !== "number" || (v.mileage as number) < 0) errs.push("mileage");
  const photos = Array.isArray(v.photos) ? v.photos : [];
  if (photos.length < 1) errs.push("at least 1 photo");
  return errs;
}

const ALLOWED_TARGETS: Status[] = ["draft", "published", "archived", "sold"];

// Only these transitions are permitted through this tool.
const TRANSITIONS: Record<Status, Status[]> = {
  draft: ["published", "archived"],
  published: ["archived", "sold", "draft"],
  archived: ["draft"],
  sold: ["archived"],
};

export default defineTool({
  name: "update_listing_status",
  title: "Update listing status",
  description:
    "Update the status of one of your own vehicle listings after validation. Typical use: promote a draft to published once the ad is ready. Also supports archiving, marking as sold, or reverting to draft. Only the listing's owner (the authenticated user) can call this.",
  inputSchema: {
    vehicle_id: z.string().uuid().describe("Id of the vehicle to update (must belong to the caller)."),
    status: z.enum(["draft", "published", "archived", "sold"]).describe("New status."),
    skip_validation: z
      .boolean()
      .default(false)
      .describe("If true, skip the publish-readiness field checks. Not recommended."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ vehicle_id, status, skip_validation }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
    }
    if (!ALLOWED_TARGETS.includes(status)) {
      return { content: [{ type: "text", text: `Unsupported status: ${status}` }], isError: true };
    }

    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId();

    const { data: vehicle, error: readErr } = await sb
      .from("vehicles")
      .select("*")
      .eq("id", vehicle_id)
      .maybeSingle();

    if (readErr) return { content: [{ type: "text", text: `Read failed: ${readErr.message}` }], isError: true };
    if (!vehicle) return { content: [{ type: "text", text: "Vehicle not found." }], isError: true };
    if (vehicle.seller_id !== userId) {
      return { content: [{ type: "text", text: "Forbidden: you do not own this listing." }], isError: true };
    }

    const current = vehicle.status as Status;
    if (current === status) {
      return {
        content: [{ type: "text", text: `Listing is already "${status}". No change.` }],
        structuredContent: { vehicle_id, status, changed: false },
      };
    }
    if (!TRANSITIONS[current]?.includes(status)) {
      return {
        content: [{ type: "text", text: `Transition ${current} → ${status} is not allowed.` }],
        isError: true,
      };
    }

    if (status === "published" && !skip_validation) {
      const errs = validateForPublish(vehicle as Record<string, unknown>);
      if (errs.length > 0) {
        return {
          content: [{
            type: "text",
            text: `Cannot publish — missing/invalid fields:\n- ${errs.join("\n- ")}\n\nFix them (or pass skip_validation=true) and try again.`,
          }],
          structuredContent: { vehicle_id, blocked: true, missing: errs },
          isError: true,
        };
      }
    }

    const { data: updated, error: updErr } = await sb
      .from("vehicles")
      .update({ status })
      .eq("id", vehicle_id)
      .eq("seller_id", userId)
      .select("id, title, brand, model, year, status, updated_at")
      .maybeSingle();

    if (updErr) return { content: [{ type: "text", text: `Update failed: ${updErr.message}` }], isError: true };
    if (!updated) {
      return { content: [{ type: "text", text: "Update rejected by policy." }], isError: true };
    }

    return {
      content: [{
        type: "text",
        text: `Listing "${updated.title}" (${updated.year} ${updated.brand} ${updated.model}) is now "${updated.status}".`,
      }],
      structuredContent: { vehicle: updated, previous_status: current, changed: true },
    };
  },
});

import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

function supabasePublic() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export default defineTool({
  name: "search_vehicles",
  title: "Search vehicles",
  description:
    "Search the public vehicle marketplace by brand, model, price range, year range, fuel, or full-text query. Returns a compact list of matching listings.",
  inputSchema: {
    query: z.string().trim().min(1).max(200).optional().describe("Free-text search on title/description"),
    brand: z.string().trim().min(1).max(60).optional(),
    model: z.string().trim().min(1).max(60).optional(),
    min_price: z.number().int().min(0).optional(),
    max_price: z.number().int().min(0).optional(),
    min_year: z.number().int().min(1950).max(2030).optional(),
    max_year: z.number().int().min(1950).max(2030).optional(),
    fuel: z.enum(["gasoline", "diesel", "hybrid", "electric", "lpg", "other"]).optional(),
    limit: z.number().int().min(1).max(50).default(20),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input) => {
    const sb = supabasePublic();
    let q = sb
      .from("vehicles")
      .select("id, title, brand, model, year, price, currency, mileage, fuel, transmission, city, country")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(input.limit);

    if (input.brand) q = q.ilike("brand", `%${input.brand}%`);
    if (input.model) q = q.ilike("model", `%${input.model}%`);
    if (input.min_price != null) q = q.gte("price", input.min_price);
    if (input.max_price != null) q = q.lte("price", input.max_price);
    if (input.min_year != null) q = q.gte("year", input.min_year);
    if (input.max_year != null) q = q.lte("year", input.max_year);
    if (input.fuel) q = q.eq("fuel", input.fuel);
    if (input.query) q = q.or(`title.ilike.%${input.query}%,description.ilike.%${input.query}%`);

    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: `Search failed: ${error.message}` }], isError: true };
    }
    const rows = data ?? [];
    const summary = rows.length === 0
      ? "No vehicles matched."
      : rows.map((v) => `• ${v.year} ${v.brand} ${v.model} — ${v.price} ${v.currency} — ${v.mileage} km — ${v.city ?? "?"} (${v.id})`).join("\n");
    return {
      content: [{ type: "text", text: summary }],
      structuredContent: { count: rows.length, results: rows },
    };
  },
});

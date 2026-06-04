import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Firecrawl from "@mendable/firecrawl-js";

const SearchInput = z.object({
  query: z.string().min(1).max(300),
  limit: z.number().int().min(1).max(15).optional(),
});

export type SearchResult = {
  url: string;
  title: string;
  description: string;
  date?: string;
};

export const webSearch = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => SearchInput.parse(d))
  .handler(async ({ data }): Promise<{ results: SearchResult[] }> => {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) throw new Error("FIRECRAWL_API_KEY missing");

    const firecrawl = new Firecrawl({ apiKey });
    const res = await firecrawl.search(data.query, { limit: data.limit ?? 8 });

    // SDK v2: results often under `web`
    const raw: any[] =
      (res as any).web ??
      (res as any).data ??
      (Array.isArray(res) ? (res as any) : []);

    const results: SearchResult[] = raw
      .filter((r) => r && r.url)
      .map((r) => ({
        url: String(r.url),
        title: String(r.title ?? r.url),
        description: String(r.description ?? r.snippet ?? ""),
        date: r.date ?? r.publishedDate ?? undefined,
      }));

    return { results };
  });

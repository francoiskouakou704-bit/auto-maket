import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { PLAN_LIMITS, type Plan } from "@/lib/premium";

type Body = {
  messages?: UIMessage[];
  sources?: { title: string; url: string; description: string }[];
  query?: string;
};

export const Route = createFileRoute("/api/search-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages, sources, query } = (await request.json()) as Body;
        if (!Array.isArray(messages)) {
          return new Response("messages required", { status: 400 });
        }
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("LOVABLE_API_KEY missing", { status: 500 });

        // Optional auth — required to enforce per-user quotas and persist history
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.toLowerCase().startsWith("bearer ")
          ? authHeader.slice(7)
          : "";

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        let userId: string | null = null;
        let plan: Plan = "free";
        if (token) {
          const { data: userRes } = await supabaseAdmin.auth.getUser(token);
          userId = userRes?.user?.id ?? null;
          if (userId) {
            const { data: planData } = await supabaseAdmin.rpc("get_user_plan", { _uid: userId });
            plan = ((planData ?? "free") as Plan);

            // Only count quota on the initial synthesis request (the first user message
            // in the stream): follow-up chats reuse the same context.
            const isInitial = messages.length <= 1;
            if (isInitial) {
              const { data: countData } = await supabaseAdmin.rpc("count_searches_today", { _uid: userId });
              const used = (countData ?? 0) as number;
              const limit = PLAN_LIMITS[plan].dailySearches;
              if (used >= limit) {
                return new Response(
                  JSON.stringify({
                    error: "quota_exceeded",
                    plan,
                    used,
                    limit,
                    message: plan === "free"
                      ? `Limite quotidienne atteinte (${limit}/jour). Passez à Premium pour ${PLAN_LIMITS.premium.dailySearches} recherches par jour.`
                      : `Limite quotidienne atteinte (${limit}/jour). Réessayez demain.`,
                  }),
                  { status: 429, headers: { "Content-Type": "application/json" } },
                );
              }
            }
          }
        }

        const sourcesBlock = (sources ?? [])
          .slice(0, 10)
          .map(
            (s, i) =>
              `[${i + 1}] ${s.title}\nURL: ${s.url}\n${s.description}`,
          )
          .join("\n\n");

        const system = `Tu es un assistant de recherche intelligent en français, façon Perplexity.
Tu réponds de manière synthétique, structurée et factuelle en t'appuyant sur les sources web fournies ci-dessous.

Règles :
- Cite les sources avec [1], [2]… correspondant à la liste fournie.
- Si l'information n'est pas dans les sources, dis-le clairement.
- Utilise le markdown : titres, listes, tableaux comparatifs quand pertinent.
- Sois concis mais complet.

${query ? `Requête de l'utilisateur : "${query}"\n\n` : ""}Sources :
${sourcesBlock || "(aucune source fournie)"}`;

        const gateway = createLovableAiGatewayProvider(key);
        const result = streamText({
          model: gateway("google/gemini-3-flash-preview"),
          system,
          messages: await convertToModelMessages(messages),
          onFinish: async ({ text }) => {
            if (!userId || !query) return;
            const isInitial = messages.length <= 1;
            if (!isInitial) return; // only persist the first synthesis
            try {
              await supabaseAdmin.from("search_history").insert({
                user_id: userId,
                query,
                synthesis: text,
                sources: (sources ?? []).slice(0, 10),
              });
            } catch (e) {
              console.error("[search-chat] failed to save history", e);
            }
          },
        });

        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});

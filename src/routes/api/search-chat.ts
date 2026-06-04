import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

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
        });

        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});

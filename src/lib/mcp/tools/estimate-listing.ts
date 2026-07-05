import { defineTool } from "@lovable.dev/mcp-js";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

export default defineTool({
  name: "estimate_listing",
  title: "Estimate a vehicle listing",
  description:
    "Generate an AI-crafted sales listing (title, description, selling points, estimated market price in EUR) for a given vehicle.",
  inputSchema: {
    brand: z.string().min(1).max(50),
    model: z.string().min(1).max(50),
    year: z.number().int().min(1950).max(2030),
    mileage: z.number().int().min(0).max(2_000_000).optional(),
    fuel: z.string().optional(),
    transmission: z.string().optional(),
    extra: z.string().max(500).optional(),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (data) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) return { content: [{ type: "text", text: "LOVABLE_API_KEY missing" }], isError: true };
    const gateway = createLovableAiGatewayProvider(key);

    const { output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      output: Output.object({
        schema: z.object({
          title: z.string(),
          description: z.string(),
          selling_points: z.array(z.string()),
          estimated_price_eur: z.number(),
          estimated_price_range: z.object({ min: z.number(), max: z.number() }),
        }),
      }),
      prompt: `Expert automobile. Rédige une annonce en français pour :
Marque: ${data.brand}
Modèle: ${data.model}
Année: ${data.year}
Kilométrage: ${data.mileage ?? "n/a"}
Carburant: ${data.fuel ?? "n/a"}
Boîte: ${data.transmission ?? "n/a"}
Détails: ${data.extra ?? "aucun"}
Estime le prix marché européen d'occasion.`,
    });

    return {
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
      structuredContent: output,
    };
  },
});

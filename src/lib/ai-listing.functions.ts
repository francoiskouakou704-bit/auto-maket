import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const ListingInput = z.object({
  brand: z.string().min(1).max(50),
  model: z.string().min(1).max(50),
  year: z.number().int().min(1950).max(2030),
  mileage: z.number().int().min(0).max(2_000_000).optional(),
  fuel: z.string().optional(),
  transmission: z.string().optional(),
  extra: z.string().max(500).optional(),
});

export const generateListingAI = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ListingInput.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY missing");
    const gateway = createLovableAiGatewayProvider(key);

    const { output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      output: Output.object({
        schema: z.object({
          title: z.string().describe("Titre accrocheur de l'annonce, max 80 caractères"),
          description: z.string().describe("Description détaillée et vendeuse en français, 4-6 phrases"),
          selling_points: z.array(z.string()).describe("3-5 arguments de vente clés"),
          estimated_price_eur: z.number().describe("Estimation du prix marché en euros"),
          estimated_price_range: z.object({
            min: z.number(),
            max: z.number(),
          }).describe("Fourchette de prix réaliste"),
        }),
      }),
      prompt: `Tu es un expert automobile. Génère une annonce professionnelle en français pour ce véhicule :
Marque: ${data.brand}
Modèle: ${data.model}
Année: ${data.year}
Kilométrage: ${data.mileage ?? "non renseigné"}
Carburant: ${data.fuel ?? "non renseigné"}
Boîte: ${data.transmission ?? "non renseignée"}
Détails: ${data.extra ?? "aucun"}

Estime le prix sur le marché européen de l'occasion en tenant compte de l'âge, du kilométrage et de la cote moyenne.`,
    });

    return output;
  });

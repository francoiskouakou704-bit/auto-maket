import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { CAR_BRANDS } from "@/lib/cars-data";
import { generateListingAI } from "@/lib/ai-listing.functions";

export const Route = createFileRoute("/sell")({
  head: () => ({ meta: [{ title: "Vendre ma voiture avec l'IA — AutoMarket" }] }),
  component: SellPage,
});

function SellPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [aiLoading, setAiLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    brand: "", model: "", year: new Date().getFullYear() - 3, mileage: 50000,
    fuel: "gasoline", transmission: "manual", title: "", description: "",
    price: 0, city: "", country: "", extra: "",
  });

  if (loading) return <div className="container mx-auto py-20 text-center text-muted-foreground">Chargement…</div>;
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <h1 className="font-display text-3xl font-bold mb-4">Connectez-vous pour publier</h1>
        <Button onClick={() => navigate({ to: "/auth" })} className="bg-gradient-primary text-primary-foreground shadow-elegant">Se connecter</Button>
      </div>
    );
  }

  async function runAI() {
    if (!form.brand || !form.model) return toast.error("Renseignez au moins la marque et le modèle.");
    setAiLoading(true);
    try {
      const out = await generateListingAI({ data: {
        brand: form.brand, model: form.model, year: Number(form.year),
        mileage: Number(form.mileage), fuel: form.fuel, transmission: form.transmission,
        extra: form.extra,
      }});
      setForm((f) => ({
        ...f,
        title: out.title,
        description: out.description + "\n\nPoints forts :\n• " + out.selling_points.join("\n• "),
        price: f.price || Math.round(out.estimated_price_eur),
      }));
      toast.success(`Annonce générée • Prix estimé : ${Math.round(out.estimated_price_range.min)}€ – ${Math.round(out.estimated_price_range.max)}€`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur IA";
      if (msg.includes("429")) toast.error("Trop de requêtes, réessayez dans un instant.");
      else if (msg.includes("402")) toast.error("Crédits IA épuisés.");
      else toast.error(msg);
    } finally { setAiLoading(false); }
  }

  async function publish() {
    if (!form.brand || !form.model || !form.title || !form.price) return toast.error("Champs obligatoires manquants.");
    setSubmitting(true);
    const { data, error } = await supabase.from("vehicles").insert({
      seller_id: user!.id,
      brand: form.brand, model: form.model, year: Number(form.year), mileage: Number(form.mileage),
      fuel: form.fuel as never, transmission: form.transmission as never,
      title: form.title, description: form.description, price: Number(form.price),
      city: form.city, country: form.country, status: "published" as never, ai_generated: !!form.description,
    }).select("id").single();
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Annonce publiée !");
    navigate({ to: "/vehicles/$id", params: { id: data!.id } });
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      <div className="mb-8">
        <h1 className="font-display text-3xl md:text-4xl font-bold flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary shadow-elegant"><Sparkles className="h-5 w-5 text-primary-foreground" /></span>
          Vendre ma voiture avec l'IA
        </h1>
        <p className="text-muted-foreground mt-2">Renseignez les infos de base, l'IA génère le titre, la description et estime le prix.</p>
      </div>

      <Card className="p-6 space-y-5">
        <div className="grid md:grid-cols-2 gap-4">
          <div><Label>Marque *</Label>
            <Select value={form.brand} onValueChange={(v) => setForm((f) => ({...f, brand: v}))}>
              <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
              <SelectContent>{CAR_BRANDS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Modèle *</Label><Input value={form.model} onChange={(e) => setForm((f) => ({...f, model: e.target.value}))} /></div>
          <div><Label>Année</Label><Input type="number" value={form.year} onChange={(e) => setForm((f) => ({...f, year: Number(e.target.value)}))} /></div>
          <div><Label>Kilométrage</Label><Input type="number" value={form.mileage} onChange={(e) => setForm((f) => ({...f, mileage: Number(e.target.value)}))} /></div>
          <div><Label>Carburant</Label>
            <Select value={form.fuel} onValueChange={(v) => setForm((f) => ({...f, fuel: v}))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gasoline">Essence</SelectItem><SelectItem value="diesel">Diesel</SelectItem>
                <SelectItem value="electric">Électrique</SelectItem><SelectItem value="hybrid">Hybride</SelectItem>
                <SelectItem value="lpg">GPL</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Transmission</Label>
            <Select value={form.transmission} onValueChange={(v) => setForm((f) => ({...f, transmission: v}))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manuelle</SelectItem>
                <SelectItem value="automatic">Automatique</SelectItem>
                <SelectItem value="semi_automatic">Semi-auto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Détails complémentaires (options, état…)</Label>
          <Textarea rows={2} value={form.extra} onChange={(e) => setForm((f) => ({...f, extra: e.target.value}))} placeholder="GPS, cuir, première main, carnet d'entretien complet…" />
        </div>

        <Button onClick={runAI} disabled={aiLoading} className="w-full bg-gradient-primary text-primary-foreground shadow-elegant">
          {aiLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          Générer l'annonce avec l'IA
        </Button>

        <div className="border-t pt-5 space-y-4">
          <div><Label>Titre de l'annonce *</Label><Input value={form.title} onChange={(e) => setForm((f) => ({...f, title: e.target.value}))} /></div>
          <div><Label>Description</Label><Textarea rows={6} value={form.description} onChange={(e) => setForm((f) => ({...f, description: e.target.value}))} /></div>
          <div className="grid md:grid-cols-3 gap-4">
            <div><Label>Prix (€) *</Label><Input type="number" value={form.price} onChange={(e) => setForm((f) => ({...f, price: Number(e.target.value)}))} /></div>
            <div><Label>Ville</Label><Input value={form.city} onChange={(e) => setForm((f) => ({...f, city: e.target.value}))} /></div>
            <div><Label>Pays</Label><Input value={form.country} onChange={(e) => setForm((f) => ({...f, country: e.target.value}))} /></div>
          </div>
        </div>

        <Button onClick={publish} disabled={submitting} size="lg" className="w-full">
          {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
          Publier l'annonce
        </Button>
      </Card>
    </div>
  );
}

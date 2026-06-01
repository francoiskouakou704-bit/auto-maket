import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Search, Shield, Sparkles, TrendingUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VehicleCard, type VehicleSummary } from "@/components/VehicleCard";
import { supabase } from "@/integrations/supabase/client";
import heroCar from "@/assets/hero-car.jpg";
import car1 from "@/assets/car-1.jpg";
import car2 from "@/assets/car-2.jpg";
import car3 from "@/assets/car-3.jpg";
import car4 from "@/assets/car-4.jpg";

const SAMPLE_PHOTOS = [car1, car2, car3, car4];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AutoMarket — Achetez et vendez votre voiture intelligemment" },
      { name: "description", content: "Des milliers de voitures d'occasion vérifiées. Estimation IA, annonce générée en un clic, mise en relation directe." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { data: vehicles } = useQuery({
    queryKey: ["featured-vehicles"],
    queryFn: async (): Promise<VehicleSummary[]> => {
      const { data } = await supabase
        .from("vehicles")
        .select("id,title,brand,model,year,mileage,fuel,transmission,price,currency,city,country,photos,featured")
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .limit(8);
      return (data ?? []) as VehicleSummary[];
    },
  });

  const list = (vehicles && vehicles.length > 0)
    ? vehicles
    : SAMPLE_PHOTOS.map((p, i): VehicleSummary => ({
        id: `sample-${i}`,
        title: ["Mercedes Classe C 220d AMG Line", "Audi RS5 Coupé", "Tesla Model 3 Long Range", "Smart ForTwo Passion"][i],
        brand: ["Mercedes-Benz", "Audi", "Tesla", "Smart"][i],
        model: ["Classe C", "RS5", "Model 3", "ForTwo"][i],
        year: [2022, 2021, 2023, 2020][i],
        mileage: [28500, 45200, 12000, 38000][i],
        fuel: ["diesel", "gasoline", "electric", "gasoline"][i],
        transmission: ["automatic", "automatic", "automatic", "manual"][i],
        price: [42900, 89500, 38500, 9800][i],
        city: ["Paris", "Lyon", "Marseille", "Bordeaux"][i],
        photos: [p],
        featured: i < 2,
      }));

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-95" />
        <img src={heroCar} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-luminosity" width={1920} height={1080} />
        <div className="relative container mx-auto px-4 py-24 md:py-36">
          <div className="max-w-3xl animate-fade-in-up">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-4 py-1.5 text-xs font-medium text-white border border-white/20">
              <Sparkles className="h-3.5 w-3.5" /> Propulsé par l'IA
            </span>
            <h1 className="mt-6 font-display text-5xl md:text-7xl font-bold text-white leading-[1.05] text-balance">
              Trouvez la voiture <span className="text-primary-glow">parfaite</span>. Vendez la vôtre en un clic.
            </h1>
            <p className="mt-6 text-lg md:text-xl text-white/80 max-w-2xl">
              Marketplace nouvelle génération pour acheter et vendre des véhicules d'occasion partout dans le monde.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-3 max-w-2xl">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  className="h-14 pl-12 text-base bg-background/95 backdrop-blur border-0 shadow-elegant"
                  placeholder="Marque, modèle, mot-clé…"
                />
              </div>
              <Button asChild size="lg" className="h-14 px-8 bg-white text-primary hover:bg-white/90 shadow-elegant">
                <Link to="/browse">Rechercher <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
            </div>

            <div className="mt-12 grid grid-cols-3 gap-6 max-w-xl">
              {[
                { v: "50K+", l: "Annonces" },
                { v: "120+", l: "Pays" },
                { v: "98%", l: "Satisfaction" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="font-display text-3xl font-bold text-white">{s.v}</div>
                  <div className="text-sm text-white/70">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Sparkles, title: "Vendez avec l'IA", desc: "Prenez 10 photos, l'IA identifie le véhicule, remplit la fiche, estime le prix et publie." },
            { icon: TrendingUp, title: "Estimation marché", desc: "Connaissez la juste valeur de votre voiture en temps réel grâce à notre moteur IA." },
            { icon: Shield, title: "Vendeurs vérifiés", desc: "Badges, historique et messagerie sécurisée pour des transactions en toute confiance." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border bg-card p-6 shadow-card hover:shadow-elegant transition-smooth">
              <div className="h-12 w-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-elegant">
                <f.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="mt-5 font-display text-xl font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured vehicles */}
      <section className="container mx-auto px-4 py-12">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="font-display text-3xl md:text-4xl font-bold">À la une</h2>
            <p className="text-muted-foreground mt-1">Nos dernières annonces premium</p>
          </div>
          <Button asChild variant="outline"><Link to="/browse">Voir tout <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {list.slice(0, 8).map((v) => <VehicleCard key={v.id} vehicle={v} />)}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-hero p-10 md:p-16 shadow-elegant">
          <div className="relative max-w-2xl">
            <Zap className="h-10 w-10 text-primary-glow mb-4" />
            <h2 className="font-display text-3xl md:text-5xl font-bold text-white text-balance">
              Vendez votre voiture en 60 secondes
            </h2>
            <p className="mt-4 text-white/80 text-lg">
              Notre assistant IA crée votre annonce, estime le prix et la publie automatiquement.
            </p>
            <Button asChild size="lg" className="mt-8 bg-white text-primary hover:bg-white/90 shadow-elegant">
              <Link to="/sell"><Sparkles className="h-4 w-4 mr-2" />Essayer maintenant</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

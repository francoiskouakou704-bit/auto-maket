import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Fuel, Gauge, MapPin, MessageCircle, Phone, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { FUEL_LABELS, TRANSMISSION_LABELS, formatMileage, formatPrice } from "@/lib/cars-data";

export const Route = createFileRoute("/vehicles/$id")({
  component: VehicleDetail,
});

function VehicleDetail() {
  const { id } = useParams({ from: "/vehicles/$id" });
  const { data, isLoading } = useQuery({
    queryKey: ["vehicle", id],
    queryFn: async () => {
      const { data } = await supabase.from("vehicles").select("*").eq("id", id).maybeSingle();
      return data;
    },
  });

  if (isLoading) return <div className="container mx-auto py-20 text-center text-muted-foreground">Chargement…</div>;
  if (!data) return (
    <div className="container mx-auto py-20 text-center">
      <p className="text-muted-foreground">Annonce introuvable.</p>
      <Link to="/browse" className="text-primary hover:underline mt-3 inline-block">Retour à la recherche</Link>
    </div>
  );

  const photo = data.photos?.[0] ?? "/placeholder.svg";

  return (
    <div className="container mx-auto px-4 py-10 max-w-6xl">
      <div className="grid lg:grid-cols-[1fr_380px] gap-8">
        <div>
          <div className="aspect-[16/10] rounded-2xl overflow-hidden bg-muted shadow-card">
            <img src={photo} alt={data.title} className="w-full h-full object-cover" />
          </div>

          <h1 className="font-display text-3xl md:text-4xl font-bold mt-6 text-balance">{data.title}</h1>
          <p className="text-muted-foreground mt-1">{data.brand} • {data.model} {data.version ?? ""}</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            {[
              { icon: Calendar, label: "Année", value: data.year },
              { icon: Gauge, label: "Kilométrage", value: formatMileage(data.mileage) },
              { icon: Fuel, label: "Carburant", value: FUEL_LABELS[data.fuel] ?? data.fuel },
              { icon: Settings2, label: "Boîte", value: TRANSMISSION_LABELS[data.transmission] ?? data.transmission },
            ].map((s) => (
              <Card key={s.label} className="p-4 text-center">
                <s.icon className="h-5 w-5 mx-auto text-primary mb-2" />
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className="font-semibold">{s.value}</div>
              </Card>
            ))}
          </div>

          {data.description && (
            <div className="mt-8">
              <h2 className="font-display text-xl font-bold mb-3">Description</h2>
              <p className="whitespace-pre-line text-foreground/80 leading-relaxed">{data.description}</p>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <Card className="p-6">
            <div className="text-sm text-muted-foreground">Prix</div>
            <div className="font-display text-4xl font-bold text-primary">{formatPrice(Number(data.price), data.currency)}</div>
            {data.negotiable && <div className="text-xs text-muted-foreground mt-1">Prix négociable</div>}
            {(data.city || data.country) && (
              <div className="mt-4 text-sm inline-flex items-center gap-1 text-muted-foreground">
                <MapPin className="h-4 w-4" />{[data.city, data.country].filter(Boolean).join(", ")}
              </div>
            )}
            <div className="mt-5 space-y-2">
              <Button className="w-full bg-gradient-primary text-primary-foreground shadow-elegant"><MessageCircle className="h-4 w-4 mr-2" />Contacter le vendeur</Button>
              <Button variant="outline" className="w-full"><Phone className="h-4 w-4 mr-2" />Appeler</Button>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

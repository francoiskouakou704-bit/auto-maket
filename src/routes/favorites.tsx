import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { VehicleCard, type VehicleSummary } from "@/components/VehicleCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/favorites")({
  head: () => ({ meta: [{ title: "Mes favoris — AutoMarket" }] }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["favorites", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<VehicleSummary[]> => {
      const { data } = await supabase.from("favorites")
        .select("vehicle:vehicles(id,title,brand,model,year,mileage,fuel,transmission,price,currency,city,country,photos,featured)")
        .eq("user_id", user!.id);
      return ((data ?? []).map((r) => r.vehicle).filter(Boolean) as unknown) as VehicleSummary[];
    },
  });

  if (loading) return <div className="container mx-auto py-20 text-center text-muted-foreground">Chargement…</div>;
  if (!user) { navigate({ to: "/auth" }); return null; }

  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="font-display text-3xl md:text-4xl font-bold mb-8 flex items-center gap-3">
        <Heart className="h-7 w-7 text-destructive fill-destructive" />Mes favoris
      </h1>
      {data && data.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {data.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
        </div>
      ) : (
        <div className="text-center py-20 border-2 border-dashed rounded-2xl">
          <p className="text-muted-foreground">Aucun favori pour l'instant.</p>
          <Link to="/browse" className="mt-3 inline-block text-primary hover:underline">Parcourir les annonces</Link>
        </div>
      )}
    </div>
  );
}

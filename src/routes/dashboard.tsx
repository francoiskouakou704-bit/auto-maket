import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VehicleCard, type VehicleSummary } from "@/components/VehicleCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Tableau de bord — AutoMarket" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const { data: myVehicles } = useQuery({
    queryKey: ["my-vehicles", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<VehicleSummary[]> => {
      const { data } = await supabase.from("vehicles")
        .select("id,title,brand,model,year,mileage,fuel,transmission,price,currency,city,country,photos,featured")
        .eq("seller_id", user!.id).order("created_at", { ascending: false });
      return (data ?? []) as VehicleSummary[];
    },
  });

  if (loading) return <div className="container mx-auto py-20 text-center text-muted-foreground">Chargement…</div>;
  if (!user) { navigate({ to: "/auth" }); return null; }

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">Mon tableau de bord</h1>
          <p className="text-muted-foreground mt-1">{myVehicles?.length ?? 0} annonce(s)</p>
        </div>
        <Button asChild className="bg-gradient-primary text-primary-foreground shadow-elegant">
          <Link to="/sell"><Plus className="h-4 w-4 mr-2" />Nouvelle annonce</Link>
        </Button>
      </div>

      {myVehicles && myVehicles.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {myVehicles.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
        </div>
      ) : (
        <div className="text-center py-20 border-2 border-dashed rounded-2xl">
          <p className="text-muted-foreground mb-4">Aucune annonce pour l'instant.</p>
          <Button asChild className="bg-gradient-primary text-primary-foreground"><Link to="/sell">Publier ma première annonce</Link></Button>
        </div>
      )}
    </div>
  );
}

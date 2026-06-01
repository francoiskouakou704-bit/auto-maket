import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VehicleCard, type VehicleSummary } from "@/components/VehicleCard";
import { supabase } from "@/integrations/supabase/client";
import { CAR_BRANDS } from "@/lib/cars-data";

export const Route = createFileRoute("/browse")({
  head: () => ({ meta: [{ title: "Rechercher une voiture — AutoMarket" }, { name: "description", content: "Parcourez des milliers d'annonces de voitures d'occasion avec filtres avancés." }] }),
  component: BrowsePage,
});

function BrowsePage() {
  const [brand, setBrand] = useState<string>("all");
  const [sort, setSort] = useState<string>("recent");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["vehicles", brand, sort, search],
    queryFn: async (): Promise<VehicleSummary[]> => {
      let q = supabase.from("vehicles")
        .select("id,title,brand,model,year,mileage,fuel,transmission,price,currency,city,country,photos,featured")
        .eq("status", "published");
      if (brand !== "all") q = q.eq("brand", brand);
      if (search) q = q.ilike("title", `%${search}%`);
      if (sort === "price_asc") q = q.order("price", { ascending: true });
      else if (sort === "price_desc") q = q.order("price", { ascending: false });
      else q = q.order("created_at", { ascending: false });
      const { data } = await q.limit(60);
      return (data ?? []) as VehicleSummary[];
    },
  });

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl md:text-4xl font-bold">Toutes les annonces</h1>
        <p className="text-muted-foreground mt-1">Trouvez la voiture qui vous correspond.</p>
      </div>

      <div className="grid md:grid-cols-[1fr_220px_200px] gap-3 mb-8">
        <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Select value={brand} onValueChange={setBrand}>
          <SelectTrigger><SelectValue placeholder="Marque" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les marques</SelectItem>
            {CAR_BRANDS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Plus récent</SelectItem>
            <SelectItem value="price_asc">Prix croissant</SelectItem>
            <SelectItem value="price_desc">Prix décroissant</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-center text-muted-foreground py-20">Chargement…</p>
      ) : data && data.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {data.map((v) => <VehicleCard key={v.id} vehicle={v} />)}
        </div>
      ) : (
        <div className="text-center py-20">
          <p className="text-muted-foreground">Aucune annonce pour le moment.</p>
          <Link to="/sell" className="mt-4 inline-block text-primary hover:underline">Publiez la première !</Link>
        </div>
      )}
    </div>
  );
}

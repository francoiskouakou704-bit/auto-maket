import { Link } from "@tanstack/react-router";
import { Calendar, Fuel, Gauge, Heart, MapPin, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FUEL_LABELS, TRANSMISSION_LABELS, formatMileage, formatPrice } from "@/lib/cars-data";

export interface VehicleSummary {
  id: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  mileage: number;
  fuel: string;
  transmission: string;
  price: number;
  currency?: string;
  city?: string | null;
  country?: string | null;
  photos: string[];
  featured?: boolean | null;
}

export function VehicleCard({
  vehicle,
  isFavorite,
  onToggleFavorite,
}: {
  vehicle: VehicleSummary;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
}) {
  const photo = vehicle.photos?.[0] ?? "/placeholder.svg";
  return (
    <Card className="group overflow-hidden border-border/60 bg-card shadow-card hover:shadow-elegant transition-smooth hover:-translate-y-1 p-0">
      <Link to="/vehicles/$id" params={{ id: vehicle.id }} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          <img
            src={photo}
            alt={vehicle.title}
            loading="lazy"
            className="h-full w-full object-cover transition-smooth group-hover:scale-105"
          />
          {vehicle.featured && (
            <span className="absolute top-3 left-3 rounded-full bg-gradient-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-elegant">
              Premium
            </span>
          )}
          {onToggleFavorite && (
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-3 right-3 h-9 w-9 rounded-full bg-background/90 backdrop-blur hover:bg-background"
              onClick={(e) => { e.preventDefault(); onToggleFavorite(); }}
            >
              <Heart className={`h-4 w-4 ${isFavorite ? "fill-destructive text-destructive" : ""}`} />
            </Button>
          )}
        </div>
        <div className="p-4 space-y-3">
          <div>
            <h3 className="font-display font-semibold line-clamp-1 text-balance">{vehicle.title}</h3>
            <p className="text-sm text-muted-foreground">{vehicle.brand} • {vehicle.model}</p>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{vehicle.year}</span>
            <span className="inline-flex items-center gap-1"><Gauge className="h-3.5 w-3.5" />{formatMileage(vehicle.mileage)}</span>
            <span className="inline-flex items-center gap-1"><Fuel className="h-3.5 w-3.5" />{FUEL_LABELS[vehicle.fuel] ?? vehicle.fuel}</span>
            <span className="inline-flex items-center gap-1"><Settings2 className="h-3.5 w-3.5" />{TRANSMISSION_LABELS[vehicle.transmission] ?? vehicle.transmission}</span>
          </div>
          <div className="flex items-end justify-between pt-1">
            <span className="font-display text-xl font-bold text-primary">{formatPrice(vehicle.price, vehicle.currency)}</span>
            {vehicle.city && (
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />{vehicle.city}
              </span>
            )}
          </div>
        </div>
      </Link>
    </Card>
  );
}

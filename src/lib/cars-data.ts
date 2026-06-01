export const CAR_BRANDS = [
  "Audi", "BMW", "Citroën", "Dacia", "Fiat", "Ford", "Honda", "Hyundai",
  "Jeep", "Kia", "Land Rover", "Lexus", "Mazda", "Mercedes-Benz", "Mini",
  "Mitsubishi", "Nissan", "Opel", "Peugeot", "Porsche", "Renault", "Seat",
  "Skoda", "Subaru", "Suzuki", "Tesla", "Toyota", "Volkswagen", "Volvo",
] as const;

export const FUEL_LABELS: Record<string, string> = {
  gasoline: "Essence",
  diesel: "Diesel",
  electric: "Électrique",
  hybrid: "Hybride",
  lpg: "GPL",
  other: "Autre",
};

export const TRANSMISSION_LABELS: Record<string, string> = {
  manual: "Manuelle",
  automatic: "Automatique",
  semi_automatic: "Semi-auto",
};

export function formatPrice(amount: number, currency = "EUR") {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatMileage(km: number) {
  return new Intl.NumberFormat("fr-FR").format(km) + " km";
}

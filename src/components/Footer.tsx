import { Link } from "@tanstack/react-router";
import { Car } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-secondary/30 mt-20">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 font-display font-bold text-xl mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary">
                <Car className="h-5 w-5 text-primary-foreground" />
              </div>
              AutoMarket
            </Link>
            <p className="text-sm text-muted-foreground">
              La place de marché auto nouvelle génération, propulsée par l'IA.
            </p>
          </div>
          <div>
            <h4 className="font-display font-semibold mb-3">Explorer</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/browse" className="hover:text-foreground transition-smooth">Toutes les annonces</Link></li>
              <li><Link to="/sell" className="hover:text-foreground transition-smooth">Vendre ma voiture</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-display font-semibold mb-3">Compte</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link to="/auth" className="hover:text-foreground transition-smooth">Connexion</Link></li>
              <li><Link to="/dashboard" className="hover:text-foreground transition-smooth">Tableau de bord</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-display font-semibold mb-3">Légal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Conditions</li>
              <li>Confidentialité</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border/40 mt-10 pt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} AutoMarket. Plateforme de vente de véhicules d'occasion.
        </div>
      </div>
    </footer>
  );
}

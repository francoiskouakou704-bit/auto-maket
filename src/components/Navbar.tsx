import { Link } from "@tanstack/react-router";
import { Car, Heart, LayoutDashboard, LogOut, Menu, Plus, Search, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";

export function Navbar() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const navLinks = (
    <>
      <Link to="/browse" className="text-sm font-medium text-foreground/80 hover:text-foreground transition-smooth">
        <Search className="inline h-4 w-4 mr-1.5" />Rechercher
      </Link>
      <Link to="/sell" className="text-sm font-medium text-foreground/80 hover:text-foreground transition-smooth">
        <Sparkles className="inline h-4 w-4 mr-1.5" />Vendre avec l'IA
      </Link>
      {user && (
        <>
          <Link to="/favorites" className="text-sm font-medium text-foreground/80 hover:text-foreground transition-smooth">
            <Heart className="inline h-4 w-4 mr-1.5" />Favoris
          </Link>
          <Link to="/dashboard" className="text-sm font-medium text-foreground/80 hover:text-foreground transition-smooth">
            <LayoutDashboard className="inline h-4 w-4 mr-1.5" />Tableau de bord
          </Link>
        </>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-display font-bold text-xl">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary shadow-elegant">
            <Car className="h-5 w-5 text-primary-foreground" />
          </div>
          <span>AutoMarket</span>
        </Link>

        <nav className="hidden md:flex items-center gap-7">
          {navLinks}
        </nav>

        <div className="flex items-center gap-2">
          <Button asChild size="sm" className="hidden sm:flex bg-gradient-primary text-primary-foreground shadow-elegant hover:opacity-90">
            <Link to="/sell"><Plus className="h-4 w-4 mr-1" />Publier</Link>
          </Button>
          {user ? (
            <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut()}>
              <LogOut className="h-4 w-4" />
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link to="/auth">Connexion</Link>
            </Button>
          )}

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <nav className="flex flex-col gap-5 mt-8" onClick={() => setOpen(false)}>
                {navLinks}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

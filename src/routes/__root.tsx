import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet, Link, createRootRouteWithContext, useRouter, HeadContent, Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold">404</h1>
        <p className="mt-3 text-muted-foreground">Cette page n'existe pas.</p>
        <Link to="/" className="mt-6 inline-flex rounded-md bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-elegant">Retour à l'accueil</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root" }); }, [error]);
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl font-semibold">Erreur de chargement</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button onClick={() => { router.invalidate(); reset(); }} className="mt-6 rounded-md bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-elegant">Réessayer</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "AutoMarket — Achat & vente de voitures d'occasion" },
      { name: "description", content: "Plateforme mondiale de vente et revente de véhicules d'occasion, propulsée par l'IA." },
      { property: "og:title", content: "AutoMarket — Achat & vente de voitures d'occasion" },
      { property: "og:description", content: "Plateforme mondiale de vente et revente de véhicules d'occasion, propulsée par l'IA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "AutoMarket — Achat & vente de voitures d'occasion" },
      { name: "twitter:description", content: "Plateforme mondiale de vente et revente de véhicules d'occasion, propulsée par l'IA." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/bd116f46-1f5e-415e-ac98-165f4c2bcc79/id-preview-08048880--9768d1ff-d0f5-4b20-b858-d28f6f662789.lovable.app-1780364239676.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/bd116f46-1f5e-415e-ac98-165f4c2bcc79/id-preview-08048880--9768d1ff-d0f5-4b20-b858-d28f6f662789.lovable.app-1780364239676.png" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthSync />
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1"><Outlet /></main>
        <Footer />
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}

function AuthSync() {
  const router = useRouter();
  const qc = useQueryClient();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
      qc.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, qc]);
  return null;
}

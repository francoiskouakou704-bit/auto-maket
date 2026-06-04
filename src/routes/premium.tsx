import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Crown, Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/lib/use-auth";
import { PLAN_LIMITS, PREMIUM_PRICE_EUR } from "@/lib/premium";
import {
  getMyPlanInfo,
  activatePremiumDemo,
  cancelPremium,
} from "@/lib/premium.functions";

export const Route = createFileRoute("/premium")({
  head: () => ({
    meta: [
      { title: "Passez à Premium — Recherche IA illimitée" },
      { name: "description", content: "Historique illimité, 500 recherches IA par jour, exports PDF/Word illimités." },
    ],
  }),
  component: PremiumPage,
});

function PremiumPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getInfo = useServerFn(getMyPlanInfo);
  const activate = useServerFn(activatePremiumDemo);
  const cancel = useServerFn(cancelPremium);

  const { data: info } = useQuery({
    queryKey: ["plan-info", user?.id],
    enabled: !!user,
    queryFn: () => getInfo(),
  });

  const activateMut = useMutation({
    mutationFn: () => activate(),
    onSuccess: () => {
      toast.success("Premium activé pour 30 jours (mode démo) 🎉");
      qc.invalidateQueries({ queryKey: ["plan-info"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const cancelMut = useMutation({
    mutationFn: () => cancel(),
    onSuccess: () => {
      toast.success("Abonnement annulé");
      qc.invalidateQueries({ queryKey: ["plan-info"] });
    },
  });

  if (loading) return <div className="container mx-auto py-20 text-center text-muted-foreground">Chargement…</div>;
  if (!user) { navigate({ to: "/auth" }); return null; }

  const isPremium = info?.plan === "premium";

  return (
    <div className="container mx-auto px-4 py-14 max-w-5xl">
      <div className="text-center mb-12">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-primary shadow-elegant mb-5">
          <Crown className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="font-display text-4xl md:text-5xl font-bold mb-3">Passez à Premium</h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Recherche IA sans limite, historique complet, exports professionnels en PDF et Word.
        </p>
      </div>

      {info && (
        <div className="mb-8 rounded-xl border border-border bg-card p-5 flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Votre plan actuel</div>
            <div className="font-display text-lg font-semibold capitalize flex items-center gap-2">
              {info.plan === "premium" ? <Crown className="h-4 w-4 text-primary" /> : <Sparkles className="h-4 w-4" />}
              {info.plan}
              {info.expiresAt && (
                <span className="text-xs text-muted-foreground font-normal">
                  jusqu'au {new Date(info.expiresAt).toLocaleDateString("fr-FR")}
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Aujourd'hui</div>
            <div className="font-semibold">{info.usedToday} / {info.dailyLimit} recherches</div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <PlanCard
          name="Free"
          price="0 €"
          highlight={!isPremium}
          features={[
            `${PLAN_LIMITS.free.dailySearches} recherches IA par jour`,
            `Historique : ${PLAN_LIMITS.free.historyKept} dernières recherches`,
            `${PLAN_LIMITS.free.exportsPerDay} exports PDF/Word par jour`,
            "Sources citées dans les réponses",
          ]}
          excluded={["Historique illimité", "Quota élargi", "Support prioritaire"]}
        />
        <PlanCard
          name="Premium"
          price={`${PREMIUM_PRICE_EUR} € / mois`}
          highlight={isPremium}
          features={[
            `${PLAN_LIMITS.premium.dailySearches} recherches IA par jour`,
            "Historique illimité",
            "Exports PDF & Word illimités",
            "Modèles IA prioritaires (à venir)",
            "Support par e-mail",
          ]}
          cta={
            isPremium ? (
              <Button variant="outline" className="w-full" onClick={() => cancelMut.mutate()} disabled={cancelMut.isPending}>
                Annuler l'abonnement
              </Button>
            ) : (
              <Button
                className="w-full bg-gradient-primary text-primary-foreground shadow-elegant"
                onClick={() => activateMut.mutate()}
                disabled={activateMut.isPending}
              >
                {activateMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Activer Premium (démo 30j)</>}
              </Button>
            )
          }
        />
      </div>

      <p className="text-center text-xs text-muted-foreground mt-8">
        Mode démo — aucun paiement n'est prélevé. Le paiement réel (Stripe ou CinetPay) sera branché ultérieurement.
      </p>

      <div className="mt-10 text-center">
        <Button asChild variant="ghost"><Link to="/history">Voir mon historique →</Link></Button>
      </div>
    </div>
  );
}

function PlanCard({
  name,
  price,
  features,
  excluded = [],
  cta,
  highlight,
}: {
  name: string;
  price: string;
  features: string[];
  excluded?: string[];
  cta?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-6 ${highlight ? "border-primary shadow-elegant bg-gradient-to-br from-primary/5 to-transparent" : "border-border bg-card"}`}>
      <div className="flex items-baseline justify-between mb-4">
        <div className="font-display text-xl font-bold">{name}</div>
        <div className="text-2xl font-bold">{price}</div>
      </div>
      <ul className="space-y-2 mb-6">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" /> {f}
          </li>
        ))}
        {excluded.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground/60">
            <X className="h-4 w-4 mt-0.5 shrink-0" /> {f}
          </li>
        ))}
      </ul>
      {cta}
    </div>
  );
}

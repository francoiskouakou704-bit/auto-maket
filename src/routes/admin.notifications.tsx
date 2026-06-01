import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Bell, Loader2 } from "lucide-react";
import {
  getMyNotificationPrefs,
  updateMyNotificationPrefs,
} from "@/lib/notification-prefs.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/use-auth";
import { useIsAdmin } from "@/lib/use-admin";

export const Route = createFileRoute("/admin/notifications")({
  head: () => ({ meta: [{ title: "Préférences notifications — Admin" }] }),
  component: NotificationsPage,
});

type Severity = "info" | "warning" | "critical";
const ALL_SEVERITIES: Severity[] = ["info", "warning", "critical"];

function NotificationsPage() {
  const { user, loading } = useAuth();
  const { data: isAdmin, isLoading: roleLoading } = useIsAdmin();
  const navigate = useNavigate();

  const fetchPrefs = useServerFn(getMyNotificationPrefs);
  const updatePrefs = useServerFn(updateMyNotificationPrefs);
  const qc = useQueryClient();

  const { data: prefs, isLoading } = useQuery({
    queryKey: ["my-notif-prefs"],
    queryFn: () => fetchPrefs(),
    enabled: !!user && isAdmin === true,
  });

  const [emailEnabled, setEmailEnabled] = useState(true);
  const [slackEnabled, setSlackEnabled] = useState(true);
  const [severities, setSeverities] = useState<Severity[]>(["critical"]);
  const [notifyResolved, setNotifyResolved] = useState(true);
  const [emailOverride, setEmailOverride] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (prefs) {
      setEmailEnabled(prefs.email_enabled);
      setSlackEnabled(prefs.slack_enabled);
      setSeverities((prefs.severities as Severity[]) ?? ["critical"]);
      setNotifyResolved(prefs.notify_on_resolved);
      setEmailOverride(prefs.email_override ?? "");
    }
  }, [prefs]);

  if (loading || roleLoading) {
    return <div className="container mx-auto py-20 text-center text-muted-foreground">Chargement…</div>;
  }
  if (!user) {
    navigate({ to: "/auth" });
    return null;
  }
  if (!isAdmin) {
    return (
      <div className="container mx-auto py-20 text-center">
        <h1 className="text-2xl font-semibold mb-2">Accès refusé</h1>
        <p className="text-muted-foreground">Vous devez être administrateur.</p>
      </div>
    );
  }

  function toggleSeverity(s: Severity, checked: boolean) {
    setSeverities((prev) =>
      checked ? Array.from(new Set([...prev, s])) : prev.filter((x) => x !== s),
    );
  }

  async function onSave() {
    setSaving(true);
    try {
      await updatePrefs({
        data: {
          email_enabled: emailEnabled,
          slack_enabled: slackEnabled,
          severities,
          notify_on_resolved: notifyResolved,
          email_override: emailOverride.trim() ? emailOverride.trim() : null,
        },
      });
      toast.success("Préférences enregistrées");
      qc.invalidateQueries({ queryKey: ["my-notif-prefs"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/admin"><ArrowLeft className="h-4 w-4 mr-1" />Admin</Link>
        </Button>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="h-6 w-6" /> Préférences de notifications
        </h1>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Mes alertes paiements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Email</Label>
                  <p className="text-sm text-muted-foreground">Recevoir un email quand une alerte correspond.</p>
                </div>
                <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base">Slack</Label>
                  <p className="text-sm text-muted-foreground">Déclencher un message dans le canal Slack configuré.</p>
                </div>
                <Switch checked={slackEnabled} onCheckedChange={setSlackEnabled} />
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t">
              <Label className="text-base">Sévérités déclenchant une alerte</Label>
              <div className="flex flex-col gap-2">
                {ALL_SEVERITIES.map((s) => (
                  <label key={s} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={severities.includes(s)}
                      onCheckedChange={(c) => toggleSeverity(s, c === true)}
                    />
                    <span className="capitalize">{s}</span>
                  </label>
                ))}
              </div>
              {severities.length === 0 && (
                <p className="text-xs text-amber-600">
                  Aucune sévérité sélectionnée : vous ne recevrez plus de notification à la création.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t">
              <div>
                <Label className="text-base">Notifier à la résolution</Label>
                <p className="text-sm text-muted-foreground">Recevoir un message quand une alerte est résolue.</p>
              </div>
              <Switch checked={notifyResolved} onCheckedChange={setNotifyResolved} />
            </div>

            <div className="space-y-2 pt-4 border-t">
              <Label htmlFor="email_override">Email override (optionnel)</Label>
              <Input
                id="email_override"
                type="email"
                placeholder="alerts@exemple.com"
                value={emailOverride}
                onChange={(e) => setEmailOverride(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Laissez vide pour utiliser l'adresse de votre compte.
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={onSave} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enregistrer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  ShieldCheck,
  AlertTriangle,
  Search,
  Filter,
  UserCheck,
  CheckCircle2,
  ArrowLeft,
  Upload,
  ExternalLink,
  Loader2,
} from "lucide-react";
import {
  listAlerts,
  assignAlert,
  resolveAlert,
  listAdmins,
} from "@/lib/payment-alerts-triage.functions";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useIsAdmin } from "@/lib/use-admin";

export const Route = createFileRoute("/admin/alerts")({
  head: () => ({ meta: [{ title: "Triage des alertes — Administration" }] }),
  component: AlertsTriagePage,
});

type Alert = {
  id: string;
  payment_id: string | null;
  alert_type: string;
  severity: "info" | "warning" | "critical" | string;
  message: string;
  details: unknown;
  status: "open" | "acknowledged" | "resolved" | string;
  assigned_to: string | null;
  assigned_at: string | null;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolution_comment: string | null;
  proof_refund_ref: string | null;
  proof_screenshot_url: string | null;
  proof_payload: unknown;
  created_at: string;
};

function severityVariant(s: string): "destructive" | "default" | "secondary" {
  if (s === "critical") return "destructive";
  if (s === "warning") return "default";
  return "secondary";
}

function AlertsTriagePage() {
  const { user, loading } = useAuth();
  const { data: isAdmin, isLoading: roleLoading } = useIsAdmin();
  const navigate = useNavigate();

  const [status, setStatus] = useState<"open" | "acknowledged" | "resolved" | "all">("open");
  const [severity, setSeverity] = useState<"info" | "warning" | "critical" | "all">("all");
  const [assignment, setAssignment] = useState<"any" | "mine" | "unassigned">("any");
  const [search, setSearch] = useState("");
  const [activeAlert, setActiveAlert] = useState<Alert | null>(null);
  const [resolveOpen, setResolveOpen] = useState(false);

  const fetchList = useServerFn(listAlerts);
  const fetchAdmins = useServerFn(listAdmins);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-alerts-triage", status, severity, assignment, search],
    enabled: !!isAdmin,
    queryFn: () =>
      fetchList({ data: { status, severity, assignment, search: search || undefined, limit: 200 } }),
  });

  const { data: adminsData } = useQuery({
    queryKey: ["admin-list"],
    enabled: !!isAdmin,
    queryFn: () => fetchAdmins(),
  });

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
        <ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h1 className="font-display text-2xl font-bold mb-2">Accès restreint</h1>
        <p className="text-muted-foreground">Cette zone est réservée aux administrateurs.</p>
      </div>
    );
  }

  const alerts = (data?.alerts ?? []) as Alert[];
  const payments = data?.payments ?? {};
  const admins = adminsData?.admins ?? [];

  return (
    <div className="container mx-auto px-4 py-10">
      <Link
        to="/admin"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Retour à l'administration
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-primary shadow-elegant">
          <AlertTriangle className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">Triage des alertes</h1>
          <p className="text-muted-foreground">
            Filtrez, assignez et résolvez les alertes paiement avec preuve
          </p>
        </div>
      </div>

      <Card className="mb-6 shadow-elegant">
        <CardContent className="p-4 grid gap-3 md:grid-cols-5">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Recherche (message, type, payment id…)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger><SelectValue placeholder="Statut" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Ouvertes</SelectItem>
              <SelectItem value="acknowledged">Prises en charge</SelectItem>
              <SelectItem value="resolved">Résolues</SelectItem>
              <SelectItem value="all">Toutes</SelectItem>
            </SelectContent>
          </Select>
          <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
            <SelectTrigger><SelectValue placeholder="Sévérité" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes sévérités</SelectItem>
              <SelectItem value="critical">Critique</SelectItem>
              <SelectItem value="warning">Avertissement</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
          <Select value={assignment} onValueChange={(v) => setAssignment(v as typeof assignment)}>
            <SelectTrigger><SelectValue placeholder="Assignation" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Toutes</SelectItem>
              <SelectItem value="mine">Les miennes</SelectItem>
              <SelectItem value="unassigned">Non assignées</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="shadow-elegant">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-10 text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Chargement des alertes…
            </div>
          ) : alerts.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Aucune alerte ne correspond à ces filtres.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sévérité</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Paiement</TableHead>
                  <TableHead>Assignée à</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Créée</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((a) => {
                  const p = a.payment_id ? payments[a.payment_id] : null;
                  const assignee = admins.find((x) => x.id === a.assigned_to);
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <Badge variant={severityVariant(a.severity)}>{a.severity}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{a.alert_type}</TableCell>
                      <TableCell className="max-w-xs truncate" title={a.message}>{a.message}</TableCell>
                      <TableCell className="text-xs">
                        {p ? (
                          <div className="space-y-0.5">
                            <div>{p.provider ?? "—"} · {p.status}</div>
                            <div className="text-muted-foreground font-mono truncate max-w-[160px]">
                              {p.provider_ref ?? a.payment_id?.slice(0, 8)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {assignee?.full_name ?? (a.assigned_to ? a.assigned_to.slice(0, 8) : <span className="text-muted-foreground">—</span>)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={a.status === "resolved" ? "secondary" : "outline"}>{a.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleString("fr-FR")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setActiveAlert(a);
                            setResolveOpen(true);
                          }}
                        >
                          Ouvrir
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TriageDialog
        open={resolveOpen}
        onOpenChange={(o) => {
          setResolveOpen(o);
          if (!o) setActiveAlert(null);
        }}
        alert={activeAlert}
        admins={admins}
        onChanged={() => refetch()}
      />
    </div>
  );
}

function TriageDialog({
  open,
  onOpenChange,
  alert,
  admins,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  alert: Alert | null;
  admins: { id: string; full_name: string | null }[];
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const assignFn = useServerFn(assignAlert);
  const resolveFn = useServerFn(resolveAlert);
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [comment, setComment] = useState("");
  const [refundRef, setRefundRef] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [providerPayload, setProviderPayload] = useState("");
  const [uploading, setUploading] = useState(false);

  // Reset when alert changes
  useMemo(() => {
    setComment(alert?.resolution_comment ?? "");
    setRefundRef(alert?.proof_refund_ref ?? "");
    setScreenshotUrl(alert?.proof_screenshot_url ?? "");
    setProviderPayload(
      alert?.proof_payload ? JSON.stringify(alert.proof_payload, null, 2) : "",
    );
  }, [alert?.id]);

  const assign = useMutation({
    mutationFn: (assignTo: string | null) => assignFn({ data: { alertId: alert!.id, assignTo } }),
    onSuccess: () => {
      toast.success("Alerte assignée");
      onChanged();
      qc.invalidateQueries({ queryKey: ["admin-alerts-triage"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resolve = useMutation({
    mutationFn: () =>
      resolveFn({
        data: {
          alertId: alert!.id,
          comment,
          refundRef: refundRef || undefined,
          screenshotUrl: screenshotUrl || undefined,
          providerPayload: providerPayload || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Alerte résolue");
      onChanged();
      qc.invalidateQueries({ queryKey: ["admin-alerts-triage"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !alert) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (max 5 Mo)");
      return;
    }
    setUploading(true);
    try {
      const path = `${alert.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
      const { error } = await supabase.storage.from("alert-proofs").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      const { data: signed } = await supabase.storage
        .from("alert-proofs")
        .createSignedUrl(path, 60 * 60 * 24 * 7);
      setScreenshotUrl(signed?.signedUrl ?? path);
      toast.success("Capture d'écran téléversée");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Échec du téléversement");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (!alert) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant={severityVariant(alert.severity)}>{alert.severity}</Badge>
            <span className="font-mono text-sm">{alert.alert_type}</span>
          </DialogTitle>
          <DialogDescription className="pt-1">{alert.message}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md bg-muted p-3 text-xs space-y-1">
            <div><span className="text-muted-foreground">Payment ID :</span> <span className="font-mono">{alert.payment_id ?? "—"}</span></div>
            <div><span className="text-muted-foreground">Statut :</span> {alert.status}</div>
            <div><span className="text-muted-foreground">Créée :</span> {new Date(alert.created_at).toLocaleString("fr-FR")}</div>
            {alert.details ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-muted-foreground">Détails</summary>
                <pre className="mt-1 overflow-auto whitespace-pre-wrap text-[10px]">{JSON.stringify(alert.details, null, 2)}</pre>
              </details>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label>Assigner à</Label>
            <div className="flex gap-2">
              <Select
                value={alert.assigned_to ?? "__none"}
                onValueChange={(v) => assign.mutate(v === "__none" ? null : v)}
                disabled={assign.isPending}
              >
                <SelectTrigger><SelectValue placeholder="Choisir un administrateur" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Non assignée</SelectItem>
                  {admins.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.full_name ?? a.id.slice(0, 8)}
                      {a.id === user?.id ? " (moi)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="secondary"
                onClick={() => assign.mutate(user!.id)}
                disabled={assign.isPending}
              >
                <UserCheck className="h-4 w-4 mr-1.5" /> Me l'attribuer
              </Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="comment">Commentaire de résolution *</Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Expliquez l'analyse et l'action menée…"
              rows={3}
              maxLength={2000}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="refundRef">Référence de remboursement</Label>
            <Input
              id="refundRef"
              value={refundRef}
              onChange={(e) => setRefundRef(e.target.value)}
              placeholder="re_xxx, refund_xxx…"
              maxLength={255}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="screenshot">Capture d'écran (preuve)</Label>
            <div className="flex gap-2">
              <Input
                id="screenshot"
                value={screenshotUrl}
                onChange={(e) => setScreenshotUrl(e.target.value)}
                placeholder="URL ou téléversez un fichier"
              />
              <Button
                type="button"
                variant="outline"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFile}
              />
            </div>
            {screenshotUrl && (
              <a
                href={screenshotUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Voir la preuve <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="payload">Payload provider (JSON ou texte)</Label>
            <Textarea
              id="payload"
              value={providerPayload}
              onChange={(e) => setProviderPayload(e.target.value)}
              placeholder='{"event": "...", "id": "..."}'
              rows={5}
              className="font-mono text-xs"
              maxLength={20000}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
          <Button
            onClick={() => resolve.mutate()}
            disabled={resolve.isPending || comment.trim().length < 3}
          >
            {resolve.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
            )}
            Résoudre l'alerte
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

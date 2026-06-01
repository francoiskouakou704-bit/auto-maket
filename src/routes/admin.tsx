import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Users,
  Car,
  CreditCard,
  Flag,
  ShieldCheck,
  Trash2,
  Eye,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { useIsAdmin } from "@/lib/use-admin";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Administration — AutoMarket" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { user, loading } = useAuth();
  const { data: isAdmin, isLoading: roleLoading } = useIsAdmin();
  const navigate = useNavigate();

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

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-primary shadow-elegant">
          <ShieldCheck className="h-6 w-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">Administration</h1>
          <p className="text-muted-foreground">Gestion globale de la plateforme</p>
        </div>
      </div>

      <AdminStats />

      <Tabs defaultValue="users" className="mt-8">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 max-w-2xl">
          <TabsTrigger value="users"><Users className="h-4 w-4 mr-1.5" />Utilisateurs</TabsTrigger>
          <TabsTrigger value="vehicles"><Car className="h-4 w-4 mr-1.5" />Annonces</TabsTrigger>
          <TabsTrigger value="payments"><CreditCard className="h-4 w-4 mr-1.5" />Paiements</TabsTrigger>
          <TabsTrigger value="reports"><Flag className="h-4 w-4 mr-1.5" />Signalements</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-6"><UsersPanel /></TabsContent>
        <TabsContent value="vehicles" className="mt-6"><VehiclesPanel /></TabsContent>
        <TabsContent value="payments" className="mt-6"><PaymentsPanel /></TabsContent>
        <TabsContent value="reports" className="mt-6"><ReportsPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

function AdminStats() {
  const { data } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [users, vehicles, payments, reports] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("vehicles").select("id", { count: "exact", head: true }),
        supabase.from("payments").select("id", { count: "exact", head: true }),
        supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      return {
        users: users.count ?? 0,
        vehicles: vehicles.count ?? 0,
        payments: payments.count ?? 0,
        pendingReports: reports.count ?? 0,
      };
    },
  });

  const items = [
    { label: "Utilisateurs", value: data?.users ?? 0, icon: Users },
    { label: "Annonces", value: data?.vehicles ?? 0, icon: Car },
    { label: "Paiements", value: data?.payments ?? 0, icon: CreditCard },
    { label: "Signalements en attente", value: data?.pendingReports ?? 0, icon: Flag },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {items.map((s) => (
        <Card key={s.label} className="shadow-elegant">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="font-display text-3xl font-bold mt-1">{s.value}</p>
            </div>
            <s.icon className="h-8 w-8 text-primary/60" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function UsersPanel() {
  const qc = useQueryClient();
  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,full_name,account_type,country,city,created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const { data: roles } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("user_id,role");
      return data ?? [];
    },
  });

  const roleFor = (id: string) =>
    roles?.find((r) => r.user_id === id)?.role ?? "user";

  async function changeRole(userId: string, newRole: "user" | "dealer" | "admin") {
    const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (delErr) return toast.error(delErr.message);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
    if (error) return toast.error(error.message);
    toast.success("Rôle mis à jour");
    qc.invalidateQueries({ queryKey: ["admin-roles"] });
  }

  return (
    <Card className="shadow-elegant">
      <CardHeader><CardTitle>Utilisateurs ({users?.length ?? 0})</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Localisation</TableHead>
              <TableHead>Inscription</TableHead>
              <TableHead>Rôle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.full_name ?? "—"}</TableCell>
                <TableCell><Badge variant="outline">{u.account_type}</Badge></TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {[u.city, u.country].filter(Boolean).join(", ") || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(u.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Select value={roleFor(u.id)} onValueChange={(v) => changeRole(u.id, v as "user" | "dealer" | "admin")}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="dealer">Dealer</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function VehiclesPanel() {
  const qc = useQueryClient();
  const { data: vehicles } = useQuery({
    queryKey: ["admin-vehicles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vehicles")
        .select("id,title,brand,model,year,price,currency,status,featured,seller_id,created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  async function setStatus(id: string, status: "published" | "draft" | "sold" | "archived") {
    const { error } = await supabase.from("vehicles").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Statut mis à jour");
    qc.invalidateQueries({ queryKey: ["admin-vehicles"] });
  }

  async function toggleFeatured(id: string, featured: boolean) {
    const { error } = await supabase.from("vehicles").update({ featured: !featured }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-vehicles"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Annonce supprimée");
    qc.invalidateQueries({ queryKey: ["admin-vehicles"] });
  }

  return (
    <Card className="shadow-elegant">
      <CardHeader><CardTitle>Annonces ({vehicles?.length ?? 0})</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Annonce</TableHead>
              <TableHead>Prix</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Mise en avant</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vehicles?.map((v) => (
              <TableRow key={v.id}>
                <TableCell>
                  <div className="font-medium">{v.title}</div>
                  <div className="text-xs text-muted-foreground">{v.brand} {v.model} • {v.year}</div>
                </TableCell>
                <TableCell>{Number(v.price).toLocaleString()} {v.currency}</TableCell>
                <TableCell>
                  <Select value={v.status} onValueChange={(s) => setStatus(v.id, s as "published" | "draft" | "sold" | "archived")}>
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="published">Publiée</SelectItem>
                      <SelectItem value="draft">Brouillon</SelectItem>
                      <SelectItem value="sold">Vendue</SelectItem>
                      <SelectItem value="archived">Archivée</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Button size="sm" variant={v.featured ? "default" : "outline"} onClick={() => toggleFeatured(v.id, !!v.featured)}>
                    {v.featured ? "Oui" : "Non"}
                  </Button>
                </TableCell>
                <TableCell className="text-right">
                  <Button size="icon" variant="ghost" asChild>
                    <a href={`/vehicles/${v.id}`} target="_blank" rel="noreferrer"><Eye className="h-4 w-4" /></a>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer cette annonce ?</AlertDialogTitle>
                        <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(v.id)}>Supprimer</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PaymentsPanel() {
  const qc = useQueryClient();
  const { data: payments } = useQuery({
    queryKey: ["admin-payments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  async function setStatus(id: string, status: "pending" | "succeeded" | "failed" | "refunded") {
    const { error } = await supabase.from("payments").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Paiement mis à jour");
    qc.invalidateQueries({ queryKey: ["admin-payments"] });
  }

  const statusColor: Record<string, string> = {
    pending: "bg-yellow-500/15 text-yellow-700",
    succeeded: "bg-green-500/15 text-green-700",
    failed: "bg-red-500/15 text-red-700",
    refunded: "bg-blue-500/15 text-blue-700",
  };

  return (
    <Card className="shadow-elegant">
      <CardHeader><CardTitle>Paiements ({payments?.length ?? 0})</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Fournisseur</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments?.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun paiement enregistré</TableCell></TableRow>
            )}
            {payments?.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-sm">{new Date(p.created_at).toLocaleString()}</TableCell>
                <TableCell><Badge variant="outline">{p.kind}</Badge></TableCell>
                <TableCell className="font-medium">{Number(p.amount).toLocaleString()} {p.currency}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.provider ?? "—"}</TableCell>
                <TableCell><Badge className={statusColor[p.status]}>{p.status}</Badge></TableCell>
                <TableCell className="text-right">
                  <Select value={p.status} onValueChange={(s) => setStatus(p.id, s as "pending" | "succeeded" | "failed" | "refunded")}>
                    <SelectTrigger className="w-32 ml-auto"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="succeeded">Succeeded</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="refunded">Refunded</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ReportsPanel() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [filter, setFilter] = useState<string>("all");

  const { data: reports } = useQuery({
    queryKey: ["admin-reports", filter],
    queryFn: async () => {
      let q = supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(200);
      if (filter !== "all") q = q.eq("status", filter as "pending" | "reviewing" | "resolved" | "dismissed");
      const { data } = await q;
      return data ?? [];
    },
  });

  async function resolve(id: string, status: "reviewing" | "resolved" | "dismissed") {
    const { error } = await supabase
      .from("reports")
      .update({ status, reviewed_by: user!.id, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Signalement traité");
    qc.invalidateQueries({ queryKey: ["admin-reports"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
  }

  const statusColor: Record<string, string> = {
    pending: "bg-yellow-500/15 text-yellow-700",
    reviewing: "bg-blue-500/15 text-blue-700",
    resolved: "bg-green-500/15 text-green-700",
    dismissed: "bg-muted text-muted-foreground",
  };

  return (
    <Card className="shadow-elegant">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Signalements ({reports?.length ?? 0})</CardTitle>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="reviewing">En cours</SelectItem>
            <SelectItem value="resolved">Résolus</SelectItem>
            <SelectItem value="dismissed">Rejetés</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Annonce</TableHead>
              <TableHead>Motif</TableHead>
              <TableHead>Détails</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports?.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun signalement</TableCell></TableRow>
            )}
            {reports?.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-sm whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</TableCell>
                <TableCell>
                  <Button asChild size="sm" variant="link" className="p-0 h-auto">
                    <a href={`/vehicles/${r.vehicle_id}`} target="_blank" rel="noreferrer">Voir l'annonce</a>
                  </Button>
                </TableCell>
                <TableCell><Badge variant="outline">{r.reason}</Badge></TableCell>
                <TableCell className="max-w-xs text-sm text-muted-foreground truncate">{r.details ?? "—"}</TableCell>
                <TableCell><Badge className={statusColor[r.status]}>{r.status}</Badge></TableCell>
                <TableCell className="text-right space-x-1">
                  {r.status !== "resolved" && (
                    <Button size="icon" variant="ghost" title="Marquer résolu" onClick={() => resolve(r.id, "resolved")}>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </Button>
                  )}
                  {r.status !== "dismissed" && (
                    <Button size="icon" variant="ghost" title="Rejeter" onClick={() => resolve(r.id, "dismissed")}>
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

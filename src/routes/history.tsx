import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Crown, FileDown, FileText, History, Loader2, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuth } from "@/lib/use-auth";
import { listMyHistory, deleteHistoryItem } from "@/lib/premium.functions";
import { exportSynthesis } from "@/lib/export-client";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "Historique de recherches — AutoMarket" }] }),
  component: HistoryPage,
});

function HistoryPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useServerFn(listMyHistory);
  const del = useServerFn(deleteHistoryItem);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["search-history", user?.id],
    enabled: !!user,
    queryFn: () => list(),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["search-history"] }),
  });

  if (loading) return <div className="container mx-auto py-20 text-center text-muted-foreground">Chargement…</div>;
  if (!user) { navigate({ to: "/auth" }); return null; }

  const items = data?.items ?? [];
  const isFree = data?.plan === "free";

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <History className="h-7 w-7 text-primary" /> Historique de recherches
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {isFree ? `Les ${items.length} dernières recherches (plan Free)` : `${items.length} recherche(s) enregistrée(s)`}
          </p>
        </div>
        {isFree && (
          <Button asChild className="bg-gradient-primary text-primary-foreground shadow-elegant">
            <Link to="/premium"><Crown className="h-4 w-4 mr-1" /> Passez à Premium</Link>
          </Button>
        )}
      </div>

      {isLoading && <div className="text-muted-foreground">Chargement…</div>}
      {!isLoading && items.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          Aucune recherche enregistrée pour le moment.
          <div className="mt-4">
            <Button asChild variant="outline"><Link to="/search">Lancer une recherche</Link></Button>
          </div>
        </div>
      )}

      <ul className="space-y-3">
        {items.map((item) => {
          const open = openId === item.id;
          const sources = (item.sources as { title: string; url: string }[]) ?? [];
          return (
            <li key={item.id} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="p-4 flex items-start justify-between gap-3">
                <button
                  className="text-left flex-1 min-w-0"
                  onClick={() => setOpenId(open ? null : item.id)}
                >
                  <div className="font-medium truncate">{item.query}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {new Date(item.created_at).toLocaleString("fr-FR")} · {sources.length} source(s)
                  </div>
                </button>
                <div className="flex items-center gap-1 shrink-0">
                  <ExportButtons query={item.query} synthesis={item.synthesis ?? ""} sources={sources} />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => delMut.mutate(item.id)}
                    disabled={delMut.isPending}
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
              {open && item.synthesis && (
                <div className="border-t border-border bg-background/50 p-4">
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.synthesis}</ReactMarkdown>
                  </div>
                  {sources.length > 0 && (
                    <div className="mt-4 text-xs text-muted-foreground">
                      <div className="font-semibold mb-1">Sources</div>
                      <ol className="space-y-0.5">
                        {sources.map((s, i) => (
                          <li key={i}>
                            <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                              [{i + 1}] {s.title}
                            </a>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ExportButtons({
  query,
  synthesis,
  sources,
}: {
  query: string;
  synthesis: string;
  sources: { title: string; url: string }[];
}) {
  const [busy, setBusy] = useState<"pdf" | "docx" | null>(null);
  const run = async (format: "pdf" | "docx") => {
    if (!synthesis) return toast.error("Aucune synthèse à exporter");
    setBusy(format);
    try {
      await exportSynthesis({ format, query, synthesis, sources });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => run("pdf")} disabled={!!busy} title="Exporter en PDF">
        {busy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      </Button>
      <Button variant="ghost" size="icon" onClick={() => run("docx")} disabled={!!busy} title="Exporter en Word">
        {busy === "docx" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
      </Button>
    </>
  );
}

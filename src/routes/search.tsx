import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, ExternalLink, Loader2, Search, Send, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { webSearch, type SearchResult } from "@/lib/search.functions";

type SearchSchema = { q?: string };

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Recherche IA — Moteur intelligent" },
      { name: "description", content: "Recherche web augmentée par l'IA : résultats classiques + synthèse conversationnelle." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): SearchSchema => ({
    q: typeof s.q === "string" ? s.q : undefined,
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate({ from: "/search" });
  const [input, setInput] = useState(q ?? "");

  useEffect(() => {
    setInput(q ?? "");
  }, [q]);

  const search = useServerFn(webSearch);
  const { data, isFetching, error } = useQuery({
    queryKey: ["web-search", q],
    enabled: !!q,
    staleTime: 1000 * 60 * 5,
    queryFn: () => search({ data: { query: q!, limit: 8 } }),
  });

  const results: SearchResult[] = data?.results ?? [];

  return (
    <div className="min-h-screen">
      {/* Search bar */}
      <div className="border-b border-border/40 bg-background/80 backdrop-blur sticky top-16 z-40">
        <div className="container mx-auto px-4 py-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = input.trim();
              if (v) navigate({ search: { q: v } });
            }}
            className="flex gap-2 max-w-3xl"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Rechercher sur le web…"
                className="pl-10 h-11"
                autoFocus
              />
            </div>
            <Button type="submit" className="h-11 bg-gradient-primary text-primary-foreground shadow-elegant">
              Rechercher <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>

      {!q ? (
        <EmptyState onPick={(v) => navigate({ search: { q: v } })} />
      ) : (
        <div className="container mx-auto px-4 py-8 grid lg:grid-cols-[1fr_440px] gap-8">
          {/* Results column */}
          <div>
            <h2 className="font-display text-lg font-semibold mb-4">
              Résultats web {results.length > 0 && <span className="text-muted-foreground text-sm font-normal">— {results.length}</span>}
            </h2>
            {isFetching && (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            )}
            {error && (
              <div className="text-sm text-destructive">Erreur de recherche : {String((error as Error).message)}</div>
            )}
            {!isFetching && results.length === 0 && !error && (
              <div className="text-sm text-muted-foreground">Aucun résultat.</div>
            )}
            <ul className="space-y-6">
              {results.map((r, i) => (
                <li key={r.url} className="group">
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="block">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary font-medium">{i + 1}</span>
                      <span className="truncate">{safeHost(r.url)}</span>
                      <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
                    </div>
                    <h3 className="font-medium text-base text-foreground group-hover:text-primary transition-smooth">
                      {r.title}
                    </h3>
                    {r.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{r.description}</p>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* AI column */}
          <aside className="lg:sticky lg:top-36 lg:self-start lg:max-h-[calc(100vh-10rem)]">
            <AiAssistant query={q} sources={results} ready={!isFetching && results.length > 0} />
          </aside>
        </div>
      )}
    </div>
  );
}

function safeHost(u: string) {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}

function EmptyState({ onPick }: { onPick: (v: string) => void }) {
  const samples = [
    "Qui a inventé Internet ?",
    "Compare Tesla Model S et Porsche Taycan",
    "Dernières avancées en fusion nucléaire",
    "Meilleures destinations à visiter en 2026",
  ];
  return (
    <div className="container mx-auto px-4 py-24 text-center">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-primary shadow-elegant mb-6">
        <Sparkles className="h-8 w-8 text-primary-foreground" />
      </div>
      <h1 className="font-display text-4xl md:text-5xl font-bold mb-3">Recherche augmentée par l'IA</h1>
      <p className="text-muted-foreground max-w-xl mx-auto mb-10">
        Tapez une question. Obtenez des résultats web et une réponse synthétique générée par l'IA, avec sources citées.
      </p>
      <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
        {samples.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="px-4 py-2 rounded-full border border-border text-sm hover:bg-accent hover:border-primary/30 transition-smooth"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function AiAssistant({
  query,
  sources,
  ready,
}: {
  query: string;
  sources: SearchResult[];
  ready: boolean;
}) {
  const transport = useRef(new DefaultChatTransport({ api: "/api/search-chat" }));
  const sourcesRef = useRef(sources);
  const queryRef = useRef(query);
  sourcesRef.current = sources;
  queryRef.current = query;

  const { messages, sendMessage, status, setMessages } = useChat({
    id: `search-${query}`,
    transport: transport.current,
  });

  // Auto-ask the initial synthesis question when sources are ready
  const autoAskedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    if (autoAskedFor.current === query) return;
    autoAskedFor.current = query;
    setMessages([]);
    sendMessage(
      { text: query },
      {
        body: {
          sources: sourcesRef.current.map((s) => ({
            title: s.title,
            url: s.url,
            description: s.description,
          })),
          query: queryRef.current,
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, query]);

  const [input, setInput] = useState("");
  const isLoading = status === "submitted" || status === "streaming";
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-card flex flex-col h-[calc(100vh-10rem)] overflow-hidden">
      <div className="px-5 py-3 border-b border-border flex items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-gradient-primary flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-primary-foreground" />
        </div>
        <div>
          <div className="font-medium text-sm">Assistant IA</div>
          <div className="text-xs text-muted-foreground">Synthèse avec sources citées</div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {!ready && (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> En attente des résultats web…
          </div>
        )}
        {messages.map((m) => {
          const text = m.parts
            .map((p) => (p.type === "text" ? p.text : ""))
            .join("");
          if (m.role === "user") {
            return (
              <div key={m.id} className="flex justify-end">
                <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2 text-sm max-w-[85%]">
                  {text}
                </div>
              </div>
            );
          }
          return (
            <div key={m.id} className="text-sm">
              <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-display">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{text || "…"}</ReactMarkdown>
              </div>
            </div>
          );
        })}
        {status === "submitted" && (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Réflexion…
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = input.trim();
          if (!v || isLoading) return;
          setInput("");
          sendMessage(
            { text: v },
            {
              body: {
                sources: sourcesRef.current.map((s) => ({
                  title: s.title,
                  url: s.url,
                  description: s.description,
                })),
                query: queryRef.current,
              },
            },
          );
        }}
        className="border-t border-border p-3 flex gap-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Posez une question de suivi…"
          disabled={!ready}
          className="h-10"
        />
        <Button type="submit" size="icon" disabled={!ready || isLoading || !input.trim()}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}

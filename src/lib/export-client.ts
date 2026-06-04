// Calls /api/export with a per-request nonce (anti-replay) and the saved
// search-history id when available (server enforces ownership via that id,
// or falls back to user_id + exact query lookup). The server fetches the
// synthesis and sources from the DB — the client never sends them.
import { supabase } from "@/integrations/supabase/client";

function makeNonce(): string {
  try {
    const c = (globalThis as { crypto?: Crypto }).crypto;
    if (c?.randomUUID) return c.randomUUID();
    if (c?.getRandomValues) {
      const buf = new Uint8Array(18);
      c.getRandomValues(buf);
      return Array.from(buf, (b) => b.toString(36).padStart(2, "0")).join("");
    }
  } catch {/* ignore */}
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

export async function exportSynthesis(input: {
  format: "pdf" | "docx";
  query: string;
  historyId?: string;
}): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Vous devez être connecté pour exporter.");

  const res = await fetch("/api/export", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      format: input.format,
      query: input.query,
      historyId: input.historyId,
      nonce: makeNonce(),
    }),
  });
  if (!res.ok) {
    let msg = `Échec export (${res.status})`;
    try {
      const j = await res.json();
      if (j?.error === "replay_detected") msg = "Export déjà effectué (anti-rejeu).";
      else if (j?.error === "rate_limited") msg = "Trop d'exports en peu de temps. Réessayez dans une minute.";
      else if (j?.error === "forbidden") msg = "Vous n'êtes pas propriétaire de cette synthèse.";
      else if (j?.error === "not_found") msg = j.message ?? "Synthèse introuvable.";
      else if (j?.message) msg = j.message;
    } catch {/* ignore */}
    throw new Error(msg);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const safe = input.query.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60) || "recherche";
  const a = document.createElement("a");
  a.href = url;
  a.download = `synthese-${safe}.${input.format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Helper to call the /api/export endpoint and trigger a browser download.
// Uses Supabase session bearer token for auth.
import { supabase } from "@/integrations/supabase/client";

export async function exportSynthesis(input: {
  format: "pdf" | "docx";
  query: string;
  synthesis: string;
  sources: { title: string; url: string }[];
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
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Échec export (${res.status}) ${txt}`);
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

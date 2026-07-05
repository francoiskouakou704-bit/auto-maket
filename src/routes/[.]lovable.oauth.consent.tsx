import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Local typed shim: supabase.auth.oauth is beta and may be absent from types.
type OAuthNS = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};
function oauthNS(): OAuthNS {
  return (supabase.auth as unknown as { oauth: OAuthNS }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthNS().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="container mx-auto px-4 py-16 max-w-lg">
      Could not load this authorization request: {String((error as Error)?.message ?? error)}
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData() as any;
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    const ns = oauthNS();
    const { data, error } = approve
      ? await ns.approveAuthorization(authorization_id)
      : await ns.denyAuthorization(authorization_id);
    if (error) { setBusy(false); setError(error.message); return; }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); setError("No redirect returned by the authorization server."); return; }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "an app";
  return (
    <main className="container mx-auto px-4 py-16 max-w-lg">
      <Card className="p-8 space-y-5">
        <h1 className="font-display text-2xl font-bold">Connect {clientName} to Auto Market</h1>
        <p className="text-sm text-muted-foreground">
          {clientName} is requesting access to your Auto Market account. It will be able to use the app's
          MCP tools on your behalf, including reading and updating your own vehicle listings.
        </p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-3">
          <Button disabled={busy} onClick={() => decide(true)} className="flex-1">Approve</Button>
          <Button disabled={busy} onClick={() => decide(false)} variant="outline" className="flex-1">Deny</Button>
        </div>
      </Card>
    </main>
  );
}

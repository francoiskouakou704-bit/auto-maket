/**
 * Channel-agnostic notification helper for payment alerts.
 *
 * Sends to Slack via the Lovable connector gateway (if SLACK_API_KEY +
 * SLACK_ALERT_CHANNEL are set) and/or to admin emails via the Lovable Email
 * queue (if APP_ADMIN_EMAILS is set and email infra is configured).
 *
 * All sends are best-effort and never throw — failure is logged so it doesn't
 * break the calling write path.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type AlertEvent = {
  type: "created" | "resolved";
  alertId: string;
  alertType: string;
  severity: "info" | "warning" | "critical" | string;
  message: string;
  paymentId: string | null;
  resolvedBy?: string | null;
  comment?: string | null;
  refundRef?: string | null;
};

function getBaseUrl(): string {
  return (
    process.env.APP_BASE_URL ||
    process.env.PUBLIC_APP_URL ||
    "https://project--9768d1ff-d0f5-4b20-b858-d28f6f662789.lovable.app"
  );
}

function triageUrl(alertId: string): string {
  return `${getBaseUrl().replace(/\/$/, "")}/admin/alerts?focus=${alertId}`;
}

function severityEmoji(sev: string): string {
  if (sev === "critical") return "🚨";
  if (sev === "warning") return "⚠️";
  return "ℹ️";
}

function composeText(e: AlertEvent): { title: string; body: string; url: string } {
  const url = triageUrl(e.alertId);
  if (e.type === "created") {
    return {
      title: `${severityEmoji(e.severity)} Nouvelle alerte paiement (${e.severity})`,
      body:
        `Type : ${e.alertType}\n` +
        `Message : ${e.message}\n` +
        (e.paymentId ? `Paiement : ${e.paymentId}\n` : "") +
        `\nOuvrir le triage : ${url}`,
      url,
    };
  }
  return {
    title: `✅ Alerte résolue (${e.alertType})`,
    body:
      `${e.message}\n` +
      (e.comment ? `\nCommentaire : ${e.comment}\n` : "") +
      (e.refundRef ? `Référence remboursement : ${e.refundRef}\n` : "") +
      `\nVoir la fiche : ${url}`,
    url,
  };
}

async function sendSlack(e: AlertEvent): Promise<{ sent: boolean; error?: string }> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const slackKey = process.env.SLACK_API_KEY;
  const channel = process.env.SLACK_ALERT_CHANNEL;
  if (!lovableKey || !slackKey || !channel) {
    return { sent: false, error: "slack_not_configured" };
  }
  const { title, body, url } = composeText(e);
  try {
    const res = await fetch(
      "https://connector-gateway.lovable.dev/slack/api/chat.postMessage",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": slackKey,
        },
        body: JSON.stringify({
          channel,
          text: `${title}\n${body}`,
          blocks: [
            { type: "header", text: { type: "plain_text", text: title } },
            { type: "section", text: { type: "mrkdwn", text: "```" + body + "```" } },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: { type: "plain_text", text: "Ouvrir le triage" },
                  url,
                  style: e.severity === "critical" ? "danger" : "primary",
                },
              ],
            },
          ],
        }),
      },
    );
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || !json.ok) {
      const err = json.error ?? `http_${res.status}`;
      console.error("[alert-notify][slack] failed", err);
      return { sent: false, error: err };
    }
    return { sent: true };
  } catch (err) {
    console.error("[alert-notify][slack] exception", err);
    return { sent: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

type AdminPref = {
  user_id: string;
  email_enabled: boolean;
  slack_enabled: boolean;
  severities: string[];
  notify_on_resolved: boolean;
  email_override: string | null;
};

async function loadAdminPreferences(): Promise<AdminPref[]> {
  try {
    const { data, error } = await (supabaseAdmin as unknown as {
      from: (t: string) => {
        select: (s: string) => Promise<{ data: AdminPref[] | null; error: { message: string } | null }>;
      };
    })
      .from("admin_notification_preferences")
      .select("user_id, email_enabled, slack_enabled, severities, notify_on_resolved, email_override");
    if (error) {
      console.warn("[alert-notify] prefs load failed", error.message);
      return [];
    }
    return data ?? [];
  } catch (err) {
    console.warn("[alert-notify] prefs exception", err);
    return [];
  }
}

async function resolveAdminEmail(userId: string): Promise<string | null> {
  try {
    const auth = (supabaseAdmin as unknown as {
      auth: { admin: { getUserById: (id: string) => Promise<{ data: { user: { email: string | null } | null } | null }> } };
    }).auth;
    const { data } = await auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  } catch {
    return null;
  }
}

function prefMatches(p: AdminPref, e: AlertEvent): boolean {
  if (e.type === "resolved" && !p.notify_on_resolved) return false;
  if (e.type === "created" && !p.severities.includes(e.severity)) return false;
  return true;
}

async function sendSlack(e: AlertEvent): Promise<{ sent: boolean; error?: string }> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const slackKey = process.env.SLACK_API_KEY;
  const channel = process.env.SLACK_ALERT_CHANNEL;
  if (!lovableKey || !slackKey || !channel) {
    return { sent: false, error: "slack_not_configured" };
  }
  const { title, body, url } = composeText(e);
  try {
    const res = await fetch(
      "https://connector-gateway.lovable.dev/slack/api/chat.postMessage",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": slackKey,
        },
        body: JSON.stringify({
          channel,
          text: `${title}\n${body}`,
          blocks: [
            { type: "header", text: { type: "plain_text", text: title } },
            { type: "section", text: { type: "mrkdwn", text: "```" + body + "```" } },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: { type: "plain_text", text: "Ouvrir le triage" },
                  url,
                  style: e.severity === "critical" ? "danger" : "primary",
                },
              ],
            },
          ],
        }),
      },
    );
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || !json.ok) {
      const err = json.error ?? `http_${res.status}`;
      console.error("[alert-notify][slack] failed", err);
      return { sent: false, error: err };
    }
    return { sent: true };
  } catch (err) {
    console.error("[alert-notify][slack] exception", err);
    return { sent: false, error: err instanceof Error ? err.message : "unknown" };
  }
}

async function sendEmails(
  e: AlertEvent,
  recipients: string[],
): Promise<{ sent: number; error?: string }> {
  if (recipients.length === 0) return { sent: 0, error: "no_recipients" };
  const { title, body, url } = composeText(e);
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a;">
      <h2 style="margin:0 0 12px;">${title}</h2>
      <pre style="background:#f1f5f9;padding:12px;border-radius:8px;white-space:pre-wrap;font-family:inherit;font-size:14px;">${body
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")}</pre>
      <p style="margin-top:16px;">
        <a href="${url}" style="background:#1e3a8a;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block;">Ouvrir le triage</a>
      </p>
    </div>
  `.trim();

  let sent = 0;
  for (const to of recipients) {
    try {
      const rpc = (supabaseAdmin as unknown as {
        rpc: (name: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      }).rpc;
      const { error } = await rpc("enqueue_email", {
        p_queue: "transactional_emails",
        p_payload: {
          template_name: "payment-alert",
          to,
          subject: title,
          html,
          text: `${title}\n\n${body}`,
        },
      });
      if (error) {
        console.warn("[alert-notify][email] enqueue failed for", to, error.message);
        continue;
      }
      sent += 1;
    } catch (err) {
      console.warn("[alert-notify][email] exception", err);
    }
  }
  return { sent };
}

export async function notifyAlertEvent(e: AlertEvent) {
  const prefs = await loadAdminPreferences();
  const matching = prefs.filter((p) => prefMatches(p, e));

  // Slack fires once if any matching admin has slack_enabled.
  // Fallback: if NO preferences exist at all, keep legacy behavior
  // (critical creations + all resolutions) so the system still alerts.
  const legacyFallback =
    prefs.length === 0 &&
    ((e.type === "created" && e.severity === "critical") || e.type === "resolved");

  const shouldSlack = matching.some((p) => p.slack_enabled) || legacyFallback;

  // Email recipients: per-admin opt-in
  const emailRecipients: string[] = [];
  for (const p of matching) {
    if (!p.email_enabled) continue;
    const addr = p.email_override ?? (await resolveAdminEmail(p.user_id));
    if (addr) emailRecipients.push(addr);
  }
  if (legacyFallback && emailRecipients.length === 0) {
    const fallback = (process.env.APP_ADMIN_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    emailRecipients.push(...fallback);
  }

  const [slack, email] = await Promise.all([
    shouldSlack ? sendSlack(e) : Promise.resolve({ sent: false }),
    emailRecipients.length > 0 ? sendEmails(e, emailRecipients) : Promise.resolve({ sent: 0 }),
  ]);

  if (!(slack as { sent: boolean }).sent && (email as { sent: number }).sent === 0) {
    console.info(
      `[alert-notify] event=${e.type} severity=${e.severity} alert=${e.alertId} — no channel delivered`,
    );
  }
  return { slack, email, matchedAdmins: matching.length };
}


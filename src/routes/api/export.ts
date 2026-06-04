import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  Document,
  Packer,
  Paragraph,
  HeadingLevel,
  TextRun,
  ExternalHyperlink,
  AlignmentType,
} from "docx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const NONCE_RE = /^[A-Za-z0-9_-]{16,128}$/;
const DEFAULT_RATE_LIMIT_PER_MIN = 10;

const Schema = z.object({
  format: z.enum(["pdf", "docx"]),
  nonce: z.string().regex(NONCE_RE, "invalid nonce"),
  historyId: z.string().uuid().optional(),
  query: z.string().min(1).max(500).optional(),
});

export const Route = createFileRoute("/api/export")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.toLowerCase().startsWith("bearer ")
          ? authHeader.slice(7)
          : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: userRes } = await supabaseAdmin.auth.getUser(token);
        const user = userRes?.user;
        if (!user) return new Response("Unauthorized", { status: 401 });
        const userId = user.id;

        let parsed: z.infer<typeof Schema>;
        try {
          parsed = Schema.parse(await request.json());
        } catch (e) {
          return new Response(JSON.stringify({ error: "invalid_input", details: String((e as Error).message) }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { format, nonce, historyId, query: rawQuery } = parsed;
        const ip =
          request.headers.get("cf-connecting-ip") ??
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          null;
        const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;

        // ---- Anti-replay: reserve the nonce (unique per user). ----
        const { error: nonceErr } = await supabaseAdmin
          .from("export_logs")
          .insert({
            user_id: userId,
            history_id: historyId ?? null,
            format,
            nonce,
            query: rawQuery ?? null,
            ip,
            user_agent: userAgent,
            success: false,
            error: "pending",
          });
        if (nonceErr) {
          const code = (nonceErr as { code?: string }).code;
          if (code === "23505") {
            await supabaseAdmin.from("export_replay_attempts").insert({
              user_id: userId,
              nonce,
              ip,
              user_agent: userAgent,
            });
            return new Response(JSON.stringify({ error: "replay_detected" }), {
              status: 409,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ error: "log_failed" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const finalize = async (ok: boolean, errMsg?: string) => {
          await supabaseAdmin
            .from("export_logs")
            .update({ success: ok, error: ok ? null : (errMsg ?? "error").slice(0, 500) })
            .eq("user_id", userId)
            .eq("nonce", nonce);
        };

        // ---- Rate limit: 10 exports / 60s per user. ----
        const since = new Date(Date.now() - 60_000).toISOString();
        const { count: recent } = await supabaseAdmin
          .from("export_logs")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("created_at", since);
        if ((recent ?? 0) > RATE_LIMIT_PER_MIN) {
          await finalize(false, "rate_limited");
          return new Response(JSON.stringify({ error: "rate_limited", limit: RATE_LIMIT_PER_MIN }), {
            status: 429,
            headers: { "Content-Type": "application/json", "Retry-After": "60" },
          });
        }

        // ---- Ownership: resolve synthesis & sources from DB, NEVER trust client. ----
        let row:
          | { id: string; query: string; synthesis: string | null; sources: unknown }
          | null = null;

        if (historyId) {
          const { data } = await supabaseAdmin
            .from("search_history")
            .select("id, query, synthesis, sources, user_id")
            .eq("id", historyId)
            .maybeSingle();
          if (!data || data.user_id !== userId) {
            await finalize(false, "forbidden_history");
            return new Response(JSON.stringify({ error: "forbidden" }), {
              status: 403,
              headers: { "Content-Type": "application/json" },
            });
          }
          row = data;
        } else if (rawQuery) {
          const { data } = await supabaseAdmin
            .from("search_history")
            .select("id, query, synthesis, sources")
            .eq("user_id", userId)
            .eq("query", rawQuery)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          row = data ?? null;
        }

        if (!row || !row.synthesis) {
          await finalize(false, "not_found");
          return new Response(JSON.stringify({ error: "not_found", message: "Synthèse introuvable ou non enregistrée." }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (!historyId) {
          await supabaseAdmin
            .from("export_logs")
            .update({ history_id: row.id })
            .eq("user_id", userId)
            .eq("nonce", nonce);
        }

        const query = row.query;
        const synthesis = row.synthesis;
        const sources = Array.isArray(row.sources)
          ? (row.sources as { title?: unknown; url?: unknown }[])
              .filter((s) => s && typeof s.url === "string")
              .slice(0, 20)
              .map((s) => ({
                title: typeof s.title === "string" ? s.title.slice(0, 500) : "",
                url: (s.url as string).slice(0, 2000),
              }))
          : [];

        const safeName = query.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60) || "recherche";
        const filename = `synthese-${safeName}.${format}`;

        try {
          if (format === "docx") {
            const bytes = await buildDocx(query, synthesis, sources);
            await finalize(true);
            return new Response(bytes as unknown as ArrayBuffer, {
              status: 200,
              headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Cache-Control": "no-store",
              },
            });
          }
          const pdfBytes = await buildPdf(query, synthesis, sources);
          await finalize(true);
          return new Response(pdfBytes as unknown as ArrayBuffer, {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="${filename}"`,
              "Cache-Control": "no-store",
            },
          });
        } catch (e) {
          await finalize(false, (e as Error).message);
          return new Response(JSON.stringify({ error: "generation_failed" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});

// -------- DOCX --------
async function buildDocx(
  query: string,
  synthesis: string,
  sources: { title: string; url: string }[],
): Promise<Uint8Array> {
  const children: Paragraph[] = [];
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: "Synthèse IA", bold: true })],
    }),
    new Paragraph({
      children: [new TextRun({ text: query, italics: true, color: "555555" })],
      spacing: { after: 240 },
    }),
  );

  for (const block of splitMarkdown(synthesis)) {
    if (block.kind === "h") {
      children.push(
        new Paragraph({
          heading: block.level === 1 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
          children: [new TextRun({ text: block.text, bold: true })],
        }),
      );
    } else if (block.kind === "bullet") {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          children: parseInline(block.text),
        }),
      );
    } else {
      children.push(new Paragraph({ children: parseInline(block.text), spacing: { after: 120 } }));
    }
  }

  if (sources.length) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: "Sources", bold: true })],
        spacing: { before: 240 },
      }),
    );
    sources.forEach((s, i) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `[${i + 1}] ` }),
            new ExternalHyperlink({
              link: s.url,
              children: [new TextRun({ text: s.title || s.url, color: "1155CC", underline: {} })],
            }),
          ],
        }),
      );
    });
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({
          text: `Généré le ${new Date().toLocaleDateString("fr-FR")} — AutoMarket AI`,
          italics: true,
          color: "999999",
          size: 18,
        }),
      ],
      spacing: { before: 400 },
    }),
  );

  const doc = new Document({
    creator: "AutoMarket AI",
    title: query,
    sections: [{ children }],
  });
  return await Packer.toBuffer(doc);
}

function parseInline(text: string): TextRun[] {
  // Simple bold (**text**) parser; leaves the rest as plain
  const parts: TextRun[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(new TextRun({ text: text.slice(last, m.index) }));
    parts.push(new TextRun({ text: m[1], bold: true }));
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(new TextRun({ text: text.slice(last) }));
  return parts.length ? parts : [new TextRun({ text })];
}

function splitMarkdown(md: string): Array<{ kind: "h"; level: number; text: string } | { kind: "bullet"; text: string } | { kind: "p"; text: string }> {
  const blocks: Array<{ kind: "h"; level: number; text: string } | { kind: "bullet"; text: string } | { kind: "p"; text: string }> = [];
  const lines = md.split(/\r?\n/);
  let para: string[] = [];
  const flush = () => {
    if (para.length) {
      blocks.push({ kind: "p", text: para.join(" ").trim() });
      para = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { flush(); blocks.push({ kind: "h", level: h[1].length, text: h[2] }); continue; }
    const b = /^[-*]\s+(.*)$/.exec(line);
    if (b) { flush(); blocks.push({ kind: "bullet", text: b[1] }); continue; }
    para.push(line);
  }
  flush();
  return blocks;
}

// -------- PDF --------
async function buildPdf(
  query: string,
  synthesis: string,
  sources: { title: string; url: string }[],
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(query);
  pdf.setCreator("AutoMarket AI");

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  const pageW = 595.28; // A4
  const pageH = 841.89;
  const margin = 56;
  const maxW = pageW - margin * 2;

  let page = pdf.addPage([pageW, pageH]);
  let y = pageH - margin;

  const ensureSpace = (h: number) => {
    if (y - h < margin) {
      page = pdf.addPage([pageW, pageH]);
      y = pageH - margin;
    }
  };

  const drawText = (text: string, size: number, f = font, color = rgb(0.1, 0.1, 0.12)) => {
    const lines = wrapLines(text, f, size, maxW);
    for (const line of lines) {
      ensureSpace(size + 4);
      page.drawText(stripUnsupported(line), { x: margin, y: y - size, size, font: f, color });
      y -= size + 4;
    }
  };

  // Title
  drawText("Synthèse IA", 22, bold);
  y -= 4;
  drawText(query, 12, italic, rgb(0.35, 0.35, 0.4));
  y -= 12;

  for (const block of splitMarkdown(synthesis)) {
    if (block.kind === "h") {
      y -= 6;
      drawText(block.text, block.level === 1 ? 16 : 13, bold);
      y -= 2;
    } else if (block.kind === "bullet") {
      const lines = wrapLines("• " + block.text.replace(/\*\*/g, ""), font, 11, maxW - 12);
      for (let i = 0; i < lines.length; i++) {
        ensureSpace(15);
        page.drawText(stripUnsupported(lines[i]), { x: margin + (i === 0 ? 0 : 10), y: y - 11, size: 11, font });
        y -= 14;
      }
    } else {
      drawText(block.text.replace(/\*\*/g, ""), 11);
      y -= 4;
    }
  }

  if (sources.length) {
    y -= 10;
    drawText("Sources", 14, bold);
    sources.forEach((s, i) => {
      drawText(`[${i + 1}] ${s.title} — ${s.url}`, 10, font, rgb(0.2, 0.3, 0.6));
    });
  }

  // Footer
  ensureSpace(20);
  page.drawText(
    stripUnsupported(`Généré le ${new Date().toLocaleDateString("fr-FR")} — AutoMarket AI`),
    { x: margin, y: margin - 20, size: 9, font: italic, color: rgb(0.55, 0.55, 0.6) },
  );

  return await pdf.save();
}

function wrapLines(text: string, font: import("pdf-lib").PDFFont, size: number, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const candidate = cur ? cur + " " + w : w;
    if (font.widthOfTextAtSize(stripUnsupported(candidate), size) <= maxW) {
      cur = candidate;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

// pdf-lib StandardFonts (WinAnsi) don't support many unicode glyphs (emojis, etc.)
function stripUnsupported(s: string): string {
  // Replace common smart quotes with ASCII; drop other non-WinAnsi chars
  return s
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2014/g, "—")
    .replace(/[^\x00-\xFF]/g, "");
}

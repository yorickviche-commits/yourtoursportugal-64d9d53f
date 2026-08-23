// YT Brain — indexing function.
// Body: { document_id } or { all: true }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeadersAuth, requireInternalUser } from "../_shared/require-auth.ts";
import { embedText } from "../_shared/ytb-knowledge.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersAuth, "Content-Type": "application/json" },
  });

const CHUNK = 2800; // ~700 tokens
const OVERLAP = 300;

function chunkText(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const out: string[] = [];
  let i = 0;
  while (i < clean.length && out.length < 60) {
    out.push(clean.slice(i, i + CHUNK));
    i += CHUNK - OVERLAP;
  }
  return out;
}

async function pdfToText(svc: any, filePath: string): Promise<string> {
  const key = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("LOVABLE_API_KEY");
  if (!key) return "";
  try {
    const { data, error } = await svc.storage.from("yt-brain-docs").download(filePath);
    if (error || !data) return "";
    const buf = new Uint8Array(await data.arrayBuffer());
    if (buf.byteLength > 7_000_000) return "";
    let bin = "";
    for (let i = 0; i < buf.length; i += 8192) {
      bin += String.fromCharCode(...buf.subarray(i, i + 8192));
    }
    const b64 = btoa(bin);
    const useGemini = !!Deno.env.get("GEMINI_API_KEY");
    if (useGemini) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${Deno.env.get("GEMINI_API_KEY")}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [
                { text: "Extract ALL text from this document as plain text. No commentary." },
                { inlineData: { mimeType: "application/pdf", data: b64 } },
              ],
            }],
          }),
        },
      );
      if (!res.ok) return "";
      const out = await res.json();
      return out?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("\n") ?? "";
    }
    return "";
  } catch (e) {
    console.warn("pdfToText failed", (e as Error).message);
    return "";
  }
}

async function indexDocument(svc: any, docId: string) {
  const { data: doc } = await svc.from("ytb_documents").select("*").eq("id", docId).maybeSingle();
  if (!doc) return { document_id: docId, chunks: 0, skipped: "not_found" };

  await svc.from("ytb_embeddings").delete().eq("document_id", docId);
  if (doc.is_deleted || doc.status !== "active") {
    return { document_id: docId, chunks: 0, skipped: "inactive" };
  }

  let text = "";
  if (doc.type === "text") text = doc.content || "";
  else if (doc.type === "pdf" && doc.file_path) text = await pdfToText(svc, doc.file_path);
  if (!text.trim()) text = [doc.title, doc.description, doc.url].filter(Boolean).join("\n");

  const header = `${doc.title}${doc.description ? ` — ${doc.description}` : ""}`;
  const { data: cats } = await svc
    .from("ytb_document_categories")
    .select("ytb_categories(name)")
    .eq("document_id", docId);
  const categories = (cats ?? []).map((c: any) => c.ytb_categories?.name).filter(Boolean);
  const { data: folder } = doc.folder_id
    ? await svc.from("ytb_folders").select("name").eq("id", doc.folder_id).maybeSingle()
    : { data: null };

  const chunks = chunkText(`${header}\n\n${text}`);
  const rows: any[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const embedding = await embedText(chunks[i]);
    if (!embedding) break;
    rows.push({
      document_id: docId,
      chunk_index: i,
      chunk_text: chunks[i],
      embedding: embedding as unknown as string,
      metadata: {
        title: doc.title,
        folder: folder?.name ?? null,
        categories,
        confidentiality: doc.confidentiality,
        status: doc.status,
      },
    });
  }
  if (rows.length) {
    const { error } = await svc.from("ytb_embeddings").insert(rows);
    if (error) throw new Error(error.message);
  }
  return { document_id: docId, chunks: rows.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeadersAuth });
  const auth = await requireInternalUser(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (body.all) {
      if (!auth.isAdmin) return json({ error: "Admin only" }, 403);
      const { data: docs } = await svc
        .from("ytb_documents")
        .select("id")
        .eq("is_deleted", false)
        .eq("status", "active")
        .limit(300);
      const results = [];
      for (const d of docs ?? []) results.push(await indexDocument(svc, d.id));
      return json({ ok: true, indexed: results.length, results });
    }

    if (!body.document_id) return json({ error: "document_id required" }, 400);
    const result = await indexDocument(svc, body.document_id);
    return json({ ok: true, ...result });
  } catch (e) {
    console.error("ytb-ingest error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

// Public endpoint called by NetHunt. Validates a shared secret and pulls the affected record.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json } from "../_shared/nethunt.ts";
import { runPull } from "../nethunt-pull/index.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const expected = Deno.env.get("NETHUNT_WEBHOOK_SECRET");
  const url = new URL(req.url);
  const provided = req.headers.get("x-nethunt-secret") ?? url.searchParams.get("secret");
  if (!expected || provided !== expected) return json({ error: "unauthorized" }, 401);

  try {
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* empty body allowed */ }
    const recordId = (body.recordId ?? body.record_id ?? (body.record as Record<string, unknown>)?.id) as string | undefined;
    const folderId = String(body.folderId ?? body.folder_id ?? "");
    const folder = folderId.endsWith("c24") ? "tasks" as const : "deals" as const;
    const result = await runPull(recordId ? { recordId: String(recordId), folder } : {});
    return json({ ok: true, ...result });
  } catch (e) {
    console.error("nethunt-webhook error:", e);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});

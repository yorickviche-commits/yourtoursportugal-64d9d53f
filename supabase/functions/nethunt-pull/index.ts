// NetHunt → Lovable sync entrypoint (cron every 2 min + manual refresh).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json } from "../_shared/nethunt.ts";
import { runPull } from "../_shared/nethunt-pull-core.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    let body: {
      recordId?: string;
      folder?: "deals" | "tasks";
      sample?: boolean;
      fullTimeline?: boolean;
      timelineLimit?: number;
      timelineOffset?: number;
      leadIds?: string[];
    } = {};
    if (req.method === "POST") {
      try { body = await req.json(); } catch { /* cron sends an empty body */ }
    }
    if (body?.sample) {
      const { sampleTimeline } = await import("../_shared/nethunt-pull-core.ts");
      return json({ ok: true, sample: await sampleTimeline() });
    }
    const result = await runPull(body ?? {});
    return json({ ok: true, ...result });

  } catch (e) {
    console.error("nethunt-pull error:", e);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});

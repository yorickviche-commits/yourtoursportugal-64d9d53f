import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireInternalUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { extractWithFailover } from "../_shared/lead-extract.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const __auth = await requireInternalUser(req);
  if (!__auth.ok) return __auth.response;


  try {
    const { emailText } = await req.json();
    if (!emailText || typeof emailText !== "string" || emailText.trim().length < 10) {
      return new Response(JSON.stringify({ error: "Please paste a valid email conversation." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = await extractWithFailover(emailText);

    return new Response(JSON.stringify({ extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-lead-email error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

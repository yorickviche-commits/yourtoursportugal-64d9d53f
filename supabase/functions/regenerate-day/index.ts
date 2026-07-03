import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireInternalUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const LANGUAGE_MAP: Record<string, string> = {
  EN: 'English (premium DMC tone)',
  PT: 'Portuguese (Portugal — premium, fluent)',
  ES: 'Spanish (premium, fluent)',
  FR: 'French (premium, fluent)',
  IT: 'Italian (premium, fluent)',
  DE: 'German (premium, fluent)',
};

const SYSTEM = `You are the senior travel designer for Your Tours Portugal (YTP), a premium DMC.
Rewrite ONE single day of an existing itinerary based on the user instruction.

RULES:
- Return ONLY valid JSON — no markdown, no code fences, no preamble.
- 5–7 bullets for a touring day, 1–2 for transfer days.
- Bullet order: pickup → guide/transport → experiences → meal (drinks included) → highlight.
- End touring days with "Night in [City]". Never times.
- Day TITLE: explicit tour-catalogue label ("Private Douro Valley Day Tour from Porto"). Never romantic.
- Day SUBTITLE: 5–10 evocative words.
- Update "overnight" to reflect the new city if it changed.

Output EXACTLY:
{"day_number":N,"title":"...","subtitle":"...","bullets":["...","..."],"overnight":"City","location":"Primary city/region for image search"}`;

async function callAI(system: string, user: string): Promise<string> {
  const LOVABLE_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (LOVABLE_KEY) {
    try {
      const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${LOVABLE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
          max_tokens: 2048,
          response_format: { type: 'json_object' },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) return content;
      } else {
        console.error('Lovable AI', res.status, await res.text().catch(() => ''));
      }
    } catch (e) { console.error('Lovable AI err', e); }
  }
  const GEMINI = Deno.env.get('GEMINI_API_KEY');
  if (GEMINI) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${system}\n\n${user}` }] }],
          generationConfig: { maxOutputTokens: 2048, temperature: 0.7, responseMimeType: 'application/json' },
        }),
      }
    );
    if (res.ok) {
      const data = await res.json();
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (content) return content;
    }
  }
  throw new Error('AI providers unavailable');
}

async function searchImages(query: string, count: number, excludeIds: string[]): Promise<{ url: string; caption: string; photo_id: string }[]> {
  const KEY = Deno.env.get('UNSPLASH_ACCESS_KEY');
  if (!KEY) return [];
  try {
    const params = new URLSearchParams({
      query, per_page: '20', page: '1', orientation: 'landscape', content_filter: 'high',
    });
    const res = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
      headers: { Authorization: `Client-ID ${KEY}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const excluded = new Set(excludeIds);
    const out: { url: string; caption: string; photo_id: string }[] = [];
    for (const p of (data.results || [])) {
      const id = p.id;
      if (excluded.has(id)) continue;
      const url = p.urls?.regular || p.urls?.small;
      if (!url) continue;
      out.push({ url, caption: p.alt_description || p.description || query, photo_id: id });
      if (out.length >= count) break;
    }
    return out;
  } catch (e) { console.error('unsplash err', e); return []; }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const auth = await requireInternalUser(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { day, instruction, language = 'EN', destination = '', clientContext = '', excludePhotoIds = [], imageCount = 2 } = body;

    if (!day || !instruction) {
      return new Response(JSON.stringify({ error: 'Missing day or instruction' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const langCode = String(language).toUpperCase();
    const langInstr = LANGUAGE_MAP[langCode] || LANGUAGE_MAP.EN;

    const currentBullets = (day.bullets || []).map((b: any) => typeof b === 'string' ? b : b?.text).filter(Boolean);
    const userPrompt = `Trip destinations: ${destination}
${clientContext ? `Context: ${clientContext}` : ''}

Current Day ${day.day_number}:
- Title: ${day.title || ''}
- Subtitle: ${day.subtitle || ''}
- Overnight: ${day.overnight || ''}
- Bullets: ${currentBullets.join(' | ')}

USER INSTRUCTION: ${instruction}

Rewrite ONLY this day to reflect the instruction. Keep day_number = ${day.day_number}. Keep the same date.
OUTPUT LANGUAGE: ${langInstr}. Keep JSON keys English, proper nouns untranslated.`;

    // Run AI + preemptive image search in parallel-ish is tricky; do AI first then images based on new location.
    const raw = await callAI(SYSTEM, userPrompt);
    let parsed: any = null;
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
    try { parsed = JSON.parse(cleaned); } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
    }
    if (!parsed) {
      return new Response(JSON.stringify({ error: 'Invalid AI JSON', raw: raw.slice(0, 600) }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const location: string = parsed.location || parsed.overnight || day.overnight || destination;
    const images = await searchImages(location, imageCount, excludePhotoIds);

    const result = {
      day_number: parsed.day_number || day.day_number,
      title: parsed.title || day.title,
      subtitle: parsed.subtitle || day.subtitle,
      bullets: Array.isArray(parsed.bullets) ? parsed.bullets : currentBullets,
      overnight: parsed.overnight || day.overnight,
      date: day.date,
      images,
      location,
    };

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('regenerate-day error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

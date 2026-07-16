import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireInternalUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SYSTEM_PROMPT = `You are the senior travel designer for Your Tours Portugal (YTP), a premium DMC.
Your task is to generate a complete, day-by-day travel plan proposal for a private client.

You must follow these strict rules:
1. Structure: one day per destination, unless pax requested more days in one city
2. Day 1 is always arrival + transfer-in. Last day is always transfer-out.
3. Each touring day has 5–7 bullet points. No times. No sub-bullets.
4. Bullet order: pickup → guide/transport → experiences (2–4) → meal → highlight
5. Always mention "drinks included" in meal bullets
6. Shared vs private: note "(shared basis)" when activity is not private
7. End every day with "Night in [City]"
8. Last day ends with "Departure from [City]" — no overnight
9. Language: English, premium tone, confident and evocative
10. Trip title: poetic and specific to the itinerary (never generic)
11. Opening narrative: 2–3 sentences, mentions all destinations, premium DMC tone
12. Day TITLE: MUST be an explicit, descriptive experience label in the style of tour catalogues — clear about WHAT, WHERE and HOW. Examples: "Douro Valley Private Day Tour from Porto", "Private Morning Tour Porto City Center", "Transfer Porto–Lisbon with Aveiro and Coimbra", "Self-Guided Alentejo Day Tour". Never romantic, never abstract (forbidden: "Welcome, Portugal!", "Northern Soul", "A Day of Wonders"). Always include city/region + tour type (Private/Shared/Self-Guided/Transfer/Full Day/Morning/Multi-Day/etc.).
13. Day SUBTITLE: this is where the evocative/commercial/romantic descriptive line goes (5–10 words, premium tone).
13. Bullet style: "Entrance and guided visit of..." (not "we will visit")
14. "Regional lunch (drinks included)" — always mention drinks included
15. "Pick-up & Drop-off at your accommodation in [City] city centre"
16. "Private Guide & Transportation" as a standalone bullet when applicable
17. Transfer-only days (arrival/departure) get 1–2 bullets max

Output ONLY valid JSON — no markdown, no preamble, no code fences.

Output this exact JSON structure:
{
  "trip_title": "...",
  "narrative": "2-3 sentence premium description mentioning all destinations",
  "days": [
    {
      "day_number": 1,
      "title": "Arrival Transfer Porto Airport to City Center",
      "date": "02-Aug-2026",
      "subtitle": "A warm welcome to Portugal's northern capital",
      "bullets": [
        "Private transfer from Porto Airport to your accommodation in Porto city centre (without guide)",
        "Night in Porto"
      ],
      "overnight": "Porto"
    }
  ]
}`;

interface RequestBody {
  leadData: {
    clientName: string;
    fileId: string;
    destination: string;
    travelDates: string;
    travelEndDate?: string;
    numberOfDays?: number;
    datesType?: string;
    pax: number;
    paxChildren?: number;
    paxInfants?: number;
    travelStyles: string[];
    comfortLevel: string;
    budgetLevel: string;
    magicQuestion?: string;
    notes?: string;
    language?: string;
  };
  extraInstructions?: string;
  routeMapPath?: string;
  exactItineraryPdfPath?: string;
};

const LANGUAGE_MAP: Record<string, string> = {
  EN: 'English (premium DMC tone)',
  PT: 'Portuguese (Portugal — premium, fluent)',
  ES: 'Spanish (premium, fluent)',
  FR: 'French (premium, fluent)',
};

function formatDateRange(leadData: RequestBody['leadData'], numDays: number): string {
  if (leadData.travelDates && leadData.travelEndDate) {
    return `${leadData.travelDates} to ${leadData.travelEndDate} (${numDays} days)`;
  }
  if (leadData.travelDates) return `Starting ${leadData.travelDates} for ${numDays} days`;
  return `${numDays} days (dates TBD)`;
}

function calculateDays(ld: RequestBody['leadData']): number {
  if (ld.numberOfDays && ld.numberOfDays > 0) return ld.numberOfDays;
  if (ld.travelDates && ld.travelEndDate) {
    const d = Math.ceil((new Date(ld.travelEndDate).getTime() - new Date(ld.travelDates).getTime()) / 86400000) + 1;
    if (d > 0) return d;
  }
  return 5;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Attachment { kind: 'image' | 'pdf'; mime: string; base64: string; filename?: string; }

async function callAI(systemPrompt: string, userPrompt: string, attachments: Attachment[] = []): Promise<string> {
  const errors: string[] = [];
  let creditsExhausted = false;

  // Build multimodal user content blocks (if attachments present).
  // Only used by Lovable AI Gateway / direct Gemini — text-capable fallbacks ignore attachments.
  const userContentBlocks: any[] = [{ type: 'text', text: userPrompt }];
  for (const att of attachments) {
    if (att.kind === 'image') {
      userContentBlocks.push({
        type: 'image_url',
        image_url: { url: `data:${att.mime};base64,${att.base64}` },
      });
    } else if (att.kind === 'pdf') {
      userContentBlocks.push({
        type: 'file',
        file: {
          filename: att.filename || 'exact-itinerary.pdf',
          file_data: `data:${att.mime};base64,${att.base64}`,
        },
      });
    }
  }
  const useMultimodal = attachments.length > 0;

  // 1) Lovable AI Gateway — rotate models on 429, skip on 402
  const LOVABLE_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (LOVABLE_KEY) {
    const lovableModels = useMultimodal
      ? ['google/gemini-2.5-pro', 'google/gemini-2.5-flash']
      : ['google/gemini-2.5-pro', 'google/gemini-2.5-flash', 'google/gemini-2.5-flash-lite'];
    for (const model of lovableModels) {
      let lastStatus = 0;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${LOVABLE_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: useMultimodal ? userContentBlocks : userPrompt },
              ],
              max_tokens: 32768,
              response_format: { type: 'json_object' },
            }),
          });
          if (res.ok) {
            const data = await res.json();
            const content = data.choices?.[0]?.message?.content;
            if (content) return content;
          }
          lastStatus = res.status;
          if (res.status === 402) { creditsExhausted = true; break; }
          if (res.status !== 429) break;
          await sleep(1500 * (attempt + 1));
        } catch (e: any) {
          errors.push(`Lovable(${model}): ${e.message}`);
          break;
        }
      }
      errors.push(`Lovable(${model}): ${lastStatus}`);
      if (creditsExhausted) break;
    }
  }

  // 2) Gemini Direct with retry on 429
  const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY');
  if (GEMINI_KEY) {
    const geminiModels = ['gemini-2.5-pro', 'gemini-2.5-flash'];
    for (const model of geminiModels) {
      let lastStatus = 0;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  role: 'user',
                  parts: [
                    { text: `${systemPrompt}\n\n${userPrompt}` },
                    ...attachments.map(a => ({ inlineData: { mimeType: a.mime, data: a.base64 } })),
                  ],
                }],
                generationConfig: { maxOutputTokens: 32768, temperature: 0.7, responseMimeType: 'application/json' },
              }),
            }
          );
          if (res.ok) {
            const data = await res.json();
            const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (content) return content;
          }
          lastStatus = res.status;
          if (res.status !== 429 && res.status !== 503) break;
          await sleep(2000 * (attempt + 1));
        } catch (e: any) {
          errors.push(`Gemini(${model}): ${e.message}`);
          break;
        }
      }
      errors.push(`Gemini(${model}): ${lastStatus}`);
    }
  }

  // 3) OpenAI with retry
  const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY');
  if (OPENAI_KEY) {
    const openaiModels = ['gpt-4o', 'gpt-4o-mini'];
    for (const model of openaiModels) {
      let lastStatus = 0;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
              max_tokens: 16384,
              temperature: 0.7,
              response_format: { type: 'json_object' },
            }),
          });
          if (res.ok) {
            const data = await res.json();
            const content = data.choices?.[0]?.message?.content;
            if (content) return content;
          }
          lastStatus = res.status;
          if (res.status !== 429 && res.status !== 503) break;
          await sleep(2000 * (attempt + 1));
        } catch (e: any) {
          errors.push(`OpenAI(${model}): ${e.message}`);
          break;
        }
      }
      errors.push(`OpenAI(${model}): ${lastStatus}`);
    }
  }

  // 4) Claude (Anthropic) — corrected model names
  const CLAUDE_KEY = Deno.env.get('CLAUDE_API_KEY');
  if (CLAUDE_KEY) {
    const claudeModels = ['claude-sonnet-4-5-20250929', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'];
    for (const model of claudeModels) {
      let lastStatus = 0;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': CLAUDE_KEY,
              'Content-Type': 'application/json',
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model,
              max_tokens: 16384,
              system: systemPrompt,
              messages: [{ role: 'user', content: userPrompt }],
            }),
          });
          if (res.ok) {
            const data = await res.json();
            const content = data.content?.[0]?.text;
            if (content) return content;
          }
          lastStatus = res.status;
          if (res.status !== 429 && res.status !== 529) break;
          await sleep(2000 * (attempt + 1));
        } catch (e: any) {
          errors.push(`Claude(${model}): ${e.message}`);
          break;
        }
      }
      errors.push(`Claude(${model}): ${lastStatus}`);
    }
  }

  const hint = creditsExhausted
    ? ' (Créditos Lovable AI esgotados — adiciona créditos no workspace para reativar o gateway principal)'
    : '';
  throw new Error(`Todos os modelos de AI falharam${hint}. Detalhes: ${errors.join(' | ')}`);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const __auth = await requireInternalUser(req);
  if (!__auth.ok) return __auth.response;


  try {
    const { leadData, extraInstructions } = (await req.json()) as RequestBody;
    const numDays = calculateDays(leadData);
    const dateRange = formatDateRange(leadData, numDays);

    const paxStr = `${leadData.pax} adult${leadData.pax > 1 ? 's' : ''}${leadData.paxChildren ? ` + ${leadData.paxChildren} children` : ''}${leadData.paxInfants ? ` + ${leadData.paxInfants} infants` : ''}`;

    const userPrompt = `Generate a ${numDays}-day travel plan proposal for:

Client: ${leadData.clientName}
File ID: ${leadData.fileId || 'TBD'}
Destinations: ${leadData.destination}
Travel Dates: ${dateRange}
EXACT NUMBER OF DAYS: ${numDays} — create exactly ${numDays} days
Participants: ${paxStr}
Travel Styles: ${leadData.travelStyles?.join(', ') || 'General'}
Comfort Level: ${leadData.comfortLevel || 'Standard'}
Budget: ${leadData.budgetLevel || 'Medium'}
${leadData.magicQuestion ? `What would make this trip unforgettable: ${leadData.magicQuestion}` : ''}
${leadData.notes ? `Additional notes: ${leadData.notes}` : ''}
${extraInstructions ? `\nADDITIONAL INSTRUCTIONS FROM TEAM: ${extraInstructions}` : ''}

Format dates as DD-Mon-YYYY (e.g. 02-Aug-2026). If exact dates aren't provided, use placeholder dates starting from a reasonable near-future date.`;

    const langCode = (leadData.language || 'EN').toUpperCase();
    const langInstruction = LANGUAGE_MAP[langCode] || LANGUAGE_MAP.EN;
    const languageDirective = `\n\nOUTPUT LANGUAGE: Generate ALL text fields (trip_title, narrative, day title, subtitle, bullets, overnight) in ${langInstruction}. Keep JSON keys in English. Keep proper nouns (city names, hotel names) untranslated.`;

    const systemWithExtra = (extraInstructions
      ? `${SYSTEM_PROMPT}\n\nIMPORTANT ADDITIONAL INSTRUCTIONS: ${extraInstructions}`
      : SYSTEM_PROMPT) + languageDirective;

    const raw = await callAI(systemWithExtra, userPrompt);

    // Parse JSON from response — strip code fences, then try greedy match + partial repair
    let parsed: any = null;
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
    try { parsed = JSON.parse(cleaned); } catch {}
    if (!parsed) {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
    }
    // Partial repair: truncate to last complete day and close braces
    if (!parsed) {
      try {
        const start = cleaned.indexOf('{');
        if (start >= 0) {
          let s = cleaned.slice(start);
          // cut at last closed day object inside days array
          const lastDayEnd = s.lastIndexOf('}\n    }');
          if (lastDayEnd > 0) {
            s = s.slice(0, lastDayEnd + 1) + ']\n}';
            parsed = JSON.parse(s);
          }
        }
      } catch {}
    }

    if (!parsed || !parsed.days) {
      return new Response(JSON.stringify({ error: 'AI returned invalid format', raw: raw.slice(0, 1200), tail: raw.slice(-400) }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ result: parsed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('generate-travel-plan error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

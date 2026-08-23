import { knowledgeBlock } from "../_shared/ytb-knowledge.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";
import { requireInternalUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MAX_PDF_BYTES = 7 * 1024 * 1024;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const FINAL_MAX_TOKENS = 18000;
const EXTRACTION_MAX_TOKENS = 10000;

class SafeFunctionError extends Error {
  status: number;
  code: string;

  constructor(message: string, code = 'generation_failed', status = 500) {
    super(message);
    this.name = 'SafeFunctionError';
    this.status = status;
    this.code = code;
  }
}

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const formatMb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)}MB`;

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
14. Bullet style: "Entrance and guided visit of..." (not "we will visit")
15. "Regional lunch (drinks included)" — always mention drinks included
16. "Pick-up & Drop-off at your accommodation in [City] city centre"
17. "Private Guide & Transportation" as a standalone bullet when applicable
18. Transfer-only days (arrival/departure) get 1–2 bullets max

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
}

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

interface Attachment {
  kind: 'image' | 'pdf';
  mime: string;
  base64: string;
  filename?: string;
  sizeBytes: number;
}

interface CallAIOptions {
  maxTokens?: number;
  allowTextFallbacks?: boolean;
  purpose?: string;
}

async function readErrorBody(res: Response) {
  try { return (await res.text()).slice(0, 300); } catch { return ''; }
}

async function callAI(
  systemPrompt: string,
  userPrompt: string,
  attachments: Attachment[] = [],
  options: CallAIOptions = {},
): Promise<string> {
  const errors: string[] = [];
  const maxTokens = options.maxTokens ?? FINAL_MAX_TOKENS;
  const allowTextFallbacks = options.allowTextFallbacks ?? true;
  const purpose = options.purpose ? `${options.purpose}: ` : '';
  let creditsExhausted = false;

  const userContentBlocks: any[] = [{ type: 'text', text: userPrompt }];
  for (const att of attachments) {
    if (att.kind === 'image') {
      userContentBlocks.push({ type: 'image_url', image_url: { url: `data:${att.mime};base64,${att.base64}` } });
    } else if (att.kind === 'pdf') {
      userContentBlocks.push({
        type: 'file',
        file: { filename: att.filename || 'exact-itinerary.pdf', file_data: `data:${att.mime};base64,${att.base64}` },
      });
    }
  }
  const useMultimodal = attachments.length > 0;

  // 1) Lovable AI Gateway
  const LOVABLE_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (LOVABLE_KEY) {
    const lovableModels = useMultimodal
      ? ['google/gemini-3.6-flash', 'google/gemini-2.5-flash', 'google/gemini-2.5-pro']
      : ['google/gemini-3.6-flash', 'google/gemini-2.5-flash', 'google/gemini-2.5-flash-lite'];

    for (const model of lovableModels) {
      let lastStatus = 0;
      let lastBody = '';
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: { 'Lovable-API-Key': LOVABLE_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: useMultimodal ? userContentBlocks : userPrompt },
              ],
              max_tokens: maxTokens,
              response_format: { type: 'json_object' },
            }),
          });
          if (res.ok) {
            const data = await res.json();
            const content = data.choices?.[0]?.message?.content;
            if (content) return content;
          }
          lastStatus = res.status;
          lastBody = await readErrorBody(res);
          if (res.status === 402) { creditsExhausted = true; break; }
          if (res.status !== 429) break;
          await sleep(1500 * (attempt + 1));
        } catch (e: any) {
          errors.push(`${purpose}Lovable(${model}): ${e.message}`);
          break;
        }
      }
      errors.push(`${purpose}Lovable(${model}): ${lastStatus}${lastBody ? ` ${lastBody}` : ''}`);
      if (creditsExhausted) break;
    }
  }

  // 2) Gemini Direct — strongest multimodal fallback
  const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY');
  if (GEMINI_KEY) {
    const geminiModels = ['gemini-2.5-pro', 'gemini-2.5-flash'];
    for (const model of geminiModels) {
      let lastStatus = 0;
      let lastBody = '';
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`, {
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
              generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7, responseMimeType: 'application/json' },
            }),
          });
          if (res.ok) {
            const data = await res.json();
            const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (content) return content;
          }
          lastStatus = res.status;
          lastBody = await readErrorBody(res);
          if (res.status !== 429 && res.status !== 503) break;
          await sleep(2000 * (attempt + 1));
        } catch (e: any) {
          errors.push(`${purpose}Gemini(${model}): ${e.message}`);
          break;
        }
      }
      errors.push(`${purpose}Gemini(${model}): ${lastStatus}${lastBody ? ` ${lastBody}` : ''}`);
    }
  }

  // 3) OpenAI — useful after PDF has been converted to text context
  const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY');
  if (OPENAI_KEY && (!useMultimodal || allowTextFallbacks)) {
    const openaiModels = ['gpt-4o', 'gpt-4o-mini'];
    for (const model of openaiModels) {
      let lastStatus = 0;
      let lastBody = '';
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
              max_tokens: Math.min(maxTokens, 16000),
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
          lastBody = await readErrorBody(res);
          if (res.status !== 429 && res.status !== 503) break;
          await sleep(2000 * (attempt + 1));
        } catch (e: any) {
          errors.push(`${purpose}OpenAI(${model}): ${e.message}`);
          break;
        }
      }
      errors.push(`${purpose}OpenAI(${model}): ${lastStatus}${lastBody ? ` ${lastBody}` : ''}`);
    }
  }

  // 4) Claude/Anthropic — useful after PDF has been converted to text context
  const CLAUDE_KEY = Deno.env.get('CLAUDE_API_KEY') || Deno.env.get('ANTHROPIC_API_KEY');
  if (CLAUDE_KEY && (!useMultimodal || allowTextFallbacks)) {
    const claudeModels = ['claude-sonnet-4-5-20250929', 'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'];
    for (const model of claudeModels) {
      let lastStatus = 0;
      let lastBody = '';
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'x-api-key': CLAUDE_KEY, 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({
              model,
              max_tokens: Math.min(maxTokens, 16000),
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
          lastBody = await readErrorBody(res);
          if (res.status !== 429 && res.status !== 529) break;
          await sleep(2000 * (attempt + 1));
        } catch (e: any) {
          errors.push(`${purpose}Claude(${model}): ${e.message}`);
          break;
        }
      }
      errors.push(`${purpose}Claude(${model}): ${lastStatus}${lastBody ? ` ${lastBody}` : ''}`);
    }
  }

  const hint = creditsExhausted
    ? ' (Créditos Lovable AI esgotados — adiciona créditos no workspace para reativar o gateway principal)'
    : '';
  throw new Error(`Todos os modelos de AI falharam${hint}. Detalhes: ${errors.join(' | ')}`);
}

function parseJsonFromAI(raw: string): any {
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const m = cleaned.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }

  const start = cleaned.indexOf('{');
  const daysStart = cleaned.indexOf('"days"');
  const lastDayEnd = cleaned.lastIndexOf('\n    }');
  if (start >= 0 && daysStart > start && lastDayEnd > daysStart) {
    try { return JSON.parse(cleaned.slice(start, lastDayEnd + 7) + '\n  ]\n}'); } catch {}
  }
  return null;
}

function normalizePlan(parsed: any) {
  if (!parsed || !Array.isArray(parsed.days)) return null;
  return {
    trip_title: String(parsed.trip_title || parsed.title || 'Your Tours Portugal Proposal'),
    narrative: String(parsed.narrative || parsed.summary || ''),
    days: parsed.days.map((day: any, index: number) => ({
      day_number: Number(day.day_number || day.day || index + 1),
      title: String(day.title || `Day ${index + 1}`),
      date: String(day.date || ''),
      subtitle: String(day.subtitle || ''),
      bullets: Array.isArray(day.bullets)
        ? day.bullets.map((b: any) => typeof b === 'string' ? b : String(b?.text || b?.label || '')).filter(Boolean)
        : [],
      overnight: String(day.overnight || day.accommodation || ''),
    })).filter((day: any) => day.bullets.length > 0 || day.title),
  };
}

async function extractExactItineraryContext(pdf: Attachment): Promise<string> {
  const system = `You extract exact itinerary structure from PDFs for a premium DMC operations team.
Return ONLY valid JSON. Do not write markdown. Preserve wording VERBATIM.`;
  const prompt = `Read the attached Exact Itinerary PDF and extract the day-by-day structure EXACTLY as written by the human agent. This is a source-of-truth document — do NOT paraphrase, do NOT translate, do NOT embellish, do NOT reorder.

Return this JSON shape:
{
  "source_quality": "clear|partial|poor",
  "detected_days": number,
  "trip_title": "verbatim trip title if present",
  "days": [
    {
      "day_number": 1,
      "date": "verbatim date string if present (e.g. 20/December/2026)",
      "title": "VERBATIM day title exactly as written (e.g. 'Welcome to Portugal – Porto!')",
      "inclusions": ["each 'Included' line copied VERBATIM as a separate string, in the exact order written"],
      "overnight": "city name if inferrable from title/content"
    }
  ]
}

Rules:
- Copy the day title EXACTLY (including punctuation, dashes, capitalisation).
- Copy each inclusion/bullet line EXACTLY as written — one string per line.
- If a day has no "Included:" section (e.g. "Free day"), leave inclusions as [].
- Do not invent, merge, split, translate or reword any line.
- Do not add days that are not present in the PDF.`;

  const raw = await callAI(system, prompt, [pdf], {
    maxTokens: EXTRACTION_MAX_TOKENS,
    allowTextFallbacks: false,
    purpose: 'Exact PDF extraction',
  });
  const parsed = parseJsonFromAI(raw);
  if (!parsed?.days?.length) {
    throw new SafeFunctionError('O PDF foi lido, mas a AI não conseguiu extrair uma estrutura de itinerário válida. Tenta exportar o PDF numa versão mais leve/textual.', 'pdf_extraction_failed', 422);
  }
  return JSON.stringify(parsed).slice(0, 30000);
}

/**
 * Detects a structured day-by-day itinerary written directly in the notes/preferences field.
 * Matches patterns like "Day 1 | 20/December/2026: Welcome to Portugal – Porto!" or "Day 1: ...".
 */
function detectExactItineraryInNotes(notes: string | undefined): {
  found: boolean;
  verbatim: string;
  dayCount: number;
} {
  if (!notes) return { found: false, verbatim: '', dayCount: 0 };
  const dayHeaderRe = /(^|\n)\s*Day\s*\d+\s*[|:\-–]/gi;
  const matches = notes.match(dayHeaderRe) || [];
  if (matches.length < 2) return { found: false, verbatim: '', dayCount: 0 };
  const firstIdx = notes.search(/Day\s*1\s*[|:\-–]/i);
  const verbatim = (firstIdx >= 0 ? notes.slice(firstIdx) : notes).trim();
  return { found: true, verbatim, dayCount: matches.length };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  const __auth = await requireInternalUser(req);
  if (!__auth.ok) return __auth.response;

  try {
    const { leadData, extraInstructions, routeMapPath, exactItineraryPdfPath } = (await req.json()) as RequestBody;
    const numDays = calculateDays(leadData);
    const dateRange = formatDateRange(leadData, numDays);
    const paxStr = `${leadData.pax} adult${leadData.pax > 1 ? 's' : ''}${leadData.paxChildren ? ` + ${leadData.paxChildren} children` : ''}${leadData.paxInfants ? ` + ${leadData.paxInfants} infants` : ''}`;

    const attachments: Attachment[] = [];
    const SUPA_URL = Deno.env.get('SUPABASE_URL');
    const SUPA_SR = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    async function fetchAttachment(path: string, kind: 'image' | 'pdf'): Promise<Attachment | null> {
      if (!SUPA_URL || !SUPA_SR) return null;
      try {
        const res = await fetch(`${SUPA_URL}/storage/v1/object/lead-context/${path}`, {
          headers: { 'Authorization': `Bearer ${SUPA_SR}`, 'apikey': SUPA_SR },
        });
        if (!res.ok) { console.warn(`Fetch attachment ${path} failed: ${res.status}`); return null; }

        const limit = kind === 'pdf' ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
        const contentLength = Number(res.headers.get('content-length') || 0);
        if (contentLength > limit) {
          try { await res.body?.cancel(); } catch {}
          const label = kind === 'pdf' ? 'Exact Itinerary PDF' : 'imagem de mapa';
          throw new SafeFunctionError(`${label} demasiado pesado (${formatMb(contentLength)}). Limite seguro: ${formatMb(limit)}. Exporta/compacta o ficheiro e volta a carregar para garantir geração estável.`, kind === 'pdf' ? 'pdf_too_large' : 'image_too_large', 413);
        }

        const buf = new Uint8Array(await res.arrayBuffer());
        if (buf.byteLength > limit) {
          const label = kind === 'pdf' ? 'Exact Itinerary PDF' : 'imagem de mapa';
          throw new SafeFunctionError(`${label} demasiado pesado (${formatMb(buf.byteLength)}). Limite seguro: ${formatMb(limit)}. Exporta/compacta o ficheiro e volta a carregar.`, kind === 'pdf' ? 'pdf_too_large' : 'image_too_large', 413);
        }

        const mime = kind === 'pdf'
          ? 'application/pdf'
          : (path.endsWith('.png') ? 'image/png' : path.endsWith('.webp') ? 'image/webp' : 'image/jpeg');
        return { kind, mime, base64: encodeBase64(buf), filename: path.split('/').pop(), sizeBytes: buf.byteLength };
      } catch (e) {
        if (e instanceof SafeFunctionError) throw e;
        console.warn(`Attachment fetch error ${path}:`, e);
        return null;
      }
    }

    if (routeMapPath) {
      const a = await fetchAttachment(routeMapPath, 'image');
      if (a) attachments.push(a);
    }
    if (exactItineraryPdfPath) {
      const a = await fetchAttachment(exactItineraryPdfPath, 'pdf');
      if (a) attachments.push(a);
    }

    const pdfAttachment = attachments.find(a => a.kind === 'pdf');
    let exactItineraryContext = '';
    if (pdfAttachment) {
      try {
        exactItineraryContext = await extractExactItineraryContext(pdfAttachment);
      } catch (e) {
        if (e instanceof SafeFunctionError) throw e;
        const msg = e instanceof Error ? e.message : 'Erro desconhecido';
        throw new SafeFunctionError(`Não foi possível interpretar o Exact Itinerary PDF de forma estável. Detalhe: ${msg}`, 'pdf_extraction_failed', 422);
      }
    }

    const finalAttachments = attachments.filter(a => a.kind === 'image');
    const hasMap = finalAttachments.some(a => a.kind === 'image');
    const hasExactPdf = Boolean(exactItineraryContext);
    const notesItinerary = detectExactItineraryInNotes(leadData.notes);
    const hasExactNotes = notesItinerary.found;
    const hasExact = hasExactPdf || hasExactNotes;
    const effectiveDays = hasExactNotes && notesItinerary.dayCount > 0 ? notesItinerary.dayCount : numDays;

    const userPrompt = `Generate a ${effectiveDays}-day travel plan proposal for:

Client: ${leadData.clientName}
File ID: ${leadData.fileId || 'TBD'}
Destinations: ${leadData.destination}
Travel Dates: ${dateRange}
EXACT NUMBER OF DAYS: ${effectiveDays} — create exactly ${effectiveDays} days${hasExact ? ' (matching the exact itinerary provided)' : ''}
Participants: ${paxStr}
Travel Styles: ${leadData.travelStyles?.join(', ') || 'General'}
Comfort Level: ${leadData.comfortLevel || 'Standard'}
Budget: ${leadData.budgetLevel || 'Medium'}
${leadData.magicQuestion ? `What would make this trip unforgettable: ${leadData.magicQuestion}` : ''}
${leadData.notes && !hasExactNotes ? `Additional notes: ${leadData.notes}` : ''}
${extraInstructions ? `\nADDITIONAL INSTRUCTIONS FROM TEAM: ${extraInstructions}` : ''}
${hasMap ? `\nATTACHED: a Google Maps route screenshot showing the intended geographic flow.` : ''}
${hasExactNotes ? `\nEXACT ITINERARY PROVIDED BY THE AGENT (VERBATIM SOURCE OF TRUTH — copy titles and inclusion lines EXACTLY, do not rewrite, do not translate, do not embellish):\n---BEGIN EXACT ITINERARY---\n${notesItinerary.verbatim}\n---END EXACT ITINERARY---` : ''}
${hasExactPdf ? `\nEXACT ITINERARY STRUCTURED CONTEXT extracted VERBATIM from the uploaded PDF. This is the source of truth and must be followed LITERALLY — copy each day title and each inclusion line exactly as extracted:\n${exactItineraryContext}` : ''}

Format dates as DD-Mon-YYYY (e.g. 02-Aug-2026). If exact dates aren't provided, use placeholder dates starting from a reasonable near-future date.`;

    const langCode = (leadData.language || 'EN').toUpperCase();
    const langInstruction = LANGUAGE_MAP[langCode] || LANGUAGE_MAP.EN;
    const languageDirective = `\n\nOUTPUT LANGUAGE: Generate ALL text fields (trip_title, narrative, day title, subtitle, bullets, overnight) in ${langInstruction}. Keep JSON keys in English. Keep proper nouns (city names, hotel names) untranslated.${hasExact ? ' EXCEPTION: when in EXACT-ITINERARY MODE, keep day titles and inclusion bullets in the ORIGINAL language exactly as provided — do not translate them.' : ''}`;
    const exactDirective = hasExact
      ? `\n\n=== EXACT-ITINERARY MODE (STRICT VERBATIM) ===
The agent has provided a specific day-by-day itinerary. This is a HARD CONTRACT — you MUST follow it literally:
1. Number of days: EXACTLY as provided. Do not add, merge, split or remove any day.
2. Day title: COPY VERBATIM from the source. Do NOT rewrite in "premium DMC tone", do NOT translate, do NOT embellish, do NOT add words. Punctuation and capitalisation must match. If the source says "Welcome to Portugal – Porto!", the title MUST be exactly "Welcome to Portugal – Porto!".
3. Bullets: each "Included" line in the source becomes ONE bullet, COPIED VERBATIM in the same order. Do NOT reword, do NOT combine, do NOT split, do NOT add new bullets, do NOT drop bullets.
4. If a day is a "Free day" or transfer-only day with no inclusions, keep bullets minimal (1–2) or empty — do NOT invent activities.
5. Dates: use the dates from the source if present; otherwise use the trip travel dates.
6. Overnight: infer from the day title (e.g. "…in Porto" → overnight Porto). Do NOT append a "Night in [City]" bullet when in verbatim mode — the inclusion lines are the only bullets.
7. Subtitle: this is the ONLY free-form field — write a short (5–10 words) evocative line per day. Everything else is verbatim.
8. trip_title and narrative: you may write these freely following the standard YTP style rules.
This overrides rules 3, 4, 5, 6, 7, 14, 15, 16, 17 in the base style guide whenever they conflict with the verbatim source.`
      : '';
    const routeDirective = hasMap
      ? `\n\nROUTE-MAP CONTEXT: A Google Maps route screenshot is attached showing the intended geographic flow. Respect this sequence of stops/regions when structuring the days.`
      : '';

    const brainQuery = [userPrompt?.slice?.(0, 1500), extraInstructions].filter(Boolean).join(' ');
    const brain = await knowledgeBlock(brainQuery || 'itinerary rules inclusions terms', 'client_facing', 8);

    const systemWithExtra = (extraInstructions
      ? `${SYSTEM_PROMPT}\n\nIMPORTANT ADDITIONAL INSTRUCTIONS: ${extraInstructions}`
      : SYSTEM_PROMPT) + exactDirective + routeDirective + languageDirective + brain;

    const raw = await callAI(systemWithExtra, userPrompt, finalAttachments, {
      maxTokens: FINAL_MAX_TOKENS,
      allowTextFallbacks: true,
      purpose: 'Travel plan generation',
    });

    const parsed = normalizePlan(parseJsonFromAI(raw));
    if (!parsed || !parsed.days?.length) {
      return jsonResponse({ error: 'A AI devolveu um formato inválido. Tenta novamente; se persistir, reduz as instruções/PDF.', code: 'invalid_ai_format', raw: raw.slice(0, 1200), tail: raw.slice(-400) }, 502);
    }

    return jsonResponse({ result: parsed });
  } catch (e) {
    console.error('generate-travel-plan error:', e);
    if (e instanceof SafeFunctionError) return jsonResponse({ error: e.message, code: e.code }, e.status);

    const message = e instanceof Error ? e.message : 'Unknown error';
    const isMemory = /memory/i.test(message);
    return jsonResponse({
      error: isMemory
        ? 'A geração excedeu o limite de memória. Compacta o PDF/usa uma versão textual e tenta novamente.'
        : message,
      code: isMemory ? 'memory_limit' : 'generation_failed',
    }, 500);
  }
});
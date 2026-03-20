import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ItineraryRequest {
  leadData: {
    clientName: string;
    destination: string;
    travelDates: string;
    travelEndDate?: string;
    datesType?: 'concrete' | 'estimated' | 'flexible';
    numberOfDays?: number;
    pax: number;
    paxChildren?: number;
    paxInfants?: number;
    travelStyles: string[];
    comfortLevel: string;
    budgetLevel: string;
    magicQuestion?: string;
    notes?: string;
  };
  type: 'travel_planner' | 'budget' | 'digital_itinerary';
  fseContext?: string;
}

// ─── YT FIXED GUIDE RATES (NET, IVA incl.) ─────────────
const GUIDE_RATES_CONTEXT = `=== YOUR TOURS FIXED GUIDE RATES (NET, IVA incl.) — MANDATORY ===
These are YT's internal fixed costs for freelancer guides. ALWAYS use these exact values.

GUIDE IN YT VEHICLE (private tours):
• Full-day (~10h): 125€ (flat rate per day, NOT per person)

GUIDE + OWN VEHICLE (guide drives own car, specific routes):
• Douro / Vinho Verde / Coimbra & Aveiro: 265€/day
• Braga & Guimarães / Alto-Minho / Gerês: 250€/day
• Santiago de Compostela: 275€/day
• Porto City Full-Day: 225€/day

CITY/LOCAL GUIDE (walking tours, bus services):
• Half-day (~4h): 80€
• Full-day (~10h): 150€

CONTINUOUS SERVICE (multi-day bus circuits, 4+ days):
• Full-day: 180€/day (incl. 1h meal break)

EXTRAS (always additional):
• Guide meal allowance: 15€/meal (when guide eats with group)
• Night service (20:00-02:00): 80€
• Extra hour: 20€/h
• Displacement to service location: 15€
• Fleet vehicle wash: 4.25€

RULES:
- Full-day = ~10h (07:30-19:30), includes 1h lunch + 20min vehicle cleanup
- Half-day = ~4h (07:30-19:30)
- For multi-day trips (4+ days/3+ nights), use continuous service rate
- Guide meal is ALWAYS added when guide eats with group
- Night service is additional if activity extends past 20:00
- Fleet wash is added at end of each driving day`;

const TRAVEL_PLANNER_SYSTEM = `You are a senior travel planner for Your Tours Portugal, a boutique DMC specialized in private, tailor-made travels in Portugal.

=== LAYERED PLANNING APPROACH (CRITICAL) ===
You MUST plan each day using this layered cost structure:

LAYER 1 — TRANSPORT (base layer, always present):
Every travel day needs transport. Options:
a) YT fleet vehicle (van/minibus) — our own fleet, cost is operational (fuel, tolls, parking)
b) Partner transport — from our partner database (buses, boats, trains)
c) Client self-drives — no transport cost
For each day, specify the transport type and route.

LAYER 2 — GUIDE (almost always present):
Every day with YT vehicle REQUIRES a guide. Use our FIXED guide rates (provided below).
Match the correct rate based on:
- Route/destination (Douro, Braga, Porto city, etc.)
- Duration (full-day vs half-day)
- Whether guide uses own vehicle or YT vehicle
- Add meal allowance (15€) when guide eats with group
- Add night service (80€) if activities go past 20:00

LAYER 3 — EXPERIENCES (variable, depends on itinerary):
Wine tastings, boat trips, cultural visits, activities, etc.
PRIORITIZE our protocol suppliers (FSE database provided below).
Use their exact NET prices when available.

LAYER 4 — ACCOMMODATION (if multi-day trip):
Hotels, quintas, etc. Match to client's comfort level and budget.
Use protocol partners when available.

LAYER 5 — MEALS (restaurants):
Lunch and dinner. Use protocol restaurants when available.
Consider: guide meal cost is separate operational cost.

For each activity item, you MUST tag:
- "cost_layer": one of "transport", "guide", "experience", "accommodation", "meal", "operational"
- "fse_supplier": name of protocol supplier if matched, or null
- "is_fixed_rate": true if using YT fixed rate sheet (guides, YT vehicle)

${GUIDE_RATES_CONTEXT}

CRITICAL RULES:
1. RESPECT THE EXACT NUMBER OF DAYS.
2. Each day MUST be structured into exactly 4 time periods: "morning", "lunch", "afternoon", "night".
3. Be specific with real venue names and realistic timings.
4. Consider travel time between locations.
5. For multi-destination trips, plan logical geographic flow.
6. Include a mix of must-sees and hidden gems based on travel style.
7. PRIORITIZE protocol suppliers from our FSE database.
8. ALWAYS include transport + guide as base cost layer for each day.
9. Add operational extras: guide meal (15€), fleet wash (4.25€ per driving day), tolls, parking.

OUTPUT FORMAT - Return ONLY valid JSON:
{
  "days": [
    {
      "day": 1,
      "title": "Arrival & Porto Historic Center",
      "date": "2026-06-01",
      "transport_summary": "YT Van — Porto Airport to Ribeira + city driving",
      "guide_type": "yt_vehicle_fullday",
      "guide_rate": 125,
      "periods": {
        "morning": {
          "label": "Manhã",
          "items": [
            { 
              "title": "Airport pickup + transfer to hotel",
              "description": "Private transfer in YT van",
              "location": "Porto Airport → Ribeira",
              "duration": "45min",
              "cost_layer": "transport",
              "fse_supplier": null,
              "is_fixed_rate": true
            }
          ]
        },
        "lunch": {
          "label": "Almoço",
          "items": [
            { 
              "title": "Lunch at Cantinho do Avillez",
              "description": "Chef José Avillez's casual Porto restaurant",
              "location": "Rua Mouzinho da Silveira 166",
              "duration": "1h30",
              "cost_layer": "meal",
              "fse_supplier": null,
              "is_fixed_rate": false
            }
          ]
        },
        "afternoon": {
          "label": "Tarde",
          "items": [
            { 
              "title": "Livraria Lello & Clérigos Tower",
              "description": "Visit the iconic bookstore and climb the tower",
              "location": "Centro Histórico do Porto",
              "duration": "2h",
              "cost_layer": "experience",
              "fse_supplier": null,
              "is_fixed_rate": false
            }
          ]
        },
        "night": {
          "label": "Noite",
          "items": [
            { 
              "title": "Free evening / Hotel rest",
              "description": "Free time to explore Porto nightlife",
              "location": "Porto",
              "duration": "—",
              "cost_layer": "accommodation",
              "fse_supplier": null,
              "is_fixed_rate": false
            }
          ]
        }
      }
    }
  ]
}`;

const BUDGET_SYSTEM = `You are a travel costing specialist for Your Tours Portugal. Calculate a detailed budget breakdown.
CRITICAL: The budget structure MUST match exactly the travel planner days and periods structure provided.

=== LAYERED COSTING APPROACH ===
Cost each day in layers:
1. TRANSPORT: YT vehicle operational costs (fuel ~30-50€/day, tolls vary by route, parking 5-15€)
2. GUIDE: Use the EXACT fixed rates from the guide rate sheet (125€ FD in YT vehicle, etc.)
3. EXPERIENCES: Use protocol supplier NET prices when available, market rates otherwise
4. ACCOMMODATION: Match to comfort level
5. MEALS: Protocol restaurants first, then market rates (15-45€/person)
6. OPERATIONAL: Guide meal (15€), fleet wash (4.25€), extra hours (20€/h), displacement (15€)

${GUIDE_RATES_CONTEXT}

IMPORTANT: When FSE supplier data with NET prices is provided, use those exact prices.
For each item, tag the "cost_layer" field.

Output JSON: { "summary": { "totalNet": number, "margin": number, "totalPVP": number, "profit": number, "layers": { "transport": number, "guide": number, "experience": number, "accommodation": number, "meal": number, "operational": number } }, "days": [{ "day": number, "title": string, "guide_rate": number, "periods": { "morning": { "items": [{ "title": string, "supplier": string, "netCost": number, "marginPercent": number, "cost_layer": string, "is_fixed_rate": boolean, "is_protocol": boolean }] }, "lunch": {...}, "afternoon": {...}, "night": {...} } }] }`;

const DIGITAL_SYSTEM = `You are a creative travel writer for Your Tours Portugal. Create an inspirational customer-facing itinerary.
Output JSON: { "title": string, "subtitle": string, "days": [{ "day": number, "title": string, "narrative": string, "highlights": string[], "mealSuggestions": string[] }] }
Make it emotional, evocative, and aspirational. Do NOT include any pricing or cost information.`;

function calculateDays(leadData: ItineraryRequest['leadData']): number {
  if (leadData.datesType === 'flexible' && leadData.numberOfDays && leadData.numberOfDays > 0) {
    return leadData.numberOfDays;
  }
  if (leadData.travelDates && leadData.travelEndDate) {
    const start = new Date(leadData.travelDates);
    const end = new Date(leadData.travelEndDate);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (diff > 0) return diff;
    }
  }
  if (leadData.numberOfDays && leadData.numberOfDays > 0) return leadData.numberOfDays;
  const notesLower = (leadData.notes || '').toLowerCase() + ' ' + (leadData.destination || '').toLowerCase();
  const daysMatch = notesLower.match(/(\d+)\s*d(?:ays|ias)/);
  if (daysMatch) return parseInt(daysMatch[1]);
  return 5;
}

function buildPrompts(leadData: ItineraryRequest['leadData'], type: string, numDays: number, fseContext?: string) {
  let systemPrompt: string;
  if (type === 'travel_planner') systemPrompt = TRAVEL_PLANNER_SYSTEM;
  else if (type === 'budget') systemPrompt = BUDGET_SYSTEM;
  else systemPrompt = DIGITAL_SYSTEM;

  const dateInfo = leadData.datesType === 'flexible'
    ? `${numDays} days trip (flexible dates)`
    : leadData.travelEndDate
      ? `${leadData.travelDates} to ${leadData.travelEndDate} (${numDays} days)`
      : `Starting ${leadData.travelDates} for ${numDays} days`;

  const fseBlock = fseContext
    ? `\n\n--- YOUR TOURS PORTUGAL INTERNAL FSE DATABASE (Protocol Suppliers & Partners) ---\n${fseContext}\n--- END FSE DATABASE ---\nIMPORTANT: Prioritize these contracted suppliers when planning activities. They have negotiated rates and established partnerships.\nAlso consult our full FSE archive on Google Drive: https://drive.google.com/drive/folders/1HAjGSOKdgPQU3F3QPK6945OyeZMCJORN\n`
    : '';

  const userPrompt = `Client: ${leadData.clientName}
Destination: ${leadData.destination}
Travel Dates: ${dateInfo}
EXACT NUMBER OF DAYS TO PLAN: ${numDays} days — you MUST create exactly ${numDays} days, no more, no less.
Number of travelers: ${leadData.pax} adults${leadData.paxChildren ? `, ${leadData.paxChildren} children` : ''}${leadData.paxInfants ? `, ${leadData.paxInfants} infants` : ''}
Travel Styles: ${leadData.travelStyles.join(', ')}
Comfort Level: ${leadData.comfortLevel}
Budget Level: ${leadData.budgetLevel}
${leadData.magicQuestion ? `Magic Question (what would make this trip unforgettable): ${leadData.magicQuestion}` : ''}
${leadData.notes ? `Additional Notes: ${leadData.notes}` : ''}
${fseBlock}
Create a ${type === 'travel_planner' ? `detailed ${numDays}-day travel plan with LAYERED cost structure (transport→guide→experiences→accommodation→meals→operational). Tag each item with cost_layer, fse_supplier, and is_fixed_rate.` : type === 'budget' ? 'detailed layered budget breakdown' : 'customer-facing digital itinerary'} for this trip in Portugal. Remember: EXACTLY ${numDays} days.`;

  return { systemPrompt, userPrompt };
}

async function tryLovableAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not available');

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const t = await response.text();
    const err: any = new Error(`Lovable AI error [${response.status}]: ${t}`);
    err.status = response.status;
    throw err;
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function tryGeminiDirect(systemPrompt: string, userPrompt: string): Promise<string> {
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not available');

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }
        ],
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.7,
        },
      }),
    }
  );

  if (!response.ok) {
    const t = await response.text();
    throw new Error(`Gemini direct error [${response.status}]: ${t}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadData, type, fseContext } = (await req.json()) as ItineraryRequest;
    const numDays = calculateDays(leadData);
    const { systemPrompt, userPrompt } = buildPrompts(leadData, type, numDays, fseContext);

    let resultText = '';
    let modelUsed = '';

    try {
      console.log('Trying Lovable AI gateway...');
      resultText = await tryLovableAI(systemPrompt, userPrompt);
      modelUsed = 'lovable-ai';
      console.log('Lovable AI succeeded');
    } catch (lovableErr: any) {
      console.error('Lovable AI failed:', lovableErr);
      if (lovableErr.status === 402 || lovableErr.status === 429 || !Deno.env.get('LOVABLE_API_KEY')) {
        console.log('Falling back to Gemini direct...');
        try {
          resultText = await tryGeminiDirect(systemPrompt, userPrompt);
          modelUsed = 'gemini-direct';
          console.log('Gemini direct succeeded');
        } catch (geminiErr) {
          console.error('Gemini direct also failed:', geminiErr);
          throw new Error('All AI providers failed. Please try again.');
        }
      } else {
        throw lovableErr;
      }
    }

    let parsed;
    try {
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: resultText };
    } catch {
      parsed = { raw: resultText };
    }

    return new Response(JSON.stringify({ result: parsed, modelUsed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('generate-itinerary error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

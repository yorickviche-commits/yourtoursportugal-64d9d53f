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
  fseContext?: string; // Pre-built FSE supplier/service context injected by orchestrator
}

const TRAVEL_PLANNER_SYSTEM = `You are a senior travel planner for Your Tours Portugal, with deep knowledge of Portuguese destinations, local experiences, restaurants, hidden gems, and logistics.

CRITICAL RULES:
1. RESPECT THE EXACT NUMBER OF DAYS. If the client has concrete dates (e.g. June 1-5), create exactly that many days (5 days). If flexible with "12 days", create exactly 12 days. NEVER create more or fewer days than specified.
2. Each day MUST be structured into exactly 4 time periods: "morning", "lunch", "afternoon", "night".
3. If a period has no relevant activity (e.g. no night activity, or a free afternoon), include it with a single item marked as free time or rest.
4. Each period can have 1-4 items/activities.
5. Be specific with real venue names, addresses when possible, and realistic timings.
6. Consider travel time between locations.
7. For multi-destination trips, plan logical geographic flow to minimize backtracking.
8. Include a mix of must-sees and hidden gems based on travel style preferences.
9. IMPORTANT: When our internal FSE (supplier/partner) database is provided below, PRIORITIZE using those suppliers and their specific services/experiences. These are our contracted partners with negotiated rates. Only suggest external venues when no suitable protocol partner exists for that activity type.

OUTPUT FORMAT - Return ONLY valid JSON with this exact structure:
{
  "days": [
    {
      "day": 1,
      "title": "Arrival & Porto Historic Center",
      "date": "2026-06-01",
      "periods": {
        "morning": {
          "label": "Manhã",
          "items": [
            { "title": "Arrival at Porto Airport", "description": "Private transfer to hotel in Ribeira district", "location": "Porto Airport → Ribeira", "duration": "45min", "fse_supplier": "Name of protocol supplier if applicable or null" }
          ]
        },
        "lunch": {
          "label": "Almoço",
          "items": [
            { "title": "Lunch at Cantinho do Avillez", "description": "Chef José Avillez's casual Porto restaurant.", "location": "Rua Mouzinho da Silveira 166", "duration": "1h30", "fse_supplier": null }
          ]
        },
        "afternoon": {
          "label": "Tarde",
          "items": [
            { "title": "Livraria Lello & Clérigos Tower", "description": "Visit the iconic bookstore and climb the tower for panoramic views", "location": "Centro Histórico do Porto", "duration": "2h", "fse_supplier": null }
          ]
        },
        "night": {
          "label": "Noite",
          "items": [
            { "title": "Dinner at DOP", "description": "Fine dining by chef Rui Paula with tasting menu", "location": "Palácio das Artes, Porto", "duration": "2h", "fse_supplier": null }
          ]
        }
      }
    }
  ]
}`;

const BUDGET_SYSTEM = `You are a travel costing specialist for Your Tours Portugal. Calculate a detailed budget breakdown.
CRITICAL: The budget structure MUST match exactly the travel planner days and periods structure provided.
For each item in each period of each day, estimate realistic Portuguese market costs.
Include hidden operational costs: guide meals, tolls, parking, fuel, buffers.
IMPORTANT: When FSE supplier data with NET prices is provided, use those exact prices. Only estimate market rates when no protocol price exists.

Output JSON: { "summary": { "totalNet": number, "margin": number, "totalPVP": number, "profit": number }, "days": [{ "day": number, "title": string, "periods": { "morning": { "items": [{ "title": string, "supplier": string, "netCost": number, "marginPercent": number }] }, "lunch": {...}, "afternoon": {...}, "night": {...} } }] }`;

const DIGITAL_SYSTEM = `You are a creative travel writer for Your Tours Portugal. Create an inspirational customer-facing itinerary.
Output JSON: { "title": string, "subtitle": string, "days": [{ "day": number, "title": string, "narrative": string, "highlights": string[], "mealSuggestions": string[] }] }
Make it emotional, evocative, and aspirational.`;

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
Create a ${type === 'travel_planner' ? `detailed ${numDays}-day travel plan` : type === 'budget' ? 'detailed budget breakdown' : 'customer-facing digital itinerary'} for this trip in Portugal. Remember: EXACTLY ${numDays} days.`;

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

    // Try Lovable AI first, then Gemini direct as fallback
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

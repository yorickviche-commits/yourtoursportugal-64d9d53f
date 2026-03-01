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
    pax: number;
    travelStyles: string[];
    comfortLevel: string;
    budgetLevel: string;
    magicQuestion?: string;
    notes?: string;
  };
  type: 'travel_planner' | 'budget' | 'digital_itinerary';
}

const SYSTEM_PROMPTS: Record<string, string> = {
  travel_planner: `You are a senior travel planner for Your Tours Portugal. Create a detailed day-by-day travel plan.
Output a structured JSON with: { days: [{ day: number, title: string, description: string, activities: [{ time: string, activity: string, details: string, estimatedCost: number }] }] }
Use your knowledge of Portugal destinations, local experiences, restaurants, and hidden gems. Be specific with real venue names and realistic timings.`,

  budget: `You are a travel costing specialist for Your Tours Portugal. Calculate a detailed budget breakdown.
Output a structured JSON with: { summary: { totalNet: number, margin: number, totalPVP: number, profit: number }, days: [{ day: number, items: [{ activity: string, supplier: string, netCost: number, marginPercent: number, pvp: number }] }] }
Use realistic Portuguese market prices. Include hidden costs: guide meals, tolls, parking, fuel, buffers.`,

  digital_itinerary: `You are a creative travel writer for Your Tours Portugal. Create an inspirational customer-facing itinerary.
Output a structured JSON with: { title: string, subtitle: string, days: [{ day: number, title: string, narrative: string, highlights: string[], mealSuggestions: string[] }] }
Make it emotional, evocative, and aspirational. Use rich descriptions of Portuguese culture, cuisine, and landscapes.`,
};

async function callClaude(systemPrompt: string, userPrompt: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error [${response.status}]: ${errorText}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function callOpenAI(systemPrompt: string, userPrompt: string, apiKey: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error [${response.status}]: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadData, type } = (await req.json()) as ItineraryRequest;

    const CLAUDE_API_KEY = Deno.env.get('CLAUDE_API_KEY');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    if (!CLAUDE_API_KEY && !OPENAI_API_KEY) {
      throw new Error('No AI API keys configured');
    }

    const systemPrompt = SYSTEM_PROMPTS[type];
    const userPrompt = `Client: ${leadData.clientName}
Destination: ${leadData.destination}
Travel Dates: ${leadData.travelDates}
Number of travelers: ${leadData.pax}
Travel Styles: ${leadData.travelStyles.join(', ')}
Comfort Level: ${leadData.comfortLevel}
Budget Level: ${leadData.budgetLevel}
${leadData.magicQuestion ? `Magic Question (what would make this trip unforgettable): ${leadData.magicQuestion}` : ''}
${leadData.notes ? `Additional Notes: ${leadData.notes}` : ''}

Please create a ${type === 'travel_planner' ? '5-7 day travel plan' : type === 'budget' ? 'detailed budget breakdown' : 'customer-facing digital itinerary'} for this trip in Portugal.`;

    let result: string;
    let modelUsed: string;

    // Try Claude first, fallback to OpenAI
    if (CLAUDE_API_KEY) {
      try {
        result = await callClaude(systemPrompt, userPrompt, CLAUDE_API_KEY);
        modelUsed = 'claude';
      } catch (claudeError) {
        console.error('Claude failed, trying OpenAI fallback:', claudeError);
        if (!OPENAI_API_KEY) throw claudeError;
        result = await callOpenAI(systemPrompt, userPrompt, OPENAI_API_KEY);
        modelUsed = 'openai-fallback';
      }
    } else {
      result = await callOpenAI(systemPrompt, userPrompt, OPENAI_API_KEY!);
      modelUsed = 'openai';
    }

    // Try to parse JSON from the result
    let parsed;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: result };
    } catch {
      parsed = { raw: result };
    }

    return new Response(JSON.stringify({ result: parsed, modelUsed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('generate-itinerary error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

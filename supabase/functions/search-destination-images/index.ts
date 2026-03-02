import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Curated high-quality Unsplash images for Portugal destinations
const PORTUGAL_IMAGES: Record<string, { url: string; caption: string }[]> = {
  'lisbon': [
    { url: 'https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=800&h=600&fit=crop', caption: 'Lisbon cityscape' },
    { url: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&h=600&fit=crop', caption: 'Traditional tram in Lisbon' },
    { url: 'https://images.unsplash.com/photo-1548707309-dcebeab426c8?w=800&h=600&fit=crop', caption: 'Belém Tower' },
  ],
  'lisboa': [
    { url: 'https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=800&h=600&fit=crop', caption: 'Lisbon cityscape' },
    { url: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&h=600&fit=crop', caption: 'Traditional tram in Lisbon' },
    { url: 'https://images.unsplash.com/photo-1548707309-dcebeab426c8?w=800&h=600&fit=crop', caption: 'Belém Tower' },
  ],
  'porto': [
    { url: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&h=600&fit=crop', caption: 'Porto riverside' },
    { url: 'https://images.unsplash.com/photo-1513735492246-483525079686?w=800&h=600&fit=crop', caption: 'Porto wine cellars' },
    { url: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=600&fit=crop', caption: 'Dom Luís Bridge' },
  ],
  'sintra': [
    { url: 'https://images.unsplash.com/photo-1536663815808-535e2280d2c2?w=800&h=600&fit=crop', caption: 'Pena Palace, Sintra' },
    { url: 'https://images.unsplash.com/photo-1580323956656-26bbb7206e14?w=800&h=600&fit=crop', caption: 'Sintra gardens' },
    { url: 'https://images.unsplash.com/photo-1613832278685-e3235f682f10?w=800&h=600&fit=crop', caption: 'Quinta da Regaleira' },
  ],
  'douro': [
    { url: 'https://images.unsplash.com/photo-1560969184-10fe8719e047?w=800&h=600&fit=crop', caption: 'Douro Valley vineyards' },
    { url: 'https://images.unsplash.com/photo-1601134991665-a020399422e3?w=800&h=600&fit=crop', caption: 'Douro River terraces' },
    { url: 'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=800&h=600&fit=crop', caption: 'Wine tasting in Douro' },
  ],
  'algarve': [
    { url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&h=600&fit=crop', caption: 'Algarve coastline' },
    { url: 'https://images.unsplash.com/photo-1540979388789-6cee28a1cdc9?w=800&h=600&fit=crop', caption: 'Benagil Cave' },
    { url: 'https://images.unsplash.com/photo-1548574505-5e239809ee19?w=800&h=600&fit=crop', caption: 'Lagos cliffs' },
  ],
  'default': [
    { url: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=800&h=600&fit=crop', caption: 'Portugal landscape' },
    { url: 'https://images.unsplash.com/photo-1513735492246-483525079686?w=800&h=600&fit=crop', caption: 'Portuguese architecture' },
    { url: 'https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=800&h=600&fit=crop', caption: 'Portugal views' },
  ],
};

// Try AI-powered image search using Lovable AI
async function searchWithAI(query: string, count: number): Promise<{ url: string; caption: string }[]> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) return [];

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a travel photography curator for Portugal. Given a search query, return ${count} Unsplash photo URLs that best match the destination. Use real, high-quality Unsplash photo IDs you know about. Return JSON array only.`
          },
          {
            role: 'user',
            content: `Find ${count} beautiful travel photos for: "${query}". Return ONLY a JSON array like: [{"url": "https://images.unsplash.com/photo-XXXXX?w=800&h=600&fit=crop", "caption": "description"}]`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_images",
              description: "Return curated travel images",
              parameters: {
                type: "object",
                properties: {
                  images: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        url: { type: "string" },
                        caption: { type: "string" }
                      },
                      required: ["url", "caption"],
                      additionalProperties: false
                    }
                  }
                },
                required: ["images"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "return_images" } }
      }),
    });

    if (!response.ok) return [];

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      return parsed.images || [];
    }
  } catch (e) {
    console.error('AI image search failed:', e);
  }
  return [];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, count = 3 } = await req.json();

    // Try AI-powered search first
    let images = await searchWithAI(query, count);

    // Fallback to curated images
    if (!images.length) {
      const lower = (query || '').toLowerCase();
      let matched: { url: string; caption: string }[] = [];

      for (const [key, imgs] of Object.entries(PORTUGAL_IMAGES)) {
        if (key !== 'default' && lower.includes(key)) {
          matched = imgs;
          break;
        }
      }

      images = (matched.length ? matched : PORTUGAL_IMAGES.default).slice(0, count);
    }

    return new Response(JSON.stringify({ images }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('search-destination-images error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error', images: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Search Unsplash API for real, relevant images
async function searchUnsplash(query: string, count: number): Promise<{ url: string; caption: string }[]> {
  const UNSPLASH_KEY = Deno.env.get('UNSPLASH_ACCESS_KEY');
  if (!UNSPLASH_KEY) {
    console.log('No UNSPLASH_ACCESS_KEY configured');
    return [];
  }

  try {
    const params = new URLSearchParams({
      query: query,
      per_page: String(Math.min(count, 10)),
      orientation: 'landscape',
      content_filter: 'high',
    });

    const res = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
      headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
    });

    if (!res.ok) {
      console.error('Unsplash API error:', res.status, await res.text());
      return [];
    }

    const data = await res.json();
    return (data.results || []).slice(0, count).map((photo: any) => ({
      url: `${photo.urls?.regular || photo.urls?.small}`,
      caption: photo.alt_description || photo.description || query,
    }));
  } catch (e) {
    console.error('Unsplash search failed:', e);
    return [];
  }
}

// Generate image with AI as fallback
async function generateWithAI(query: string): Promise<{ url: string; caption: string } | null> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) return null;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3.1-flash-image-preview',
        messages: [
          {
            role: 'user',
            content: `Generate a beautiful, photorealistic travel photograph of: ${query}. Make it look like a professional travel magazine photo with warm lighting, vivid colors, and a sense of place. Landscape orientation.`,
          },
        ],
        modalities: ['image', 'text'],
      }),
    });

    if (!response.ok) {
      console.error('AI image gen error:', response.status);
      return null;
    }

    const data = await response.json();
    const imageData = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (imageData) {
      return { url: imageData, caption: query };
    }
  } catch (e) {
    console.error('AI image generation failed:', e);
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, count = 3, mode = 'search' } = await req.json();
    // mode: 'search' = Unsplash + AI fallback, 'generate' = AI only (for single regen)

    if (mode === 'generate') {
      // Generate a single AI image
      const result = await generateWithAI(query);
      return new Response(JSON.stringify({ images: result ? [result] : [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Default: search Unsplash first
    let images = await searchUnsplash(query, count);

    // If Unsplash returned fewer than requested, fill with AI-generated
    if (images.length < count) {
      const needed = count - images.length;
      for (let i = 0; i < needed; i++) {
        const aiImg = await generateWithAI(`${query} - view ${i + 1}`);
        if (aiImg) images.push(aiImg);
      }
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
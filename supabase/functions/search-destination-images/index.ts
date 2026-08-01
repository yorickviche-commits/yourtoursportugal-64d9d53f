import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireInternalUser } from "../_shared/require-auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function extractPhotoIdFromUrl(url: string): string {
  const match = url.match(/photo-([a-zA-Z0-9_-]+)/);
  return match ? match[1] : url.slice(-16);
}

async function searchUnsplash(
  query: string,
  count: number,
  page: number = 1,
  _excludeIds: string[] = []
): Promise<{ url: string; caption: string; photo_id: string }[]> {
  const UNSPLASH_KEY = Deno.env.get('UNSPLASH_ACCESS_KEY');
  if (!UNSPLASH_KEY) {
    console.log('No UNSPLASH_ACCESS_KEY configured');
    return [];
  }

  try {
    const params = new URLSearchParams({
      query: query,
      per_page: String(Math.min(count, 30)),
      page: String(page),
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
    return (data.results || []).map((photo: any) => ({
      url: photo.urls?.regular || photo.urls?.small || '',
      caption: photo.alt_description || photo.description || query,
      photo_id: photo.id || extractPhotoIdFromUrl(photo.urls?.regular || ''),
    }));
  } catch (e) {
    console.error('Unsplash search failed:', e);
    return [];
  }
}

function makePhotoId() {
  return `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

type ProviderFailure = { provider: string; status: number; message: string };

function parseProviderError(provider: string, status: number, body: string): ProviderFailure {
  let message = body;
  try {
    const parsed = JSON.parse(body);
    message = parsed?.error?.message || parsed?.message || body;
  } catch {
    message = body;
  }
  return { provider, status, message: message.slice(0, 500) };
}

async function tryGeminiDirect(query: string, prompt: string, failures: ProviderFailure[]) {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) return null;
  const models = ['gemini-3.1-flash-image-preview', 'gemini-2.5-flash-image'];

  for (const model of models) {
    try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        }),
      }
    );
    if (!res.ok) {
      const body = await res.text();
      console.error(`Gemini direct error (${model}):`, res.status, body);
      failures.push(parseProviderError(`Gemini ${model}`, res.status, body));
      continue;
    }
    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    for (const p of parts) {
      const inline = p.inlineData || p.inline_data;
      if (inline?.data) {
        const mime = inline.mimeType || inline.mime_type || 'image/png';
        return { url: `data:${mime};base64,${inline.data}`, caption: query, photo_id: makePhotoId() };
      }
    }
    console.error(`Gemini direct (${model}): no image in response`);
  } catch (e) {
    console.error(`Gemini direct exception (${model}):`, e);
  }
  }

  return null;
}

async function tryOpenAI(query: string, prompt: string, failures: ProviderFailure[]) {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1536x1024', n: 1 }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error('OpenAI image error:', res.status, body);
      failures.push(parseProviderError('OpenAI', res.status, body));
      return null;
    }
    const data = await res.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (b64) return { url: `data:image/png;base64,${b64}`, caption: query, photo_id: makePhotoId() };
    return null;
  } catch (e) {
    console.error('OpenAI image exception:', e);
    return null;
  }
}

async function tryLovableGateway(query: string, prompt: string, failures: ProviderFailure[]) {
  const key = Deno.env.get('LOVABLE_API_KEY');
  if (!key) return null;
  try {
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [{ role: 'user', content: prompt }],
        modalities: ['image', 'text'],
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error('Lovable gateway image error:', res.status, body);
      failures.push(parseProviderError('Lovable AI', res.status, body));
      return null;
    }
    const data = await res.json();
    const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (url) return { url, caption: query, photo_id: makePhotoId() };
    return null;
  } catch (e) {
    console.error('Lovable gateway exception:', e);
    return null;
  }
}

async function generateWithAI(query: string, customPrompt?: string, programContext?: string): Promise<{ image: { url: string; caption: string; photo_id: string } | null; failures: ProviderFailure[] }> {
  const base = (customPrompt && customPrompt.trim())
    ? customPrompt.trim()
    : `Generate a beautiful, photorealistic travel photograph of: ${query}. Professional travel magazine quality, warm cinematic lighting, vivid colors, strong sense of place. Landscape orientation, no text, no watermark.`;

  const prompt = programContext && programContext.trim()
    ? `${base}\n\nTRIP PROGRAM CONTEXT (use these destinations and included experiences as the visual content):\n${programContext.trim()}\n\nStrictly landscape orientation. No text, no letters, no logos, no watermark.`
    : base;

  const failures: ProviderFailure[] = [];

  const openai = await tryOpenAI(query, prompt, failures);
  if (openai) { console.log('Image served by: OpenAI'); return { image: openai, failures }; }

  const gemini = await tryGeminiDirect(query, prompt, failures);
  if (gemini) { console.log('Image served by: Gemini direct'); return { image: gemini, failures }; }

  const gateway = await tryLovableGateway(query, prompt, failures);
  if (gateway) { console.log('Image served by: Lovable gateway'); return { image: gateway, failures }; }

  console.error('All image providers failed for query:', query);
  return { image: null, failures };
}



serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  const __auth = await requireInternalUser(req);
  if (!__auth.ok) return __auth.response;


  try {
    const {
      query,
      count = 20,
      page = 1,
      mode = 'search',
      excludePhotoIds = [],
    } = await req.json();

    if (mode === 'generate') {
      const result = await generateWithAI(query);
      if (!result.image) {
        const quotaFailure = result.failures.find(f => f.status === 402 || f.status === 429 || /quota|billing|credit|limit/i.test(f.message));
        const message = quotaFailure
          ? `A geração AI falhou por quota/billing em ${quotaFailure.provider}: ${quotaFailure.message}`
          : 'Não foi possível gerar imagem com os fornecedores configurados.';
        return new Response(
          JSON.stringify({ error: message, images: [], failures: result.failures }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ images: [result.image] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const excluded = new Set<string>(excludePhotoIds);
    const unique: { url: string; caption: string; photo_id: string }[] = [];
    let currentPage = page;
    const MAX_PAGES = 5;

    while (unique.length < count && currentPage <= MAX_PAGES) {
      const batch = await searchUnsplash(query, 30, currentPage, []);
      for (const img of batch) {
        if (!excluded.has(img.photo_id) && img.url) {
          unique.push(img);
          excluded.add(img.photo_id);
          if (unique.length >= count) break;
        }
      }
      if (batch.length < 30) break;
      currentPage++;
    }

    return new Response(JSON.stringify({ images: unique.slice(0, count) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('search-destination-images error:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error', images: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FSE_CATEGORIES = [
  '0 - Monumentos Nacionais',
  '1 - Alojamento',
  '2 - Animação Turística',
  '3 - Guias Externos',
  '4 - Quintas & Caves',
  '5 - Restauração',
  '6 - Transp. Marítimos',
  '7 - Transp. Terrestres',
];

const FSE_DESTINATIONS = ['Açores', 'Alentejo', 'Algarve', 'Centro', 'Douro', 'Lisboa', 'Madeira', 'Norte', 'Porto'];

function buildFSEPrompt(inputDescription: string): string {
  return `You are a senior travel operations data analyst at Your Tours Portugal, a Portuguese DMC.
Your task is to extract ALL information from a supplier/partner protocol document and return structured JSON.

CONTEXT: This is an FSE (Ficha de Serviço Externo) — a supplier protocol document containing commercial terms, services, and pricing.

EXTRACTION RULES:
1. Extract the supplier/partner name from the document header or Section 2 (NOT "Your Tours Portugal" — that's us).
2. Map the category to ONE of: ${FSE_CATEGORIES.join(', ')}
3. Map the destination(s) to: ${FSE_DESTINATIONS.join(', ')}
   - CRITICAL: If the supplier operates from MULTIPLE departure points (e.g. Porto AND Lisboa), return an array of destinations and set multi_destination=true.
4. Extract ALL services with NET pricing (adult, child, baby, guide prices).
5. Extract booking conditions, payment/invoicing mode, cancellation policy, validity dates.
6. For the supplier name, try to determine:
   - Their official website URL
   - Their TripAdvisor page URL
   - Their Google Maps URL
   - Their Google My Business URL
   - 3-5 other relevant external links (social media, booking platforms, etc.)
   If you cannot determine these from the document, set them to null.

Return this EXACT JSON structure:
{
  "supplier_name": "string — extracted supplier name",
  "category": "string — one of the FSE categories listed above",
  "sub_category": "string or null — e.g. '5★', '4★', 'Villas' for Alojamento",
  "destinations": ["array of destination strings from the list above"],
  "multi_destination": false,
  "website": "string or null — official website URL",
  "tripadvisor_url": "string or null",
  "gmaps_url": "string or null",
  "gmb_url": "string or null",
  "extra_links": [{"name": "string", "url": "string"}],
  "contact_name": "string or null",
  "contact_email": "string or null",
  "contact_phone": "string or null",
  "address": "string or null",
  "fiscal_number": "string or null — NIF/NIPC",
  "bank_iban": "string or null",
  "contract_type": "string or null",
  "currency": "EUR",
  "payment_terms": "string or null — full invoicing/payment mode",
  "cancellation_policy": "string or null — full cancellation terms",
  "validity_start": "YYYY-MM-DD or null",
  "validity_end": "YYYY-MM-DD or null",
  "notes": "string or null — special conditions, ideal_for tags, etc.",
  "services": [
    {
      "name": "string — service/menu/package name",
      "description": "string or null — what's included",
      "category": "string",
      "duration": "string or null",
      "price": 0,
      "price_child": 0,
      "price_unit": "per_person|per_group|per_night|per_day|flat_rate",
      "currency": "EUR",
      "booking_conditions": "string or null",
      "payment_conditions": "string or null",
      "cancellation_policy": "string or null",
      "refund_policy": "string or null",
      "validity_start": "YYYY-MM-DD or null",
      "validity_end": "YYYY-MM-DD or null",
      "notes": "string or null — child age, baby policy, guide price, VAT, extras"
    }
  ],
  "net_conditions": "string or null — summary of all NET pricing conditions and terms",
  "missing_fields": ["array of field names that are null but important"]
}

${inputDescription}`;
}

async function callLovableGateway(messages: any[], apiKey: string): Promise<Response> {
  return await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages,
    }),
  });
}

async function callGeminiDirect(messages: any[], textContent: string, pdfBase64?: string): Promise<any> {
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) throw new Error('No fallback API key available');

  const parts: any[] = [];

  if (pdfBase64) {
    parts.push({
      inline_data: {
        mime_type: 'application/pdf',
        data: pdfBase64,
      },
    });
    parts.push({ text: messages[0].content || textContent });
  } else {
    const textMsg = typeof messages[0].content === 'string'
      ? messages[0].content
      : textContent;
    parts.push({ text: textMsg });
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini direct error ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('No content from Gemini');

  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { text, pdf_base64, entity_type } = body;

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    let promptText: string;
    let messages: any[];

    if (pdf_base64) {
      promptText = buildFSEPrompt('Extract all data from the attached PDF protocol document. Follow the instructions above precisely.');
      messages = [{ role: 'user', content: promptText }];
    } else if (text && text.trim().length >= 10) {
      promptText = buildFSEPrompt(`TEXT TO ANALYZE:\n${text}`);
      messages = [{ role: 'user', content: promptText }];
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Nenhum texto ou PDF fornecido. Cole o conteúdo do protocolo ou faça upload do PDF.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let parsed: any;
    let usedFallback = false;

    // Try Lovable Gateway first (only for text, not PDF — gateway doesn't support inline PDF)
    if (LOVABLE_API_KEY && !pdf_base64) {
      try {
        const response = await callLovableGateway(messages, LOVABLE_API_KEY);

        if (response.ok) {
          const aiResult = await response.json();
          const content = aiResult.choices?.[0]?.message?.content;
          if (content) {
            const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            parsed = JSON.parse(cleaned);
          }
        } else if (response.status === 402 || response.status === 429) {
          console.log(`Gateway returned ${response.status}, falling back to Gemini direct`);
          usedFallback = true;
        } else {
          const errText = await response.text();
          console.error('Gateway error:', response.status, errText);
          usedFallback = true;
        }
      } catch (e) {
        console.error('Gateway call failed:', e);
        usedFallback = true;
      }
    } else {
      // For PDF or no Lovable key, go straight to Gemini direct
      usedFallback = true;
    }

    // Fallback: Gemini direct (handles PDF natively)
    if (!parsed && usedFallback) {
      try {
        parsed = await callGeminiDirect(messages, promptText, pdf_base64);
      } catch (e) {
        console.error('Gemini direct fallback failed:', e);
        return new Response(
          JSON.stringify({ success: false, error: `Falha na extração AI: ${e instanceof Error ? e.message : 'Erro desconhecido'}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!parsed) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não foi possível extrair dados do documento' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize: ensure destinations is always an array
    if (parsed.destinations && !Array.isArray(parsed.destinations)) {
      parsed.destinations = [parsed.destinations];
    }
    if (!parsed.destinations && parsed.destination) {
      parsed.destinations = Array.isArray(parsed.destination) ? parsed.destination : [parsed.destination];
    }

    // Also keep backward-compat entity shape for existing SmartImportDialog
    if (entity_type === 'supplier' || entity_type === 'partner') {
      // Wrap in the entity/services format expected by SmartImportDialog
      const entityData = {
        name: parsed.supplier_name || parsed.name || null,
        category: parsed.category || null,
        contact_name: parsed.contact_name || null,
        contact_email: parsed.contact_email || null,
        contact_phone: parsed.contact_phone || null,
        address: parsed.address || null,
        fiscal_number: parsed.fiscal_number || null,
        bank_iban: parsed.bank_iban || null,
        contract_type: parsed.contract_type || null,
        currency: parsed.currency || 'EUR',
        cancellation_policy: parsed.cancellation_policy || null,
        notes: parsed.notes || null,
        validity_start: parsed.validity_start || null,
        validity_end: parsed.validity_end || null,
        payment_terms: parsed.payment_terms || null,
        commission_percent: parsed.commission_percent || null,
        territory: parsed.territory || null,
      };

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            entity: entityData,
            services: parsed.services || [],
            missing_fields: parsed.missing_fields || [],
          },
          fse_data: parsed,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data: parsed, fse_data: parsed }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

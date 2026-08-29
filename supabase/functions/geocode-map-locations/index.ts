/**
 * geocode-map-locations
 *
 * Preenche `public.map_locations` para tudo o que aparece em
 * `public.v_map_pending_geocode`. Sem isto os mapas ficam vazios: nenhuma
 * tabela de fornecedores/produtos tem coordenadas.
 *
 * Invocação:
 *   supabase.functions.invoke('geocode-map-locations', { body: { limit: 200 } })
 *   body opcional: { limit?: number; source?: 'fse'|'experiencia'|'produto'; force?: boolean }
 *
 * Secrets necessários:
 *   GOOGLE_MAPS_SERVER_KEY  — chave de servidor (SEM restrição de referrer,
 *                             COM restrição de IP e limitada à Geocoding API).
 *                             Não reutilizar a chave do browser.
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — injetados pela plataforma.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

/** Google Geocoding: ~50 req/s. Ficamos bem abaixo para não apanhar OVER_QUERY_LIMIT. */
const BATCH_DELAY_MS = 120;
const DEFAULT_LIMIT = 200;

interface Pending {
  source: 'fse' | 'experiencia' | 'produto';
  source_id: string;
  query: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Component = { long_name: string; types: string[] };

const picker = (components: Component[]) => (t: string) =>
  components.find((c) => c.types.includes(t))?.long_name ?? null;

function cityFrom(components: Component[]) {
  const pick = picker(components);
  return (
    pick('locality') ||
    pick('postal_town') ||
    pick('administrative_area_level_2') ||
    pick('administrative_area_level_1')
  );
}

/**
 * Em Portugal o administrative_area_level_1 é o distrito ("Distrito de Lisboa",
 * "Faro"). É daqui que `map_destino_from_district` deriva a região turística
 * usada nos chips de Destino — sem isto, os mapas de experiências e produtos
 * caíam todos em 'Sem destino'.
 */
function districtFrom(components: Component[]) {
  const pick = picker(components);
  return pick('administrative_area_level_1') || pick('administrative_area_level_2');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const apiKey = Deno.env.get('GOOGLE_MAPS_SERVER_KEY');
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'GOOGLE_MAPS_SERVER_KEY não configurada' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const body = await req.json().catch(() => ({}));
  const limit: number = Math.min(body.limit ?? DEFAULT_LIMIT, 1000);
  const source: string | undefined = body.source;

  let q = supabase.from('v_map_pending_geocode').select('*').limit(limit);
  if (source) q = q.eq('source', source);

  const { data: pending, error } = await q;
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const rows: Pending[] = pending ?? [];
  let ok = 0;
  let empty = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
      url.searchParams.set('address', row.query);
      url.searchParams.set('region', 'pt');
      url.searchParams.set('language', 'pt-PT');
      url.searchParams.set('components', 'country:PT');
      url.searchParams.set('key', apiKey);

      const res = await fetch(url);
      const json = await res.json();

      if (json.status === 'OK' && json.results?.[0]) {
        const best = json.results[0];
        await supabase.from('map_locations').upsert(
          {
            source: row.source,
            source_id: row.source_id,
            query: row.query,
            latitude: best.geometry.location.lat,
            longitude: best.geometry.location.lng,
            city: cityFrom(best.address_components ?? []),
            district: districtFrom(best.address_components ?? []),
            formatted_address: best.formatted_address,
            status: 'ok',
            geocoded_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'source,source_id' },
        );
        ok++;
      } else if (json.status === 'ZERO_RESULTS') {
        // grava a tentativa para não voltar a pedir a mesma morada em cada corrida
        await supabase.from('map_locations').upsert(
          {
            source: row.source,
            source_id: row.source_id,
            query: row.query,
            status: 'zero_results',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'source,source_id' },
        );
        empty++;
      } else {
        failed++;
        if (errors.length < 10) errors.push(`${row.source_id}: ${json.status}`);
        if (json.status === 'OVER_QUERY_LIMIT') break;
      }
    } catch (e) {
      failed++;
      if (errors.length < 10) errors.push(`${row.source_id}: ${String(e)}`);
    }

    await sleep(BATCH_DELAY_MS);
  }

  return new Response(
    JSON.stringify({
      processed: rows.length,
      ok,
      zero_results: empty,
      failed,
      errors,
      // se `remaining` > 0, volta a invocar
      remaining: rows.length === limit ? 'unknown, re-run' : 0,
    }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } },
  );
});

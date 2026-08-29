/**
 * Mapas do Back Office — dados e estado.
 * Filtros, queries às views do Supabase, rotas via Directions API,
 * e os dados de amostra usados enquanto as views vierem vazias.
 */

import { supabase } from '@/integrations/supabase/client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { useQuery } from '@tanstack/react-query';
import type { MapItem, MapKey, MapsFilters, Price, RouteInfo, Stop } from './core';
import { TODAS_CATEGORIAS, TODOS_DESTINOS, TODOS_PRECOS, haversineKm, humanDuration, matchesQuery, stopsToPath } from './core';

// ─── data/mockMapItems.ts ──────────────────────────────────────

/**
 * Dados de amostra — usados APENAS enquanto as views devolvem 0 linhas
 * (migração por aplicar ou geocoding por correr). Ver useMapsData.
 * Nomes reais tirados da BD para o preview parecer o produto final.
 */

const photo = (seed: string, n: number) =>
  `https://picsum.photos/seed/${seed}${n}/640/420`;

const gallery = (seed: string) => [1, 2, 3, 4].map((n) => photo(seed, n));

const fses: MapItem[] = [
  {
    id: 'mock-fse-1',
    name: 'Sheraton Porto Hotel & Spa *****',
    cat: 'Alojamento',
    dest: '1. Porto e Norte',
    city: 'Porto',
    price: '€€€',
    lat: 41.1621,
    lng: -8.6301,
    docs: 12,
    status: 'Publicado',
    photos: gallery('sheraton'),
    description: 'Hotel 5 estrelas na Boavista, com spa e 266 quartos.',
    contact: 'reservas@sheratonporto.pt',
  },
  {
    id: 'mock-fse-2',
    name: 'Quinta de Sobre a Fonte',
    cat: 'Quintas & Caves',
    dest: '1. Porto e Norte',
    city: 'Vila Real',
    price: '€€',
    lat: 41.2954,
    lng: -7.7462,
    docs: 7,
    status: 'Publicado',
    photos: gallery('sobreafonte'),
    description: 'Quinta no Douro com provas de vinho e almoço vínico.',
    contact: 'sobreafonte@gmail.com',
  },
  {
    id: 'mock-fse-3',
    name: "Cacho d'Oiro",
    cat: 'Restauração',
    dest: '1. Porto e Norte',
    city: 'Braga',
    price: '€€',
    lat: 41.5503,
    lng: -8.42,
    docs: 4,
    status: 'Rascunho',
    photos: gallery('cachodoiro'),
    description: 'Restaurante tradicional minhoto no centro de Braga.',
  },
  {
    id: 'mock-fse-4',
    name: 'Palácio Nacional da Pena',
    cat: 'Monumentos & Museus',
    dest: '3. Lisboa',
    city: 'Sintra',
    price: '€',
    lat: 38.7876,
    lng: -9.3905,
    docs: 9,
    status: 'Publicado',
    photos: gallery('pena'),
    description: 'Palácio romântico em Sintra, património da UNESCO.',
  },
  {
    id: 'mock-fse-5',
    name: 'Transportes Atlântico',
    cat: 'Transportadoras',
    dest: '3. Lisboa',
    city: 'Lisboa',
    price: '€€',
    lat: 38.7223,
    lng: -9.1393,
    docs: 15,
    status: 'Publicado',
    photos: gallery('atlantico'),
    description: 'Frota de minibus 8–19 lugares com motorista.',
  },
  {
    id: 'mock-fse-6',
    name: 'Douro River Cruises',
    cat: 'Barcos',
    dest: '1. Porto e Norte',
    city: 'Peso da Régua',
    price: '€€',
    lat: 41.1621,
    lng: -7.7887,
    docs: 6,
    status: 'Publicado',
    photos: gallery('dourocruise'),
    description: 'Cruzeiros privados no Douro, rabelo e catamarã.',
  },
  {
    id: 'mock-fse-7',
    name: 'Herdade do Esporão',
    cat: 'Quintas & Caves',
    dest: '4. Alentejo',
    city: 'Évora',
    price: '€€€',
    lat: 38.3969,
    lng: -7.7361,
    docs: 11,
    status: 'Publicado',
    photos: gallery('esporao'),
    description: 'Adega, restaurante e provas guiadas em Reguengos.',
  },
  {
    id: 'mock-fse-8',
    name: 'Algarve Adventure Co.',
    cat: 'Animação Turística',
    dest: '5. Algarve',
    city: 'Lagos',
    price: '€€',
    lat: 37.1028,
    lng: -8.6741,
    docs: 5,
    status: 'Rascunho',
    photos: gallery('algarveadv'),
    description: 'Kayak, coasteering e passeios às grutas de Benagil.',
  },
  {
    id: 'mock-fse-9',
    name: 'Guias de Coimbra',
    cat: 'Guias Externos',
    dest: '2. Centro',
    city: 'Coimbra',
    price: '€',
    lat: 40.2033,
    lng: -8.4103,
    docs: 3,
    status: 'Publicado',
    photos: gallery('guiascoimbra'),
    description: 'Guias credenciados PT/EN/ES/FR para a região Centro.',
  },
  {
    id: 'mock-fse-10',
    name: 'Quinta do Furão',
    cat: 'Alojamento',
    dest: '6. Madeira',
    city: 'Santana',
    price: '€€',
    lat: 32.8069,
    lng: -16.8842,
    docs: 8,
    status: 'Publicado',
    photos: gallery('furao'),
    description: 'Hotel rural sobre a falésia norte da Madeira.',
  },
];

const exps: MapItem[] = [
  {
    id: 'mock-exp-1',
    name: 'Prova de Vinhos do Douro com Almoço',
    cat: 'Prova de vinhos',
    dest: '1. Porto e Norte',
    city: 'Peso da Régua',
    price: '€€',
    lat: 41.1621,
    lng: -7.7887,
    dur: '3h',
    status: 'Publicado',
    photos: gallery('provadouro'),
    description: 'Prova de 6 vinhos com enólogo, seguida de almoço na quinta.',
    tags: ['Douro', 'Vinho', 'Gastronomia'],
  },
  {
    id: 'mock-exp-2',
    name: 'Passeio de Rabelo no Douro',
    cat: 'Passeio de barco',
    dest: '1. Porto e Norte',
    city: 'Porto',
    price: '€',
    lat: 41.1408,
    lng: -8.6118,
    dur: '50 min',
    status: 'Publicado',
    photos: gallery('rabelo'),
    description: 'Barco rabelo tradicional, das Caves ao Ponte da Arrábida.',
    tags: ['Rio', 'Clássico'],
  },
  {
    id: 'mock-exp-3',
    name: 'Jantar Fado no Bairro Alto',
    cat: 'Gastronomia',
    dest: '3. Lisboa',
    city: 'Lisboa',
    price: '€€€',
    lat: 38.7139,
    lng: -9.1459,
    dur: '2h 30m',
    status: 'Publicado',
    photos: gallery('fado'),
    description: 'Jantar de 4 pratos com espetáculo de fado ao vivo.',
    tags: ['Fado', 'Noite'],
  },
  {
    id: 'mock-exp-4',
    name: 'Trilho da Levada das 25 Fontes',
    cat: 'Natureza & Aventura',
    dest: '6. Madeira',
    city: 'Calheta',
    price: '€€',
    lat: 32.7607,
    lng: -17.1287,
    dur: '5h',
    status: 'Rascunho',
    photos: gallery('levada'),
    description: 'Caminhada guiada de 11 km na floresta Laurissilva.',
    tags: ['Trilho', 'UNESCO'],
  },
  {
    id: 'mock-exp-5',
    name: 'Évora Romana e Megalítica',
    cat: 'Cultura',
    dest: '4. Alentejo',
    city: 'Évora',
    price: '€€',
    lat: 38.5714,
    lng: -7.9135,
    dur: '4h',
    status: 'Publicado',
    photos: gallery('evora'),
    description: 'Templo romano, Capela dos Ossos e Cromeleque dos Almendres.',
    tags: ['História', 'UNESCO'],
  },
  {
    id: 'mock-exp-6',
    name: 'Grutas de Benagil de Caiaque',
    cat: 'Passeio de barco',
    dest: '5. Algarve',
    city: 'Lagoa',
    price: '€€',
    lat: 37.0873,
    lng: -8.4265,
    dur: '2h',
    status: 'Publicado',
    photos: gallery('benagil'),
    description: 'Caiaque até à gruta de Benagil com paragem para banho.',
    tags: ['Mar', 'Ativo'],
  },
];

const prods: MapItem[] = [
  {
    id: 'mock-prod-1',
    name: 'Douro Valley Private Tour (All-Inclusive)',
    cat: 'Private Guided Tours',
    dest: '1. Porto e Norte',
    city: 'Porto',
    price: '€€€',
    lat: 41.1579,
    lng: -8.6291,
    dur: '8h 30m',
    status: 'Publicado',
    photos: gallery('dourotour'),
    description:
      'Dia completo no Douro: duas quintas, cruzeiro e almoço vínico.',
    tags: ['Douro', 'Privado', 'All-inclusive'],
    stops: [
      { label: 'Porto — Ribeira', lat: 41.1408, lng: -8.6118 },
      { label: 'Amarante', lat: 41.2706, lng: -8.0819 },
      { label: 'Peso da Régua', lat: 41.1621, lng: -7.7887 },
      { label: 'Pinhão', lat: 41.1911, lng: -7.5442 },
      { label: 'Miradouro de São Leonardo', lat: 41.1836, lng: -7.4703 },
    ],
  },
  {
    id: 'mock-prod-2',
    name: 'Tour exclusivo por Braga y Guimarães',
    cat: 'Private Guided Tours',
    dest: '1. Porto e Norte',
    city: 'Braga',
    price: '€€',
    lat: 41.5503,
    lng: -8.42,
    dur: '8h',
    status: 'Publicado',
    photos: gallery('bragaguimaraes'),
    description: 'Bom Jesus, Sé de Braga e centro histórico de Guimarães.',
    tags: ['UNESCO', 'Privado'],
    stops: [
      { label: 'Porto', lat: 41.1579, lng: -8.6291 },
      { label: 'Bom Jesus do Monte', lat: 41.5545, lng: -8.3776 },
      { label: 'Sé de Braga', lat: 41.5503, lng: -8.4279 },
      { label: 'Guimarães — Castelo', lat: 41.4487, lng: -8.2919 },
    ],
  },
  {
    id: 'mock-prod-3',
    name: 'Portugal Essential — 7 Days',
    cat: 'Multi-day Packages',
    dest: '3. Lisboa',
    city: 'Lisboa',
    price: '€€€',
    lat: 38.7223,
    lng: -9.1393,
    dur: '7 dias',
    status: 'Publicado',
    photos: gallery('essential7'),
    description: 'Lisboa, Óbidos, Coimbra, Porto e Douro em 7 dias.',
    tags: ['Multi-day', 'Clássico'],
    stops: [
      { label: 'Lisboa', lat: 38.7223, lng: -9.1393 },
      { label: 'Óbidos', lat: 39.3606, lng: -9.1575 },
      { label: 'Coimbra', lat: 40.2033, lng: -8.4103 },
      { label: 'Porto', lat: 41.1579, lng: -8.6291 },
      { label: 'Pinhão', lat: 41.1911, lng: -7.5442 },
    ],
  },
  {
    id: 'mock-prod-4',
    name: 'Sintra Self-Guided Premium Route',
    cat: 'Premium Self-Guided Tours',
    dest: '3. Lisboa',
    city: 'Sintra',
    price: '€€',
    lat: 38.7976,
    lng: -9.3906,
    dur: '6h',
    status: 'Rascunho',
    photos: gallery('sintraself'),
    description: 'Percurso autoguiado com app, bilhetes e transporte incluídos.',
    tags: ['Self-guided'],
    stops: [
      { label: 'Estação de Sintra', lat: 38.7992, lng: -9.3865 },
      { label: 'Palácio da Pena', lat: 38.7876, lng: -9.3905 },
      { label: 'Quinta da Regaleira', lat: 38.7963, lng: -9.3963 },
      { label: 'Cabo da Roca', lat: 38.7803, lng: -9.4989 },
    ],
  },
  {
    id: 'mock-prod-5',
    name: 'Alentejo 360° Virtual Experience',
    cat: 'Virtual 360° Experiences',
    dest: '4. Alentejo',
    city: 'Évora',
    price: '€',
    lat: 38.5714,
    lng: -7.9135,
    dur: '45 min',
    status: 'Rascunho',
    photos: gallery('alentejo360'),
    description: 'Visita imersiva 360° a Évora e ao Cromeleque dos Almendres.',
    tags: ['Virtual', '360°'],
  },
];

export const MOCK_ITEMS: Record<MapKey, MapItem[]> = { fses, exps, prods };

// ─── hooks/useMapsFilters.ts ───────────────────────────────────

export const DEFAULT_FILTERS: MapsFilters = {
  q: '',
  dest: TODOS_DESTINOS,
  cat: TODAS_CATEGORIAS,
  preco: TODOS_PRECOS,
};

/**
 * Filtros cumulativos (AND) sobre o dataset do mapa ativo.
 * Regra do design: qualquer alteração de filtro limpa a seleção corrente.
 */
export function useMapsFilters(data: MapItem[]) {
  const [filters, setFilters] = useState<MapsFilters>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const items = useMemo(
    () =>
      data.filter(
        (d) =>
          matchesQuery(d, filters.q) &&
          (filters.dest === TODOS_DESTINOS || d.dest === filters.dest) &&
          (filters.cat === TODAS_CATEGORIAS || d.cat === filters.cat) &&
          (filters.preco === TODOS_PRECOS || d.price === filters.preco),
      ),
    [data, filters],
  );

  const patch = useCallback((p: Partial<MapsFilters>) => {
    setFilters((f) => ({ ...f, ...p }));
    setSelectedId(null);
  }, []);

  const clear = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setSelectedId(null);
  }, []);

  /** contagens vêm do dataset NÃO filtrado do mapa ativo */
  const destCount = useCallback(
    (dest: string) =>
      dest === TODOS_DESTINOS
        ? data.length
        : data.filter((d) => d.dest === dest).length,
    [data],
  );

  const catCount = useCallback(
    (cat: string) =>
      cat === TODAS_CATEGORIAS
        ? data.length
        : data.filter((d) => d.cat === cat).length,
    [data],
  );

  const selected = useMemo(
    () => items.find((i) => i.id === selectedId) ?? null,
    [items, selectedId],
  );

  const isDirty =
    filters.q !== '' ||
    filters.dest !== TODOS_DESTINOS ||
    filters.cat !== TODAS_CATEGORIAS ||
    filters.preco !== TODOS_PRECOS;

  return {
    filters,
    patch,
    clear,
    isDirty,
    items,
    selected,
    selectedId,
    setSelectedId,
    destCount,
    catCount,
  };
}

// ─── hooks/useMapsData.ts ──────────────────────────────────────

const VIEW_BY_MAP: Record<MapKey, string> = {
  fses: 'v_map_fses',
  exps: 'v_map_experiencias',
  prods: 'v_map_produtos',
};

/**
 * Enquanto a migração + geocoding não correrem, as views devolvem 0 linhas.
 * Neste caso caímos para dados de amostra para a página continuar demonstrável.
 * Assim que houver dados reais, o mock deixa de ser usado.
 * Para desligar o fallback em produção: VITE_MAPAS_ALLOW_MOCK=false
 */
const ALLOW_MOCK = import.meta.env.VITE_MAPAS_ALLOW_MOCK !== 'false';

interface ViewRow {
  id: string;
  name: string;
  cat: string;
  dest: string;
  city: string | null;
  price: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  docs: number | null;
  dur: string | null;
  status: string | null;
  description: string | null;
  drive_url: string | null;
  images?: unknown;
  addresses?: unknown;
}

const num = (v: number | string | null): number =>
  typeof v === 'number' ? v : Number(v ?? 0);

/** magpie_products.images é jsonb: array de strings ou de { url } */
function imagesFrom(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const urls = raw
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      if (entry && typeof entry === 'object') {
        const o = entry as Record<string, unknown>;
        return (o.url ?? o.src ?? o.large ?? o.original) as string | undefined;
      }
      return undefined;
    })
    .filter((u): u is string => typeof u === 'string' && u.length > 0);
  return urls.length ? urls.slice(0, 6) : undefined;
}

function toMapItem(row: ViewRow): MapItem {
  return {
    id: row.id,
    name: row.name,
    cat: row.cat,
    dest: row.dest,
    city: row.city ?? '',
    price: (row.price as Price) ?? '€€',
    lat: num(row.latitude),
    lng: num(row.longitude),
    docs: row.docs ?? undefined,
    dur: row.dur ?? undefined,
    status: (row.status as MapItem['status']) ?? undefined,
    description: row.description ?? undefined,
    photos: imagesFrom(row.images),
    driveUrl: row.drive_url ?? undefined,
  };
}

async function fetchMap(map: MapKey): Promise<MapItem[]> {
  const { data, error } = await supabase
    .from(VIEW_BY_MAP[map] as never)
    .select('*')
    .order('name');

  if (error) throw error;

  const rows = (data ?? []) as unknown as ViewRow[];
  const items = rows.map(toMapItem).filter((i) => i.lat !== 0 || i.lng !== 0);

  if (!items.length && ALLOW_MOCK) return MOCK_ITEMS[map];
  return items;
}

export function useMapsData(map: MapKey) {
  return useQuery({
    queryKey: ['mapas', map],
    queryFn: () => fetchMap(map),
    staleTime: 5 * 60 * 1000,
  });
}

/** Paragens do itinerário de um produto — só é chamado quando há seleção. */
export function useProductStops(productRef: string | null) {
  return useQuery({
    queryKey: ['mapas', 'stops', productRef],
    enabled: !!productRef,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Stop[]> => {
      const { data, error } = await supabase
        .from('v_map_produto_stops' as never)
        .select('*')
        .eq('product_ref', productRef!)
        .order('ord');

      if (error) throw error;

      return ((data ?? []) as unknown as Array<{
        label: string;
        latitude: number | string;
        longitude: number | string;
      }>).map((s) => ({
        label: s.label,
        lat: num(s.latitude),
        lng: num(s.longitude),
      }));
    },
  });
}

/** Quantas entidades ainda estão por geocodificar — mostra um aviso na UI. */
export function usePendingGeocode() {
  return useQuery({
    queryKey: ['mapas', 'pending-geocode'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('v_map_pending_geocode' as never)
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });
}

// ─── hooks/useRoute.ts ─────────────────────────────────────────

/**
 * Geometria real da rota via Directions API.
 * Fallback: linhas retas entre paragens + haversine × 1.25 (marcado como
 * `approximate`, para a UI poder assinalar que o valor é estimado).
 *
 * A Directions API aceita no máximo 25 waypoints (23 intermédios). Itinerários
 * maiores são truncados de forma uniforme, preservando origem e destino.
 */
const MAX_WAYPOINTS = 23;

function sampleStops(stops: Stop[]): Stop[] {
  if (stops.length <= MAX_WAYPOINTS + 2) return stops;
  const middle = stops.slice(1, -1);
  const step = middle.length / MAX_WAYPOINTS;
  const picked = Array.from(
    { length: MAX_WAYPOINTS },
    (_, i) => middle[Math.floor(i * step)],
  );
  return [stops[0], ...picked, stops[stops.length - 1]];
}

export function useRoute(stops: Stop[] | undefined): RouteInfo | null {
  const routesLib = useMapsLibrary('routes');
  const [route, setRoute] = useState<RouteInfo | null>(null);

  useEffect(() => {
    if (!stops || stops.length < 2) {
      setRoute(null);
      return;
    }

    const fallback: RouteInfo = {
      path: stopsToPath(stops),
      km: haversineKm(stops),
      duration: null,
      approximate: true,
    };

    if (!routesLib) {
      setRoute(fallback);
      return;
    }

    let cancelled = false;
    const sampled = sampleStops(stops);
    const service = new routesLib.DirectionsService();

    service
      .route({
        origin: { lat: sampled[0].lat, lng: sampled[0].lng },
        destination: {
          lat: sampled[sampled.length - 1].lat,
          lng: sampled[sampled.length - 1].lng,
        },
        waypoints: sampled.slice(1, -1).map((s) => ({
          location: { lat: s.lat, lng: s.lng },
          stopover: true,
        })),
        travelMode: routesLib.TravelMode.DRIVING,
        region: 'pt',
      })
      .then((result) => {
        if (cancelled) return;
        const leg = result.routes[0]?.legs ?? [];
        const meters = leg.reduce((sum, l) => sum + (l.distance?.value ?? 0), 0);
        const seconds = leg.reduce((sum, l) => sum + (l.duration?.value ?? 0), 0);
        setRoute({
          path: result.routes[0].overview_path.map((p) => ({
            lat: p.lat(),
            lng: p.lng(),
          })),
          km: Math.round(meters / 1000),
          duration: humanDuration(seconds),
          approximate: false,
        });
      })
      .catch(() => {
        if (!cancelled) setRoute(fallback);
      });

    return () => {
      cancelled = true;
    };
  }, [routesLib, stops]);

  return route;
}

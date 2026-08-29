/**
 * Mapas do Back Office — núcleo da feature.
 * Tipos, constantes, taxonomias, tokens visuais e utilitários puros.
 * Sem React: só dados e funções.
 */



// ─── types.ts ──────────────────────────────────────────────────

export type MapKey = 'fses' | 'exps' | 'prods';
export type Section = 'sup' | 'prod';
export type Price = '€' | '€€' | '€€€';

export interface Stop {
  label: string;
  lat: number;
  lng: number;
}

export interface MapItem {
  /** id estável da fonte (drive_id, supplier_service.id, magpie_id) */
  id: string;
  name: string;
  /** categoria FSE | tipo de experiência | categoria de produto */
  cat: string;
  /** '1. Porto e Norte' … '7. Açores' | 'Sem destino' */
  dest: string;
  city: string;
  price: Price;
  lat: number;
  lng: number;
  /** FSEs: nº de ficheiros no Drive */
  docs?: number;
  /** experiências / produtos: duração legível */
  dur?: string;
  status?: 'Rascunho' | 'Publicado';
  photos?: string[];
  description?: string;
  tags?: string[];
  contact?: string;
  driveUrl?: string;
  detailUrl?: string;
  /** itinerário → desenha rota no mapa */
  stops?: Stop[];
}

export interface MapsFilters {
  q: string;
  dest: string;
  cat: string;
  preco: string;
}

export interface RouteInfo {
  /** polyline a desenhar (geometria real das directions, ou linha reta como fallback) */
  path: google.maps.LatLngLiteral[];
  km: number;
  duration: string | null;
  /** true quando as directions falharam e estamos a desenhar linhas retas */
  approximate: boolean;
}

// ─── constants.ts ──────────────────────────────────────────────

export const TODOS_DESTINOS = 'Todos os destinos';
export const TODAS_CATEGORIAS = 'Todas';
export const TODOS_PRECOS = 'Todos os preços';
export const SEM_DESTINO = 'Sem destino';

/** Destinos com a numeração exata das pastas do Drive. */
export const DESTINOS = [
  '1. Porto e Norte',
  '2. Centro',
  '3. Lisboa',
  '4. Alentejo',
  '5. Algarve',
  '6. Madeira',
  '7. Açores',
] as const;

/**
 * A BD guarda `region` sem número ('Porto e Norte', 'Lisboa', …).
 * Este mapa normaliza para o label numerado usado nos chips.
 */
export const REGION_TO_DESTINO: Record<string, string> = {
  'porto e norte': '1. Porto e Norte',
  norte: '1. Porto e Norte',
  centro: '2. Centro',
  lisboa: '3. Lisboa',
  alentejo: '4. Alentejo',
  algarve: '5. Algarve',
  madeira: '6. Madeira',
  açores: '7. Açores',
  acores: '7. Açores',
};

export const toDestino = (region?: string | null): string =>
  (region && REGION_TO_DESTINO[region.trim().toLowerCase()]) || SEM_DESTINO;

export const CATEGORIAS_FSE = [
  'Alojamento',
  'Animação Turística',
  'Quintas & Caves',
  'Monumentos & Museus',
  'Guias Externos',
  'Barcos',
  'Transportadoras',
  'Restauração',
] as const;

export const TIPOS_EXPERIENCIA = [
  'Prova de vinhos',
  'Passeio de barco',
  'Gastronomia',
  'Natureza & Aventura',
  'Cultura',
] as const;

export const CATEGORIAS_PRODUTO = [
  'Private Guided Tours',
  'Multi-day Packages',
  'Premium Self-Guided Tours',
  'Virtual 360° Experiences',
  'Destination Guides',
] as const;

/** taxonomia por mapa — usada para a ordem dos chips e da legenda */
export const TAXONOMY: Record<MapKey, readonly string[]> = {
  fses: CATEGORIAS_FSE,
  exps: TIPOS_EXPERIENCIA,
  prods: CATEGORIAS_PRODUTO,
};

export const SECTION_TABS: Array<{ key: Section; label: string }> = [
  { key: 'sup', label: 'Suppliers & FSEs' },
  { key: 'prod', label: 'Catálogo Produtos YT' },
];

export const MAPS_BY_SECTION: Record<Section, MapKey[]> = {
  sup: ['fses', 'exps'],
  prod: ['prods'],
};

export const MAP_META: Record<
  MapKey,
  { label: string; placeholder: string; subtitle: string; section: Section }
> = {
  fses: {
    label: 'Mapa FSEs',
    placeholder: 'Pesquisar por nome de fornecedor…',
    subtitle:
      'Fornecedores e experiências georreferenciados — espelho da Base de Dados FSE',
    section: 'sup',
  },
  exps: {
    label: 'Mapa Experiências',
    placeholder: 'Pesquisar por nome de experiência…',
    subtitle:
      'Fornecedores e experiências georreferenciados — espelho da Base de Dados FSE',
    section: 'sup',
  },
  prods: {
    label: 'Mapa Produtos YT',
    placeholder: 'Pesquisar por nome de produto…',
    subtitle:
      'Produtos importados de Magpie, posicionados por destino e ponto de partida',
    section: 'prod',
  },
};

export const PRECOS = [TODOS_PRECOS, '€', '€€', '€€€'] as const;

/** centro/zoom inicial: Portugal continental */
export const PT_CENTER: google.maps.LatLngLiteral = { lat: 39.6, lng: -8.2 };
export const PT_ZOOM = 6.6;
export const FOCUS_ZOOM = 11;

/** largura por omissão do painel de resultados */
export const PANEL_DEFAULT_WIDTH = 392;
export const PANEL_MAX_WIDTH = 620;
export const PANEL_SNAP_WIDTH = 120;

// ─── tokens.ts ─────────────────────────────────────────────────

/**
 * Tokens visuais dos Mapas do Back Office.
 *
 * NOTA: o resto da app usa tokens HSL em `index.css` (--primary, --border, …).
 * Estes mapas têm um tema azul/prateado próprio, de alta fidelidade, definido
 * em hex. São propositadamente locais a esta feature — não os promovas para
 * o tailwind.config global.
 */

export const ICONS: Record<string, string> = {
  Alojamento: '🏨',
  'Animação Turística': '🪂',
  'Quintas & Caves': '🍷',
  'Monumentos & Museus': '🏛️',
  'Guias Externos': '🧭',
  Barcos: '⛵',
  Transportadoras: '🚐',
  Restauração: '🍽️',
  'Prova de vinhos': '🍷',
  'Passeio de barco': '⛵',
  Gastronomia: '🍽️',
  'Natureza & Aventura': '🥾',
  Cultura: '🏛️',
  'Private Guided Tours': '🚐',
  'Multi-day Packages': '🧳',
  'Premium Self-Guided Tours': '🗺️',
  'Virtual 360° Experiences': '🎧',
  'Destination Guides': '📘',
};

export const FALLBACK_ICON = '📍';

/** cor por índice de categoria dentro do mapa ativo */
export const CATEGORY_PALETTE = [
  '#1a80e5',
  '#0f766e',
  '#c2410c',
  '#7c3aed',
  '#be123c',
  '#0369a1',
  '#4d7c0f',
];

export const T = {
  navy: '#0f2f56',
  navyDeep: '#0d2a4d',
  navyMid: '#143d6e',
  route: '#12408f',
  primary: '#1a80e5',
  primaryHover: '#1263bb',
  blueBright: '#3d9bff',
  blueLight: '#4fa9ff',
  aqua: '#38e1f0',
  water: '#a9e9f2',
  text: '#0f172a',
  text2: '#334155',
  text3: '#475569',
  muted: '#64748b',
  faint: '#94a3b8',
  border: '#dbe3ec',
  border2: '#d7e2ef',
  border3: '#e3ebf5',
  border4: '#e2e8f0',
  rule: '#eef2f7',
  surface: '#ffffff',
  surface2: '#f6f9fd',
  surface3: '#f2f7fc',
  surface4: '#f1f5f9',
  priceGreen: '#0f766e',
  grad: {
    page: 'linear-gradient(160deg,#f4f8fc 0%,#e6edf6 45%,#dde6f2 100%)',
    header: 'linear-gradient(180deg,#ffffff 0%,#eff5fc 60%,#e6eef8 100%)',
    primaryBtn: 'linear-gradient(180deg,#3d9bff,#12408f)',
    primaryBtnHover: 'linear-gradient(180deg,#2f8bef,#0e356f)',
    routeBar: 'linear-gradient(90deg,#12408f,#38e1f0)',
    chipOff: 'linear-gradient(180deg,#ffffff,#f2f7fc)',
    chipDest: 'linear-gradient(180deg,#3d9bff,#12408f)',
    chipCat: 'linear-gradient(180deg,#173f6d,#0d2a4d)',
    cardSel: 'linear-gradient(135deg,#e9f3ff,#fbfdff)',
    card: 'linear-gradient(180deg,#ffffff,#fafcfe)',
    panel: 'linear-gradient(180deg,#ffffff,#f6f9fd)',
    pills: 'linear-gradient(180deg,#dfe8f3,#eaf1f9)',
    glass:
      'linear-gradient(180deg,rgba(255,255,255,.97),rgba(240,246,252,.95))',
    handle: 'linear-gradient(180deg,#e9f0f8,#dde7f3)',
    handleHover: 'linear-gradient(180deg,#d5e6fb,#c6dcf7)',
    titleBar: 'linear-gradient(180deg,#4fa9ff,#12408f)',
  },
  shadow: {
    pill: '0 1px 4px rgba(15,23,42,.12)',
    btn: '0 4px 14px rgba(18,64,143,.35)',
    panel: '0 10px 28px rgba(15,47,86,.18)',
    route: '0 18px 44px rgba(15,23,42,.24)',
    hover: '0 24px 60px rgba(15,23,42,.28)',
    pin: '0 3px 10px rgba(15,23,42,.28)',
    stop: '0 3px 10px rgba(15,23,42,.3)',
    rail: '1px 0 12px rgba(15,47,86,.06)',
    zoom: '0 4px 14px rgba(15,23,42,.16)',
    grip: '0 3px 10px rgba(15,47,86,.18)',
  },
  font: "'Plus Jakarta Sans', Inter, system-ui, sans-serif",
} as const;

/** estilo das 3 polylines empilhadas da rota (ordem = ordem de desenho) */
export const ROUTE_LINES: Array<{
  color: string;
  weight: number;
  opacity: number;
  dashed?: boolean;
}> = [
  { color: '#ffffff', weight: 9, opacity: 0.95 },
  { color: '#12408f', weight: 4.5, opacity: 1 },
  { color: '#38e1f0', weight: 4.5, opacity: 0.9, dashed: true },
];

// ─── utils.ts ──────────────────────────────────────────────────

export const iconFor = (cat: string) => ICONS[cat] ?? FALLBACK_ICON;

/** cor determinística por categoria dentro da taxonomia do mapa ativo */
export const colorForIndex = (index: number) =>
  CATEGORY_PALETTE[Math.max(0, index) % CATEGORY_PALETTE.length];

export const makeColorFor = (taxonomy: readonly string[]) => (cat: string) =>
  colorForIndex(Math.max(0, taxonomy.indexOf(cat)));

/** cor de categoria a 8% de alpha, para fundos de chips */
export const alpha = (hex: string, aa: string) => `${hex}${aa}`;

/**
 * Distância aproximada de um itinerário: haversine encadeado × 1.25 (fator de estrada).
 * Usado apenas como fallback quando o Directions Service falha — o valor real
 * vem de `google.maps.DirectionsResult`.
 */
export function haversineKm(stops: Array<{ lat: number; lng: number }>) {
  const R = 6371;
  const rad = (x: number) => (x * Math.PI) / 180;
  let km = 0;
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    const dLat = rad(b.lat - a.lat);
    const dLon = rad(b.lng - a.lng);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    km += 2 * R * Math.asin(Math.sqrt(h));
  }
  return Math.round(km * 1.25);
}

export const stopsToPath = (stops: Stop[]): google.maps.LatLngLiteral[] =>
  stops.map((s) => ({ lat: s.lat, lng: s.lng }));

export function boundsOf(points: Array<{ lat: number; lng: number }>) {
  const b = new google.maps.LatLngBounds();
  points.forEach((p) => b.extend(p));
  return b;
}

/** "2h 30m" a partir de segundos das directions */
export function humanDuration(seconds: number | null | undefined) {
  if (!seconds) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h ? `${h}h ${m ? `${m}m` : ''}`.trim() : `${m}m`;
}

/** banda de preço a partir de um valor em EUR */
export function priceBand(value: number | null | undefined): Price {
  if (value == null || Number.isNaN(value)) return '€€';
  if (value < 60) return '€';
  if (value < 180) return '€€';
  return '€€€';
}

export const matchesQuery = (item: MapItem, q: string) => {
  if (!q) return true;
  const needle = q.trim().toLowerCase();
  return (
    item.name.toLowerCase().includes(needle) ||
    item.city.toLowerCase().includes(needle)
  );
};

/** true quando o item tem itinerário desenhável */
export const hasRoute = (item?: MapItem | null): item is MapItem =>
  !!item?.stops && item.stops.length > 1;

/** clamp da posição do cartão de hover ao viewport */
export function clampPreview(x: number, y: number) {
  const width = 404;
  const height = 470;
  return {
    left: Math.min(x, window.innerWidth - (width + 32)),
    top: Math.min(Math.max(y, 16), Math.max(16, window.innerHeight - height)),
  };
}

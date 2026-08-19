// FSE structure helpers.
// Source of truth for the tree is the Drive index (`fse_drive_index`), which
// mirrors the folder "Nova pasta comercial claudio yt 2026 2027":
//   REGIÃO > DISTRITO > CATEGORIA > FORNECEDOR > ficheiros
// The lists below are only the official baseline (7 regions + districts) used
// for manual entry and as fallback before the index is synced.

import { supabase } from "@/integrations/supabase/client";

export interface FSEDocument {
  name: string;
  status: "active" | "empty" | "multi-destination";
  docCount: number;
  googleDriveUrl?: string;
}

export interface FSECategory {
  id: string;
  label: string;
  shortLabel: string;
  documents: FSEDocument[];
}

export interface FSEDestination {
  name: string;
  categories: FSECategory[];
}

export interface FSERegion {
  name: string;
  districts: string[];
}

/** Category ids are stable internal ids; labels match the Drive folder names. */
export const CATEGORY_DEFS = [
  { id: "mon", label: "Monumentos & Museus", shortLabel: "Monumentos" },
  { id: "aloj", label: "Alojamento", shortLabel: "Alojamento" },
  { id: "anim", label: "Animação Turística", shortLabel: "Anim. Turística" },
  { id: "guias", label: "Guias Externos", shortLabel: "Guias" },
  { id: "quintas", label: "Quintas & Caves", shortLabel: "Quintas & Caves" },
  { id: "rest", label: "Restauração", shortLabel: "Restauração" },
  { id: "mar", label: "Barcos", shortLabel: "Barcos" },
  { id: "terr", label: "Transportadoras", shortLabel: "Transportadoras" },
] as const;

export const FSE_CATEGORIES = CATEGORY_DEFS.map(c => ({ value: c.id, label: c.label }));

/** 7 official regions with their districts (baseline — grows from the Drive index). */
export const FSE_REGIONS: FSERegion[] = [
  { name: "Porto e Norte", districts: ["Porto", "Braga", "Viana do Castelo", "Vila Real", "Bragança"] },
  { name: "Centro", districts: ["Aveiro", "Coimbra", "Viseu", "Guarda", "Castelo Branco", "Leiria"] },
  { name: "Lisboa", districts: ["Lisboa", "Setúbal", "Santarém"] },
  { name: "Alentejo", districts: ["Évora", "Beja", "Portalegre"] },
  { name: "Algarve", districts: ["Faro"] },
  { name: "Madeira", districts: ["Madeira"] },
  { name: "Açores", districts: ["Açores"] },
];

export const FSE_REGION_NAMES = FSE_REGIONS.map(r => r.name);

/** Backwards-compatible destination scaffolding (one entry per region). */
export const FSE_DESTINATIONS: FSEDestination[] = FSE_REGIONS.map(r => ({
  name: r.name,
  categories: CATEGORY_DEFS.map(def => ({ ...def, documents: [] as FSEDocument[] })),
}));

/**
 * Reads the live region → district map from the Drive index so the lists grow
 * automatically as the Drive folder grows. Falls back to FSE_REGIONS.
 */
export async function fetchRegionsFromIndex(): Promise<FSERegion[]> {
  const { data, error } = await supabase
    .from("fse_drive_index")
    .select("region,district")
    .not("region", "is", null);

  if (error || !data?.length) return FSE_REGIONS;

  const map = new Map<string, Set<string>>();
  FSE_REGIONS.forEach(r => map.set(r.name, new Set(r.districts)));
  for (const row of data as { region: string | null; district: string | null }[]) {
    if (!row.region) continue;
    if (!map.has(row.region)) map.set(row.region, new Set());
    if (row.district) map.get(row.region)!.add(row.district);
  }

  const order = new Map(FSE_REGION_NAMES.map((n, i) => [n, i]));
  return Array.from(map.entries())
    .sort((a, b) => (order.get(a[0]) ?? 99) - (order.get(b[0]) ?? 99) || a[0].localeCompare(b[0]))
    .map(([name, districts]) => ({ name, districts: Array.from(districts).sort((x, y) => x.localeCompare(y)) }));
}

// Computed stats over whatever destination tree is supplied/derived
export function getFSEStats(destinations: FSEDestination[] = FSE_DESTINATIONS) {
  let totalDocs = 0;
  let filledCats = 0;
  let totalCats = 0;
  let activeDestinations = 0;
  const multiPartners = new Set<string>();

  for (const dest of destinations) {
    let destHasDocs = false;
    for (const cat of dest.categories) {
      totalCats++;
      totalDocs += cat.documents.reduce((sum, doc) => sum + (doc.docCount || 1), 0);
      if (cat.documents.length > 0) {
        filledCats++;
        destHasDocs = true;
      }
      for (const doc of cat.documents) {
        if (doc.status === "multi-destination") multiPartners.add(doc.name);
      }
    }
    if (destHasDocs) activeDestinations++;
  }

  return {
    totalDocs,
    filledCats,
    totalCats,
    activeDestinations,
    totalDestinations: destinations.length,
    multiPartnerCount: multiPartners.size,
  };
}

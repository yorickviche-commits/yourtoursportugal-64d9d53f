// FSE Database mock data — will be replaced by Supabase table `fse_documents`

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

const CATEGORY_DEFS = [
  { id: "mon", label: "0 - Monumentos Nacionais", shortLabel: "Monumentos" },
  { id: "aloj", label: "1 - Alojamento", shortLabel: "Alojamento" },
  { id: "anim", label: "2 - Animação Turística", shortLabel: "Anim. Turística" },
  { id: "guias", label: "3 - Guias Externos", shortLabel: "Guias Externos" },
  { id: "quintas", label: "4 - Quintas & Caves", shortLabel: "Quintas & Caves" },
  { id: "rest", label: "5 - Restauração", shortLabel: "Restauração" },
  { id: "mar", label: "6 - Transp. Marítimos", shortLabel: "Transp. Marítimos" },
  { id: "terr", label: "7 - Transp. Terrestres", shortLabel: "Transp. Terrestres" },
] as const;

type CatId = typeof CATEGORY_DEFS[number]["id"];

// Raw seed: { destination: { catId: { count, multi?, docs? } } }
interface SeedEntry { count: number; multi?: boolean; docs?: FSEDocument[] }

const seed: Record<string, Partial<Record<CatId, SeedEntry>>> = {
  "Açores": {},
  "Alentejo": {
    aloj: { count: 1, docs: [{ name: "Hotel Rural Alentejo", status: "active", docCount: 1 }] },
    quintas: { count: 1, docs: [{ name: "Herdade do Esporão", status: "active", docCount: 1 }] },
    rest: { count: 1, docs: [{ name: "Restaurante Fialho", status: "active", docCount: 1 }] },
  },
  "Algarve": {
    anim: { count: 1, docs: [{ name: "AlgarExperience", status: "active", docCount: 1 }] },
    quintas: { count: 1, docs: [{ name: "Quinta dos Vales", status: "active", docCount: 1 }] },
    rest: { count: 1, docs: [{ name: "Restaurante Bon Bon", status: "active", docCount: 1 }] },
    mar: { count: 1, docs: [{ name: "Passeios de Barco Algarve", status: "active", docCount: 1 }] },
  },
  "Centro": {
    anim: { count: 1, docs: [{ name: "Centro Aventura", status: "active", docCount: 1 }] },
    quintas: { count: 1, docs: [{ name: "Quinta das Lágrimas", status: "active", docCount: 1 }] },
    rest: { count: 1, docs: [{ name: "Restaurante Pedro dos Leitões", status: "active", docCount: 1 }] },
    mar: { count: 1, docs: [{ name: "Passeios Rio Mondego", status: "active", docCount: 1 }] },
  },
  "Douro": {
    quintas: { count: 18, docs: Array.from({ length: 18 }, (_, i) => ({
      name: `Quinta Douro ${i + 1}`,
      status: "active" as const,
      docCount: 1,
    }))},
    rest: { count: 1, docs: [{ name: "DOC Restaurante", status: "active", docCount: 1 }] },
    mar: { count: 1, docs: [{ name: "Cruzeiros Douro", status: "active", docCount: 1 }] },
  },
  "Lisboa": {
    anim: { count: 3, multi: true, docs: [
      { name: "Living Tours (saída Lisboa)", status: "multi-destination", docCount: 1, googleDriveUrl: "#" },
      { name: "2Feel (saída Lisboa)", status: "multi-destination", docCount: 1, googleDriveUrl: "#" },
      { name: "LX Tours", status: "active", docCount: 1 },
    ]},
    rest: { count: 2, docs: [
      { name: "Belcanto", status: "active", docCount: 1 },
      { name: "Time Out Market", status: "active", docCount: 1 },
    ]},
    mar: { count: 1, docs: [{ name: "Lisbon by Boat", status: "active", docCount: 1 }] },
    terr: { count: 2, multi: true, docs: [
      { name: "Living Tours Transfers (saída Lisboa)", status: "multi-destination", docCount: 1, googleDriveUrl: "#" },
      { name: "2Feel Transfers (saída Lisboa)", status: "multi-destination", docCount: 1, googleDriveUrl: "#" },
    ]},
  },
  "Madeira": {},
  "Norte": {
    anim: { count: 1, docs: [{ name: "Peneda Gerês Tours", status: "active", docCount: 1 }] },
    quintas: { count: 1, docs: [{ name: "Quinta de Covela", status: "active", docCount: 1 }] },
    rest: { count: 1, docs: [{ name: "Restaurante DOP", status: "active", docCount: 1 }] },
    mar: { count: 1, docs: [{ name: "Rio Douro Navegações", status: "active", docCount: 1 }] },
    terr: { count: 1, docs: [{ name: "Norte Transfer Service", status: "active", docCount: 1 }] },
  },
  "Porto": {
    anim: { count: 2, multi: true, docs: [
      { name: "Living Tours (saída Porto)", status: "multi-destination", docCount: 1, googleDriveUrl: "#" },
      { name: "2Feel (saída Porto)", status: "multi-destination", docCount: 1, googleDriveUrl: "#" },
    ]},
    guias: { count: 1, docs: [{ name: "Porto Walking Tours", status: "active", docCount: 1 }] },
    quintas: { count: 9, docs: Array.from({ length: 9 }, (_, i) => ({
      name: `Quinta Porto ${i + 1}`,
      status: "active" as const,
      docCount: 1,
    }))},
    rest: { count: 1, docs: [{ name: "Cantinho do Avillez", status: "active", docCount: 1 }] },
    mar: { count: 1, docs: [{ name: "Cruzeiros Porto", status: "active", docCount: 1 }] },
    terr: { count: 1, docs: [{ name: "Porto Transfer Service", status: "active", docCount: 1 }] },
    mon: { count: 2, docs: [
      { name: "Torre dos Clérigos", status: "active", docCount: 1 },
      { name: "Palácio da Bolsa", status: "active", docCount: 1 },
    ]},
  },
};

function buildDestination(name: string): FSEDestination {
  const s = seed[name] || {};
  const categories: FSECategory[] = CATEGORY_DEFS.map(def => {
    const entry = s[def.id];
    return {
      id: def.id,
      label: def.label,
      shortLabel: def.shortLabel,
      documents: entry?.docs ?? [],
    };
  });
  return { name, categories };
}

export const FSE_DESTINATIONS: FSEDestination[] = [
  "Açores", "Alentejo", "Algarve", "Centro", "Douro", "Lisboa", "Madeira", "Norte", "Porto"
].map(buildDestination);

// Computed stats
export function getFSEStats() {
  let totalDocs = 0;
  let filledCats = 0;
  let totalCats = 0;
  let activeDestinations = 0;
  const multiPartners = new Set<string>();

  for (const dest of FSE_DESTINATIONS) {
    let destHasDocs = false;
    for (const cat of dest.categories) {
      totalCats++;
      const docCount = cat.documents.length;
      totalDocs += docCount;
      if (docCount > 0) {
        filledCats++;
        destHasDocs = true;
      }
      for (const doc of cat.documents) {
        if (doc.status === "multi-destination") {
          const base = doc.name.replace(/\s*\(saída.*\)/, "").replace(/\s*Transfers/, "");
          multiPartners.add(base);
        }
      }
    }
    if (destHasDocs) activeDestinations++;
  }

  return {
    totalDocs,
    filledCats,
    totalCats,
    activeDestinations,
    totalDestinations: FSE_DESTINATIONS.length,
    multiPartnerCount: multiPartners.size,
  };
}

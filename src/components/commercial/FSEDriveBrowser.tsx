import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Folder, FileText, ExternalLink, Search, ChevronDown, ChevronRight, Loader2, Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DriveNode {
  drive_id: string;
  parent_drive_id: string | null;
  name: string;
  mime_type: string;
  category: string | null;
  region: string | null;
  district: string | null;
  supplier_name: string | null;
  path: string;
  web_view_link: string | null;
  depth: number;
}

const FOLDER_MIME = "application/vnd.google-apps.folder";

const normalizeText = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase();

const stripFileExt = (value: string) => value.replace(/\.(xlsx|pdf|docx|pptx|xls|doc)$/i, "");

/** Fallback only — region/district now come straight from the Drive index. */
const inferRegion = (value: string | null | undefined) => {
  const text = normalizeText(value || "");
  if (text.includes("lisboa") || text.includes("ribatejo") || text.includes("setubal")) return "Lisboa";
  if (text.includes("porto") || text.includes("minho") || text.includes("braga") || text.includes("norte")) return "Porto e Norte";
  if (text.includes("douro") || text.includes("tras os montes") || text.includes("vila real")) return "Porto e Norte";
  if (text.includes("alentejo") || text.includes("evora") || text.includes("beja")) return "Alentejo";
  if (text.includes("algarve") || text.includes("faro")) return "Algarve";
  if (text.includes("centro") || text.includes("oeste") || text.includes("fatima") || text.includes("coimbra")) return "Centro";
  if (text.includes("madeira")) return "Madeira";
  if (text.includes("acores")) return "Açores";
  return value || "— Sem região";
};

const fileIcon = (mime: string) => {
  if (mime === FOLDER_MIME) return <Folder className="h-3.5 w-3.5 text-amber-500" />;
  return <FileText className="h-3.5 w-3.5 text-blue-500" />;
};

const FilePreviewDialog = ({ file, onClose }: { file: DriveNode | null; onClose: () => void }) => {
  if (!file) return null;
  const previewUrl = `https://drive.google.com/file/d/${file.drive_id}/preview`;
  return (
    <Dialog open={!!file} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2 border-b">
          <DialogTitle className="text-sm flex items-center gap-2 pr-8">
            {fileIcon(file.mime_type)}
            <span className="truncate">{file.name}</span>
            {file.web_view_link && (
              <a
                href={file.web_view_link}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" /> Abrir no Drive
              </a>
            )}
          </DialogTitle>
          <p className="text-[11px] text-muted-foreground truncate">{file.path}</p>
        </DialogHeader>
        <div className="flex-1 bg-muted/30">
          <iframe
            src={previewUrl}
            className="w-full h-full border-0"
            allow="autoplay"
            title={file.name}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface FSEDriveBrowserProps {
  initialCategory?: string | null;
  initialRegion?: string | null;
  initialDistrict?: string | null;
  initialSearch?: string;
  compact?: boolean;
}

type SupplierMap = Record<string, DriveNode[]>;
type CategoryMap = Record<string, SupplierMap>;
type DistrictMap = Record<string, CategoryMap>;
type RegionMap = Record<string, DistrictMap>;

const countSuppliers = (s: SupplierMap) => Object.values(s).reduce((n, f) => n + f.length, 0);
const countCategories = (c: CategoryMap) => Object.values(c).reduce((n, s) => n + countSuppliers(s), 0);
const countDistricts = (d: DistrictMap) => Object.values(d).reduce((n, c) => n + countCategories(c), 0);

export const FSEDriveBrowser = ({
  initialCategory = null,
  initialRegion = null,
  initialDistrict = null,
  initialSearch = "",
  compact = false,
}: FSEDriveBrowserProps = {}) => {
  const [nodes, setNodes] = useState<DriveNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialSearch);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(initialCategory);
  const [regionFilter, setRegionFilter] = useState<string | null>(initialRegion);
  const [districtFilter, setDistrictFilter] = useState<string | null>(initialDistrict);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<DriveNode | null>(null);

  useEffect(() => { setSearch(initialSearch); }, [initialSearch]);
  useEffect(() => { setCategoryFilter(initialCategory); }, [initialCategory]);
  useEffect(() => { setRegionFilter(initialRegion); }, [initialRegion]);
  useEffect(() => { setDistrictFilter(initialDistrict); }, [initialDistrict]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("fse_drive_index")
        .select("*")
        .order("path");
      if (!error && data) setNodes(data as DriveNode[]);
      setLoading(false);
    })();
  }, []);

  const getRegion = (n: DriveNode) => n.region || inferRegion(n.path?.split(" / ")[0]);
  const getDistrict = (n: DriveNode) => n.district || "— Sem distrito";
  const getCategory = (n: DriveNode) => n.category || "— Sem categoria";
  const getSupplier = (n: DriveNode) => n.supplier_name || stripFileExt(n.name);

  const regions = useMemo(
    () => Array.from(new Set(nodes.map(getRegion).filter(Boolean))).sort() as string[],
    [nodes],
  );
  const districts = useMemo(() => {
    const pool = regionFilter ? nodes.filter(n => getRegion(n) === regionFilter) : nodes;
    return Array.from(new Set(pool.map(n => n.district).filter(Boolean))).sort() as string[];
  }, [nodes, regionFilter]);
  const categories = useMemo(() => {
    let pool = nodes;
    if (regionFilter) pool = pool.filter(n => getRegion(n) === regionFilter);
    if (districtFilter) pool = pool.filter(n => n.district === districtFilter);
    return Array.from(new Set(pool.map(n => n.category).filter(Boolean))).sort() as string[];
  }, [nodes, regionFilter, districtFilter]);

  // Build grouped tree: Region -> District -> Category -> Supplier -> Files
  const tree = useMemo<RegionMap>(() => {
    const tokens = normalizeText(search).split(" ").filter(Boolean);
    const matches = (n: DriveNode) => {
      if (!tokens.length) return true;
      const haystack = normalizeText(
        `${n.name} ${getSupplier(n)} ${getCategory(n)} ${getRegion(n)} ${getDistrict(n)} ${n.path || ""}`,
      );
      return tokens.every((t) => haystack.includes(t));
    };

    const files = nodes.filter(
      (n) =>
        n.mime_type !== FOLDER_MIME &&
        (!categoryFilter || n.category === categoryFilter) &&
        (!regionFilter || getRegion(n) === regionFilter) &&
        (!districtFilter || n.district === districtFilter) &&
        matches(n),
    );

    const out: RegionMap = {};
    for (const f of files) {
      const reg = getRegion(f);
      const dist = getDistrict(f);
      const cat = getCategory(f);
      const sup = getSupplier(f);
      out[reg] ??= {};
      out[reg][dist] ??= {};
      out[reg][dist][cat] ??= {};
      out[reg][dist][cat][sup] ??= [];
      out[reg][dist][cat][sup].push(f);
    }
    return out;
  }, [nodes, search, categoryFilter, regionFilter, districtFilter]);

  const toggle = (key: string) => {
    setExpanded((s) => {
      const n = new Set(s);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  };

  const totalFiles = Object.values(tree).reduce((s, d) => s + countDistricts(d), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> A carregar índice do Drive…
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="text-center py-10 text-sm text-muted-foreground">
        Sem índice. Clica em <strong>Sincronizar do Drive</strong> em cima.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Pesquisar fornecedor, ficheiro, distrito, caminho…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-xs"
          />
        </div>
        <div className="flex gap-2 items-center text-xs flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={regionFilter ?? ""}
            onChange={(e) => { setRegionFilter(e.target.value || null); setDistrictFilter(null); }}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="">Todas as regiões</option>
            {regions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select
            value={districtFilter ?? ""}
            onChange={(e) => setDistrictFilter(e.target.value || null)}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="">{regionFilter ? "Todos os distritos" : "Distrito (todos)"}</option>
            {districts.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select
            value={categoryFilter ?? ""}
            onChange={(e) => setCategoryFilter(e.target.value || null)}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="">Todas as categorias</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {(categoryFilter || regionFilter || districtFilter || search) && (
            <Button
              size="sm"
              variant="ghost"
              className="h-9 text-xs"
              onClick={() => { setCategoryFilter(null); setRegionFilter(null); setDistrictFilter(null); setSearch(""); }}
            >
              Limpar
            </Button>
          )}
        </div>
      </div>

      <div className="text-[11px] text-muted-foreground px-1">
        {totalFiles} ficheiro(s) • {Object.keys(tree).length} região(ões)
      </div>

      {/* Tree: Região > Distrito > Categoria > Fornecedor > Ficheiros */}
      <div className="border border-border rounded-lg divide-y divide-border/50 bg-card">
        {Object.entries(tree).sort(([a], [b]) => a.localeCompare(b)).map(([reg, dists]) => {
          const regKey = `reg:${reg}`;
          const regOpen = expanded.has(regKey) || !!search;
          return (
            <div key={reg}>
              <button
                onClick={() => toggle(regKey)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
              >
                {regOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                <Folder className="h-4 w-4 text-amber-500" />
                <span className="font-semibold text-xs flex-1">{reg}</span>
                <Badge variant="outline" className="text-[10px] h-5">{countDistricts(dists)}</Badge>
              </button>
              {regOpen && (
                <div className="pl-4 border-l-2 border-muted ml-4">
                  {Object.entries(dists).sort(([a], [b]) => a.localeCompare(b)).map(([dist, cats]) => {
                    const distKey = `dist:${reg}:${dist}`;
                    const distOpen = expanded.has(distKey) || !!search;
                    return (
                      <div key={dist}>
                        <button
                          onClick={() => toggle(distKey)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted/30 transition-colors text-left"
                        >
                          {distOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          <Folder className="h-3.5 w-3.5 text-amber-400" />
                          <span className="text-xs font-medium flex-1">{dist}</span>
                          <span className="text-[10px] text-muted-foreground">{countCategories(cats)}</span>
                        </button>
                        {distOpen && (
                          <div className="pl-4 border-l border-muted ml-3">
                            {Object.entries(cats).sort(([a], [b]) => a.localeCompare(b)).map(([cat, suppliers]) => {
                              const catKey = `cat:${reg}:${dist}:${cat}`;
                              const catOpen = expanded.has(catKey) || !!search;
                              return (
                                <div key={cat}>
                                  <button
                                    onClick={() => toggle(catKey)}
                                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted/30 transition-colors text-left"
                                  >
                                    {catOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                    <Folder className="h-3.5 w-3.5 text-amber-400" />
                                    <span className="text-xs flex-1">{cat}</span>
                                    <span className="text-[10px] text-muted-foreground">{countSuppliers(suppliers)}</span>
                                  </button>
                                  {catOpen && (
                                    <div className="pl-6 pb-1 space-y-1">
                                      {Object.entries(suppliers).sort(([a], [b]) => a.localeCompare(b)).map(([supplier, files]) => {
                                        const supplierKey = `sup:${reg}:${dist}:${cat}:${supplier}`;
                                        const supplierOpen = expanded.has(supplierKey) || !!search || files.length === 1;
                                        return (
                                          <div key={supplier}>
                                            <button
                                              onClick={() => toggle(supplierKey)}
                                              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted/40 text-left"
                                            >
                                              {supplierOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                              <Folder className="h-3.5 w-3.5 text-amber-500" />
                                              <span className="flex-1 truncate font-medium">{supplier}</span>
                                              <Badge variant="outline" className="h-4 px-1 text-[9px]">{files.length}</Badge>
                                            </button>
                                            {supplierOpen && (
                                              <div className="pl-5">
                                                {files.sort((a, b) => a.name.localeCompare(b.name)).map((f) => (
                                                  <button
                                                    key={f.drive_id}
                                                    onClick={() => setPreview(f)}
                                                    className={cn(
                                                      "w-full flex items-center gap-2 px-2 py-1 rounded text-xs",
                                                      "hover:bg-primary/5 hover:text-primary text-left transition-colors",
                                                    )}
                                                  >
                                                    {fileIcon(f.mime_type)}
                                                    <span className="flex-1 truncate">{f.name}</span>
                                                    <span className="text-[10px] text-primary">Ver</span>
                                                  </button>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {Object.keys(tree).length === 0 && (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            Sem resultados para os filtros atuais.
          </div>
        )}
      </div>

      <FilePreviewDialog file={preview} onClose={() => setPreview(null)} />
    </div>
  );
};

export default FSEDriveBrowser;

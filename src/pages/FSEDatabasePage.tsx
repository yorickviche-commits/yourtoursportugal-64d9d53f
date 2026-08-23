import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  FileText, FolderOpen, Plus, Info, ExternalLink, MapPin,
  ChevronDown, ChevronRight, Database, BarChart3, Globe2, Users2, RefreshCw,
  FolderTree,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_DEFS, FSE_REGION_NAMES } from "@/data/fseDatabase";
import FSECreateModal from "@/components/commercial/FSECreateModal";
import FSEDriveBrowser from "@/components/commercial/FSEDriveBrowser";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type DriveNode = {
  drive_id: string;
  name: string;
  mime_type: string;
  category: string | null;
  region: string | null;
  district: string | null;
  supplier_name: string | null;
  path: string | null;
  depth: number;
};

const FOLDER_MIME = "application/vnd.google-apps.folder";

const stripExt = (v: string) => v.replace(/\.(xlsx|pdf|docx|pptx|xls|doc)$/i, "");

/** Mirrors the Drive: REGIÃO > DISTRITO > CATEGORIA > FORNECEDOR */
interface CatNode { name: string; suppliers: { name: string; docCount: number }[] }
interface DistrictNode { name: string; categories: CatNode[] }
interface RegionNode { name: string; districts: DistrictNode[] }

const regionOrder = (name: string) => {
  const i = FSE_REGION_NAMES.indexOf(name);
  return i === -1 ? 99 : i;
};

const buildTree = (nodes: DriveNode[]): RegionNode[] => {
  const regions = new Map<string, Map<string, Map<string, Map<string, number>>>>();
  const ensure = (region: string, district?: string | null, category?: string | null, supplier?: string | null) => {
    if (!regions.has(region)) regions.set(region, new Map());
    const dists = regions.get(region)!;
    if (!district) return;
    if (!dists.has(district)) dists.set(district, new Map());
    const cats = dists.get(district)!;
    if (!category) return;
    if (!cats.has(category)) cats.set(category, new Map());
    const sups = cats.get(category)!;
    if (!supplier) return;
    sups.set(supplier, sups.get(supplier) ?? 0);
  };

  // Folder skeleton (keeps empty categories visible, like in the Drive)
  for (const n of nodes) {
    if (n.mime_type !== FOLDER_MIME || !n.region) continue;
    if (n.depth === 0) ensure(n.region);
    else if (n.depth === 1) ensure(n.region, n.district);
    else if (n.depth === 2) ensure(n.region, n.district, n.category);
    else ensure(n.region, n.district, n.category, n.supplier_name || stripExt(n.name));
  }

  // Files bump supplier counters
  for (const f of nodes) {
    if (f.mime_type === FOLDER_MIME || !f.region) continue;
    const district = f.district || "— Sem distrito";
    const category = f.category || "— Sem categoria";
    const supplier = f.supplier_name || stripExt(f.name);
    ensure(f.region, district, category, supplier);
    regions.get(f.region)!.get(district)!.get(category)!
      .set(supplier, (regions.get(f.region)!.get(district)!.get(category)!.get(supplier) ?? 0) + 1);
  }

  return Array.from(regions.entries())
    .sort(([a], [b]) => regionOrder(a) - regionOrder(b) || a.localeCompare(b))
    .map(([name, dists]) => ({
      name,
      districts: Array.from(dists.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([dName, cats]) => ({
          name: dName,
          categories: Array.from(cats.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([cName, sups]) => ({
              name: cName,
              suppliers: Array.from(sups.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([sName, docCount]) => ({ name: sName, docCount })),
            })),
        })),
    }));
};

const countFiles = (r: RegionNode) =>
  r.districts.reduce((s, d) => s + d.categories.reduce((s2, c) => s2 + c.suppliers.reduce((s3, sp) => s3 + sp.docCount, 0), 0), 0);

const SyncDriveButton = () => {
  const [loading, setLoading] = useState(false);
  const sync = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("index-drive-fses", { body: {} });
      if (error) throw error;
      toast.success(`Drive sincronizado: ${data?.total ?? 0} registos`);
    } catch (e: any) {
      toast.error(`Falha a sincronizar: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  };
  return (
    <Button size="sm" variant="outline" className="gap-1.5" onClick={sync} disabled={loading}>
      <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
      {loading ? "A sincronizar..." : "Sincronizar do Drive"}
    </Button>
  );
};

// ─── Stats Header ───
const StatsHeader = ({ tree }: { tree: RegionNode[] }) => {
  const stats = useMemo(() => {
    let totalDocs = 0, filledCats = 0, totalCats = 0, activeRegions = 0, districts = 0;
    const suppliers = new Set<string>();
    for (const r of tree) {
      let hasDocs = false;
      districts += r.districts.length;
      for (const d of r.districts) {
        for (const c of d.categories) {
          totalCats++;
          const docs = c.suppliers.reduce((s, sp) => s + sp.docCount, 0);
          totalDocs += docs;
          if (docs > 0) { filledCats++; hasDocs = true; }
          c.suppliers.forEach(sp => suppliers.add(sp.name));
        }
      }
      if (hasDocs) activeRegions++;
    }
    return { totalDocs, filledCats, totalCats, activeRegions, totalRegions: tree.length, districts, suppliers: suppliers.size };
  }, [tree]);

  const metrics = [
    { label: "Total Documentos", value: stats.totalDocs, icon: FileText },
    { label: "Categorias c/ docs", value: `${stats.filledCats}/${stats.totalCats}`, icon: FolderOpen },
    { label: "Destinos / Distritos", value: `${stats.totalRegions} / ${stats.districts}`, icon: Globe2 },
    { label: "Fornecedores", value: stats.suppliers, icon: Users2 },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {metrics.map(m => (
        <Card key={m.label} className="border-border/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <m.icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold leading-tight">{m.value}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">{m.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

const StatusDot = ({ active }: { active: boolean }) => (
  <span className={cn("inline-block h-2.5 w-2.5 rounded-full shrink-0", active ? "bg-emerald-500" : "bg-red-400")} />
);

// ─── Destination (Região) Card: Região > Distrito > Categoria > Fornecedores ───
const RegionCard = ({
  region,
  onAdd,
  onBrowse,
}: {
  region: RegionNode;
  onAdd: (dest?: string, cat?: string) => void;
  onBrowse: (search: string, title: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [openDistrict, setOpenDistrict] = useState<string | null>(null);
  const [openCat, setOpenCat] = useState<string | null>(null);

  const files = countFiles(region);

  return (
    <div className="col-span-1">
      <Card
        className={cn("cursor-pointer transition-all hover:shadow-md border-border/50", open && "ring-1 ring-primary/30 shadow-md")}
        onClick={() => { setOpen(!open); setOpenDistrict(null); setOpenCat(null); }}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">{region.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => { e.stopPropagation(); onAdd(region.name); }} title="Adicionar fornecedor">
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <span className="text-[11px] text-muted-foreground">{region.districts.length} distrito(s)</span>
              <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", files === 0 ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-700")}>
                {files}
              </span>
              {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>
        </CardContent>
      </Card>

      {open && (
        <div className="mt-1 space-y-0.5" onClick={e => e.stopPropagation()}>
          {region.districts.map(dist => {
            const distOpen = openDistrict === dist.name;
            const distFiles = dist.categories.reduce((s, c) => s + c.suppliers.reduce((s2, sp) => s2 + sp.docCount, 0), 0);
            return (
              <div key={dist.name}>
                <button
                  onClick={() => { setOpenDistrict(distOpen ? null : dist.name); setOpenCat(null); }}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-xs rounded-md transition-colors",
                    distOpen ? "bg-primary/5 text-primary" : "hover:bg-muted/50",
                  )}
                >
                  {distOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  <StatusDot active={distFiles > 0} />
                  <span className="flex-1 text-left truncate font-medium">{dist.name}</span>
                  <span className="text-muted-foreground font-mono text-[11px]">{distFiles}</span>
                </button>

                {distOpen && (
                  <div className="ml-4 pl-2 border-l-2 border-primary/10 space-y-0.5">
                    {dist.categories.length === 0 && (
                      <p className="text-[11px] text-muted-foreground italic px-3 py-1.5">Sem categorias no Drive.</p>
                    )}
                    {dist.categories.map(cat => {
                      const key = `${dist.name}:${cat.name}`;
                      const catOpen = openCat === key;
                      const catFiles = cat.suppliers.reduce((s, sp) => s + sp.docCount, 0);
                      return (
                        <div key={key}>
                          <div className="flex items-center">
                            <button
                              onClick={() => setOpenCat(catOpen ? null : key)}
                              className={cn(
                                "flex-1 flex items-center gap-2 px-3 py-1.5 text-xs rounded-md transition-colors",
                                catOpen ? "bg-primary/5 text-primary" : "hover:bg-muted/50",
                              )}
                            >
                              <StatusDot active={catFiles > 0} />
                              <span className="flex-1 text-left truncate">{cat.name}</span>
                              <span className="text-muted-foreground font-mono text-[11px]">{catFiles}</span>
                            </button>
                            <Button
                              variant="ghost" size="icon" className="h-6 w-6 shrink-0"
                              title="Ver ficheiros no Drive"
                              onClick={() => onBrowse(`${cat.name} ${dist.name}`, `${cat.name} • ${dist.name} • ${region.name}`)}
                            >
                              <FolderOpen className="h-3 w-3" />
                            </Button>
                          </div>

                          {catOpen && (
                            <div className="ml-5 pl-3 border-l-2 border-primary/10 py-1.5 flex flex-wrap gap-1.5">
                              {cat.suppliers.length === 0 && (
                                <span className="text-[11px] text-muted-foreground italic">Sem fornecedores registados.</span>
                              )}
                              {cat.suppliers.map(sp => (
                                <button
                                  key={sp.name}
                                  onClick={() => onBrowse(sp.name, sp.name)}
                                  className={cn(
                                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors",
                                    sp.docCount > 0
                                      ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 hover:bg-emerald-500/20"
                                      : "bg-red-400/10 text-red-500 border-red-400/20 hover:bg-red-400/20",
                                  )}
                                >
                                  <StatusDot active={sp.docCount > 0} />
                                  {sp.name}
                                  {sp.docCount > 0 && (
                                    <Badge variant="outline" className="h-4 px-1 text-[9px]">{sp.docCount}</Badge>
                                  )}
                                  <FolderOpen className="h-3 w-3 opacity-60" />
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
};

// ─── Interactive Map Tab ───
const InteractiveMapTab = ({
  tree, onAdd, onBrowse,
}: {
  tree: RegionNode[];
  onAdd: (dest?: string, cat?: string) => void;
  onBrowse: (search: string, title: string) => void;
}) => (
  <div className="space-y-4">
    <div className="flex gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs leading-relaxed">
      <Info className="h-4 w-4 shrink-0 mt-0.5" />
      <p>
        <strong>Estrutura do Drive:</strong> Destino → Distrito → Categoria → Fornecedor. Clica num fornecedor ou no ícone{" "}
        <FolderOpen className="h-3 w-3 inline" /> para ver os ficheiros do Drive num popup.
      </p>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {tree.map(r => <RegionCard key={r.name} region={r} onAdd={onAdd} onBrowse={onBrowse} />)}
    </div>
  </div>
);

// ─── Summary Table Tab: linha = Destino / Distrito, coluna = Categoria ───
const SummaryTableTab = ({ tree, onAdd }: { tree: RegionNode[]; onAdd: () => void }) => {
  const catNames = useMemo(() => {
    const set = new Set<string>();
    tree.forEach(r => r.districts.forEach(d => d.categories.forEach(c => set.add(c.name))));
    const order: string[] = CATEGORY_DEFS.map(c => c.label);
    return Array.from(set).sort((a, b) => {
      const ia = order.indexOf(a), ib = order.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
    });
  }, [tree]);

  const totals = catNames.map(() => 0);
  let grandTotal = 0;

  const rows: { region: string; district: string; cells: number[]; total: number }[] = [];
  tree.forEach(r => {
    r.districts.forEach(d => {
      const cells = catNames.map((cn, i) => {
        const cat = d.categories.find(c => c.name === cn);
        const count = cat?.suppliers.reduce((s, sp) => s + sp.docCount, 0) ?? 0;
        totals[i] += count;
        return count;
      });
      const total = cells.reduce((s, v) => s + v, 0);
      grandTotal += total;
      rows.push({ region: r.name, district: d.name, cells, total });
    });
  });

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="sticky left-0 bg-muted/50 z-10 text-left px-3 py-2.5 font-semibold">Destino</th>
              <th className="text-left px-3 py-2.5 font-semibold whitespace-nowrap">Distrito</th>
              {catNames.map(h => <th key={h} className="px-2 py-2.5 text-center font-semibold whitespace-nowrap">{h}</th>)}
              <th className="px-2 py-2.5 text-center font-semibold">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              const firstOfRegion = ri === 0 || rows[ri - 1].region !== row.region;
              return (
                <tr key={`${row.region}-${row.district}`} className={cn("border-b border-border/50 hover:bg-muted/30", firstOfRegion && "border-t-2 border-border")}>
                  <td className="sticky left-0 bg-card z-10 px-3 py-2 font-medium">{firstOfRegion ? row.region : ""}</td>
                  <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{row.district}</td>
                  {row.cells.map((count, i) => (
                    <td key={i} className="px-2 py-2 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <StatusDot active={count > 0} />
                        <span className={cn("text-[11px] font-mono", count === 0 ? "text-muted-foreground" : "font-medium")}>
                          {count === 0 ? "–" : count}
                        </span>
                      </div>
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center font-semibold">{row.total}</td>
                </tr>
              );
            })}
            <tr className="bg-muted/60 font-semibold border-t-2 border-border">
              <td className="sticky left-0 bg-muted/60 z-10 px-3 py-2.5" colSpan={2}>TOTAL</td>
              {totals.map((t, i) => <td key={i} className="px-2 py-2.5 text-center font-mono text-[11px]">{t}</td>)}
              <td className="px-2 py-2.5 text-center font-bold">{grandTotal}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex justify-center">
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" />
          Adicionar Fornecedor FSE
        </Button>
      </div>
    </div>
  );
};

// ─── Main Page ───
const FSEDatabasePage = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [prefillDest, setPrefillDest] = useState<string | undefined>();
  const [prefillCat, setPrefillCat] = useState<string | undefined>();
  const [driveNodes, setDriveNodes] = useState<DriveNode[]>([]);

  const [driveOpen, setDriveOpen] = useState(false);
  const [driveSearch, setDriveSearch] = useState("");
  const [driveTitle, setDriveTitle] = useState("Ficheiros do Drive");

  useEffect(() => {
    supabase
      .from("fse_drive_index")
      .select("drive_id,name,mime_type,category,region,district,supplier_name,path,depth")
      .order("path")
      .then(({ data, error }) => {
        if (!error && data) setDriveNodes(data as DriveNode[]);
      });
  }, []);

  const tree = useMemo(() => buildTree(driveNodes), [driveNodes]);

  const openModal = (dest?: string, cat?: string) => {
    setPrefillDest(dest);
    setPrefillCat(cat);
    setModalOpen(true);
  };

  const openDriveSearch = (search: string, title: string) => {
    setDriveSearch(search);
    setDriveTitle(title);
    setDriveOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">Base de Dados FSE</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">Destino → Distrito → Categoria → Fornecedor (espelho do Drive)</p>
          </div>
          <div className="flex gap-2">
            <SyncDriveButton />
            <Button size="sm" className="gap-1.5" onClick={() => openModal()}>
              <Plus className="h-4 w-4" />
              Adicionar FSE
            </Button>
          </div>
        </div>

        <StatsHeader tree={tree} />

        <Tabs defaultValue="map" className="w-full">
          <TabsList>
            <TabsTrigger value="map" className="gap-1.5 text-xs">
              <MapPin className="h-3.5 w-3.5" />
              Mapa Interativo
            </TabsTrigger>
            <TabsTrigger value="drive" className="gap-1.5 text-xs">
              <FolderTree className="h-3.5 w-3.5" />
              Drive (Ficheiros)
            </TabsTrigger>
            <TabsTrigger value="table" className="gap-1.5 text-xs">
              <BarChart3 className="h-3.5 w-3.5" />
              Tabela Resumo
            </TabsTrigger>
          </TabsList>
          <TabsContent value="map">
            <InteractiveMapTab tree={tree} onAdd={openModal} onBrowse={openDriveSearch} />
          </TabsContent>
          <TabsContent value="drive">
            <FSEDriveBrowser />
          </TabsContent>
          <TabsContent value="table">
            <SummaryTableTab tree={tree} onAdd={() => openModal()} />
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={driveOpen} onOpenChange={setDriveOpen}>
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-4 pt-4 pb-2 border-b">
            <DialogTitle className="text-sm flex items-center gap-2">
              <FolderTree className="h-4 w-4 text-primary" />
              {driveTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-3">
            <FSEDriveBrowser initialSearch={driveSearch} />
          </div>
        </DialogContent>
      </Dialog>

      <FSECreateModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        prefillDestination={prefillDest}
        prefillCategory={prefillCat}
        onSave={(data: any) => console.log("FSE saved:", data)}
      />
    </AppLayout>
  );
};

export default FSEDatabasePage;

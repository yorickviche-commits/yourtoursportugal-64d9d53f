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
import { FSE_DESTINATIONS, getFSEStats, type FSEDestination, type FSECategory, type FSEDocument } from "@/data/fseDatabase";
import FSECreateModal from "@/components/commercial/FSECreateModal";
import FSEDriveBrowser from "@/components/commercial/FSEDriveBrowser";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type DriveNode = {
  drive_id: string;
  parent_drive_id: string | null;
  name: string;
  mime_type: string;
  category: string | null;
  region: string | null;
  supplier_name: string | null;
  path: string | null;
  web_view_link: string | null;
  depth: number;
};

const FOLDER_MIME = "application/vnd.google-apps.folder";

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
const StatsHeader = () => {
  const stats = getFSEStats();
  const metrics = [
    { label: "Total Documentos", value: stats.totalDocs, icon: FileText },
    { label: "Categorias Preenchidas", value: `${stats.filledCats}/${stats.totalCats}`, icon: FolderOpen },
    { label: "Destinos Ativos", value: `${stats.activeDestinations}/${stats.totalDestinations}`, icon: Globe2 },
    { label: "Parceiros Multi-Destino", value: stats.multiPartnerCount, icon: Users2 },
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

// ─── Status Dot ───
const StatusDot = ({ status }: { status: "active" | "empty" | "multi-destination" }) => {
  const colors: Record<string, string> = {
    active: "bg-emerald-500",
    empty: "bg-red-400",
    "multi-destination": "bg-amber-500",
  };
  return <span className={cn("inline-block h-2.5 w-2.5 rounded-full shrink-0", colors[status] || "bg-muted")} />;
};

// ─── Document Chip ───
const DocChip = ({ doc, onBrowse }: { doc: FSEDocument; onBrowse?: (search: string) => void }) => {
  const base = doc.status === "active"
    ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 hover:bg-emerald-500/20"
    : doc.status === "multi-destination"
    ? "bg-amber-500/10 text-amber-700 border-amber-500/20 hover:bg-amber-500/20"
    : "bg-red-400/10 text-red-500 border-red-400/20 hover:bg-red-400/20";

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onBrowse?.(doc.name); }}
      className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer", base)}
      title="Ver ficheiros no Drive"
    >
      <StatusDot status={doc.status} />
      {doc.name}
      {doc.status === "multi-destination" && (
        <Badge variant="outline" className="h-4 px-1 text-[9px] font-bold border-amber-500/30 text-amber-600">M</Badge>
      )}
      <FolderOpen className="h-3 w-3 opacity-60" />
      {doc.googleDriveUrl && (
        <a href={doc.googleDriveUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="hover:text-primary">
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </button>
  );
};

// ─── Destination Card ───
const DestinationCard = ({
  dest,
  onAdd,
  onBrowseCategory,
  onBrowseDoc,
}: {
  dest: FSEDestination;
  onAdd: (dest?: string, cat?: string) => void;
  onBrowseCategory: (destName: string, catLabel: string) => void;
  onBrowseDoc: (search: string) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  const filledCount = dest.categories.filter(c => c.documents.length > 0).length;
  const totalCats = dest.categories.length;
  const hasMulti = dest.categories.some(c => c.documents.some(d => d.status === "multi-destination"));

  return (
    <div className="col-span-1">
      <Card
        className={cn(
          "cursor-pointer transition-all hover:shadow-md border-border/50",
          expanded && "ring-1 ring-primary/30 shadow-md"
        )}
        onClick={() => { setExpanded(!expanded); setSelectedCat(null); }}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">{dest.name}</span>
              {hasMulti && <Badge variant="outline" className="h-4 px-1 text-[9px] font-bold border-amber-500/30 text-amber-600">M</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={e => { e.stopPropagation(); onAdd(dest.name); }} title="Adicionar fornecedor">
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <span className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full",
                filledCount === 0 ? "bg-red-100 text-red-600" : filledCount === totalCats ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
              )}>
                {filledCount}/{totalCats}
              </span>
              {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>
        </CardContent>
      </Card>

      {expanded && (
        <div className="mt-1 space-y-0.5" onClick={e => e.stopPropagation()}>
          {dest.categories.map(cat => {
            const docCount = cat.documents.length;
            const catHasMulti = cat.documents.some(d => d.status === "multi-destination");
            const isSelected = selectedCat === cat.id;

            return (
              <div key={cat.id}>
                <div className="flex items-center">
                  <button
                    onClick={() => setSelectedCat(isSelected ? null : cat.id)}
                    className={cn(
                      "flex-1 flex items-center gap-2 px-3 py-2 text-xs rounded-md transition-colors",
                      isSelected ? "bg-primary/5 text-primary" : "hover:bg-muted/50 text-foreground"
                    )}
                  >
                    <StatusDot status={docCount > 0 ? (catHasMulti ? "multi-destination" : "active") : "empty"} />
                    <span className="flex-1 text-left truncate">{cat.label}</span>
                    {catHasMulti && <Badge variant="outline" className="h-4 px-1 text-[9px] font-bold border-amber-500/30 text-amber-600">M</Badge>}
                    <span className="text-muted-foreground font-mono text-[11px]">{docCount}</span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    title="Ver ficheiros no Drive"
                    onClick={() => onBrowseCategory(dest.name, cat.label)}
                  >
                    <FolderOpen className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => onAdd(dest.name, cat.id)} title="Adicionar">
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>

                {isSelected && docCount > 0 && (
                  <div className="ml-5 pl-3 border-l-2 border-primary/10 py-2 flex flex-wrap gap-1.5">
                    {cat.documents.map((doc, i) => <DocChip key={i} doc={doc} onBrowse={onBrowseDoc} />)}
                    {catHasMulti && (
                      <p className="w-full text-[10px] text-amber-600 mt-1 italic flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" />
                        Arquivado neste destino conforme ponto de saída
                      </p>
                    )}
                  </div>
                )}
                {isSelected && docCount === 0 && (
                  <div className="ml-5 pl-3 border-l-2 border-red-200 py-2 flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground italic">Sem documentos registados.</span>
                    <button
                      onClick={() => onBrowseCategory(dest.name, cat.label)}
                      className="text-[11px] text-primary hover:underline"
                    >
                      Procurar no Drive →
                    </button>
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
  destinations,
  onAdd,
  onBrowseCategory,
  onBrowseDoc,
}: {
  destinations: FSEDestination[];
  onAdd: (dest?: string, cat?: string) => void;
  onBrowseCategory: (destName: string, catLabel: string) => void;
  onBrowseDoc: (search: string) => void;
}) => (
  <div className="space-y-4">
    <div className="flex gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs leading-relaxed">
      <Info className="h-4 w-4 shrink-0 mt-0.5" />
      <p>
        <strong>Dica:</strong> clica num FSE ou no ícone <FolderOpen className="h-3 w-3 inline" /> para ver os ficheiros do Drive (PDFs, contratos, fichas técnicas) num popup, sem sair da página.
      </p>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {destinations.map(dest => (
        <DestinationCard
          key={dest.name}
          dest={dest}
          onAdd={onAdd}
          onBrowseCategory={onBrowseCategory}
          onBrowseDoc={onBrowseDoc}
        />
      ))}
    </div>
  </div>
);

// ─── Summary Table Tab ───
const CAT_ORDER = ["aloj", "anim", "guias", "quintas", "rest", "mar", "terr", "mon"] as const;
const CAT_HEADERS = ["Alojamento", "Anim. Turística", "Guias Externos", "Quintas & Caves", "Restauração", "Transp. Marítimos", "Transp. Terrestres", "Monumentos"];

const SummaryTableTab = ({ destinations, onAdd }: { destinations: FSEDestination[]; onAdd: () => void }) => {
  const totals = CAT_ORDER.map(() => ({ count: 0, multi: false }));
  let grandTotal = 0;
  let grandFilledCats = 0;

  const rows = destinations.map(dest => {
    let rowTotal = 0;
    let rowFilledCats = 0;
    const cells = CAT_ORDER.map((catId, ci) => {
      const cat = dest.categories.find(c => c.id === catId);
      const count = cat?.documents.length ?? 0;
      const hasMulti = cat?.documents.some(d => d.status === "multi-destination") ?? false;
      rowTotal += count;
      if (count > 0) rowFilledCats++;
      totals[ci].count += count;
      if (hasMulti) totals[ci].multi = true;
      return { count, hasMulti };
    });
    grandTotal += rowTotal;
    grandFilledCats += rowFilledCats;
    return { name: dest.name, cells, rowTotal, rowFilledCats };
  });

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="sticky left-0 bg-muted/50 z-10 text-left px-3 py-2.5 font-semibold text-foreground">Destino</th>
              {CAT_HEADERS.map(h => <th key={h} className="px-2 py-2.5 text-center font-semibold text-foreground whitespace-nowrap">{h}</th>)}
              <th className="px-2 py-2.5 text-center font-semibold text-foreground">Total</th>
              <th className="px-2 py-2.5 text-center font-semibold text-foreground whitespace-nowrap">Cats c/ docs</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.name} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="sticky left-0 bg-card z-10 px-3 py-2 font-medium text-foreground">{row.name}</td>
                {row.cells.map((cell, i) => (
                  <td key={i} className="px-2 py-2 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <StatusDot status={cell.count > 0 ? (cell.hasMulti ? "multi-destination" : "active") : "empty"} />
                      <span className={cn("text-[11px] font-mono", cell.count === 0 ? "text-muted-foreground" : "font-medium")}>
                        {cell.count === 0 ? "–" : cell.count}
                      </span>
                      {cell.hasMulti && <Badge variant="outline" className="h-3.5 px-1 text-[8px] font-bold border-amber-500/30 text-amber-600">M</Badge>}
                    </div>
                  </td>
                ))}
                <td className="px-2 py-2 text-center font-semibold">{row.rowTotal}</td>
                <td className="px-2 py-2 text-center text-muted-foreground">{row.rowFilledCats}/8</td>
              </tr>
            ))}
            <tr className="bg-muted/60 font-semibold border-t-2 border-border">
              <td className="sticky left-0 bg-muted/60 z-10 px-3 py-2.5">TOTAL</td>
              {totals.map((t, i) => (
                <td key={i} className="px-2 py-2.5 text-center">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="font-mono text-[11px]">{t.count}</span>
                    {t.multi && <Badge variant="outline" className="h-3.5 px-1 text-[8px] font-bold border-amber-500/30 text-amber-600">M</Badge>}
                  </div>
                </td>
              ))}
              <td className="px-2 py-2.5 text-center font-bold">{grandTotal}</td>
              <td className="px-2 py-2.5 text-center">{grandFilledCats}/72</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Add button in table view */}
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

  // Drive popup state
  const [driveOpen, setDriveOpen] = useState(false);
  const [driveSearch, setDriveSearch] = useState("");
  const [driveTitle, setDriveTitle] = useState("Ficheiros do Drive");

  useEffect(() => {
    supabase
      .from("fse_drive_index")
      .select("drive_id,parent_drive_id,name,mime_type,category,region,supplier_name,path,web_view_link,depth")
      .order("path")
      .then(({ data, error }) => {
        if (!error && data) setDriveNodes(data as DriveNode[]);
      });
  }, []);

  const liveDestinations = useMemo<FSEDestination[]>(() => {
    if (!driveNodes.length) return FSE_DESTINATIONS;
    const categoryLabels = FSE_DESTINATIONS[0]?.categories ?? [];
    const byId = new Map(driveNodes.map((n) => [n.drive_id, n]));
    const grouped = new Map<string, Map<string, Map<string, number>>>();
    for (const file of driveNodes.filter((n) => n.mime_type !== FOLDER_MIME)) {
      const destination = file.region || "Sem região";
      const category = file.category || "Sem categoria";
      const parent = file.parent_drive_id ? byId.get(file.parent_drive_id) : null;
      const supplier = parent?.mime_type === FOLDER_MIME && parent.depth >= 2
        ? parent.name
        : file.supplier_name || file.name.replace(/\.(xlsx|pdf|docx|pptx|xls|doc)$/i, "");
      grouped.set(destination, grouped.get(destination) ?? new Map());
      const cats = grouped.get(destination)!;
      cats.set(category, cats.get(category) ?? new Map());
      const suppliers = cats.get(category)!;
      suppliers.set(supplier, (suppliers.get(supplier) ?? 0) + 1);
    }
    return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([name, cats]) => ({
      name,
      categories: categoryLabels.map((def) => {
        const suppliers = cats.get(def.label) ?? new Map();
        return {
          ...def,
          documents: Array.from(suppliers.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([supplier, count]) => ({
            name: supplier,
            status: "active" as const,
            docCount: count,
          })),
        };
      }),
    }));
  }, [driveNodes]);

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

  const handleBrowseCategory = (destName: string, catLabel: string) => {
    const cleanCat = catLabel.replace(/^\d+\s*-\s*/, "").trim();
    openDriveSearch(`${cleanCat} ${destName}`, `${cleanCat} • ${destName}`);
  };

  const handleBrowseDoc = (supplierName: string) => {
    openDriveSearch(supplierName, supplierName);
  };

  const handleSave = (data: any) => {
    console.log('FSE saved:', data);
  };

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">Base de Dados FSE</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">Parceiros & Protocolos de Fornecedores</p>
          </div>
          <div className="flex gap-2">
            <SyncDriveButton />
            <Button size="sm" className="gap-1.5" onClick={() => openModal()}>
              <Plus className="h-4 w-4" />
              Adicionar FSE
            </Button>
          </div>
        </div>

        <StatsHeader />

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
            <InteractiveMapTab
              onAdd={openModal}
              onBrowseCategory={handleBrowseCategory}
              onBrowseDoc={handleBrowseDoc}
            />
          </TabsContent>
          <TabsContent value="drive">
            <FSEDriveBrowser />
          </TabsContent>
          <TabsContent value="table">
            <SummaryTableTab onAdd={() => openModal()} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Drive Popup — opens when clicking on FSE chip or category icon */}
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

      {/* Unified Create Modal */}
      <FSECreateModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        prefillDestination={prefillDest}
        prefillCategory={prefillCat}
        onSave={handleSave}
      />
    </AppLayout>
  );
};

export default FSEDatabasePage;

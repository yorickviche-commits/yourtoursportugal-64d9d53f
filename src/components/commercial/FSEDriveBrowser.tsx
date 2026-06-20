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
  supplier_name: string | null;
  path: string;
  web_view_link: string | null;
  depth: number;
}

const FOLDER_MIME = "application/vnd.google-apps.folder";

const normalizeText = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, " ").trim().toLowerCase();

const stripFileExt = (value: string) => value.replace(/\.(xlsx|pdf|docx|pptx|xls|doc)$/i, "");

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
  initialSearch?: string;
  compact?: boolean;
}

export const FSEDriveBrowser = ({
  initialCategory = null,
  initialRegion = null,
  initialSearch = "",
  compact = false,
}: FSEDriveBrowserProps = {}) => {
  const [nodes, setNodes] = useState<DriveNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialSearch);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(initialCategory);
  const [regionFilter, setRegionFilter] = useState<string | null>(initialRegion);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<DriveNode | null>(null);

  useEffect(() => { setSearch(initialSearch); }, [initialSearch]);
  useEffect(() => { setCategoryFilter(initialCategory); }, [initialCategory]);
  useEffect(() => { setRegionFilter(initialRegion); }, [initialRegion]);

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

  const categories = useMemo(
    () => Array.from(new Set(nodes.map((n) => n.category).filter(Boolean))).sort() as string[],
    [nodes]
  );
  const regions = useMemo(() => {
    const filtered = categoryFilter ? nodes.filter((n) => n.category === categoryFilter) : nodes;
    return Array.from(new Set(filtered.map((n) => n.region).filter(Boolean))).sort() as string[];
  }, [nodes, categoryFilter]);

  // Build grouped tree: Category -> Region -> Supplier -> Files
  const tree = useMemo(() => {
    const tokens = normalizeText(search).split(" ").filter(Boolean);
    const byId = new Map(nodes.map((n) => [n.drive_id, n]));
    const getSupplier = (n: DriveNode) => {
      const parent = n.parent_drive_id ? byId.get(n.parent_drive_id) : null;
      if (parent?.mime_type === FOLDER_MIME && parent.depth >= 2) return parent.name;
      return n.supplier_name || stripFileExt(n.name);
    };
    const matches = (n: DriveNode) => {
      if (!tokens.length) return true;
      const haystack = normalizeText(`${n.name} ${getSupplier(n)} ${n.category || ""} ${n.region || ""} ${n.path || ""}`);
      return tokens.every((t) => haystack.includes(t));
    };

    const files = nodes.filter(
      (n) =>
        n.mime_type !== FOLDER_MIME &&
        (!categoryFilter || n.category === categoryFilter) &&
        (!regionFilter || n.region === regionFilter) &&
        matches(n)
    );

    const byCat: Record<string, Record<string, Record<string, DriveNode[]>>> = {};
    for (const f of files) {
      const cat = f.category || "— Sem categoria";
      const reg = f.region || "— Sem região";
      const supplier = getSupplier(f);
      byCat[cat] ??= {};
      byCat[cat][reg] ??= {};
      byCat[cat][reg][supplier] ??= [];
      byCat[cat][reg][supplier].push(f);
    }
    return byCat;
  }, [nodes, search, categoryFilter, regionFilter]);

  const toggle = (key: string) => {
    setExpanded((s) => {
      const n = new Set(s);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  };

  const totalFiles = Object.values(tree).reduce(
    (s, regs) => s + Object.values(regs).reduce((ss, suppliers) => ss + Object.values(suppliers).reduce((sss, fs) => sss + fs.length, 0), 0),
    0
  );

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
            placeholder="Pesquisar fornecedor, ficheiro, caminho…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-xs"
          />
        </div>
        <div className="flex gap-2 items-center text-xs">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={categoryFilter ?? ""}
            onChange={(e) => { setCategoryFilter(e.target.value || null); setRegionFilter(null); }}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="">Todas as categorias</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={regionFilter ?? ""}
            onChange={(e) => setRegionFilter(e.target.value || null)}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="">Todas as regiões</option>
            {regions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          {(categoryFilter || regionFilter || search) && (
            <Button
              size="sm"
              variant="ghost"
              className="h-9 text-xs"
              onClick={() => { setCategoryFilter(null); setRegionFilter(null); setSearch(""); }}
            >
              Limpar
            </Button>
          )}
        </div>
      </div>

      <div className="text-[11px] text-muted-foreground px-1">
        {totalFiles} ficheiro(s) • {Object.keys(tree).length} categoria(s)
      </div>

      {/* Tree */}
      <div className="border border-border rounded-lg divide-y divide-border/50 bg-card">
        {Object.entries(tree).sort(([a],[b])=>a.localeCompare(b)).map(([cat, regs]) => {
          const catKey = `cat:${cat}`;
          const catOpen = expanded.has(catKey) || !!search;
          const catCount = Object.values(regs).reduce((s, suppliers) => s + Object.values(suppliers).reduce((ss, f) => ss + f.length, 0), 0);
          return (
            <div key={cat}>
              <button
                onClick={() => toggle(catKey)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors text-left"
              >
                {catOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                <Folder className="h-4 w-4 text-amber-500" />
                <span className="font-semibold text-xs flex-1">{cat}</span>
                <Badge variant="outline" className="text-[10px] h-5">{catCount}</Badge>
              </button>
              {catOpen && (
                <div className="pl-4 border-l-2 border-muted ml-4">
                  {Object.entries(regs).sort(([a],[b])=>a.localeCompare(b)).map(([reg, suppliers]) => {
                    const regKey = `reg:${cat}:${reg}`;
                    const regOpen = expanded.has(regKey) || !!search;
                    const regCount = Object.values(suppliers).reduce((s, f) => s + f.length, 0);
                    return (
                      <div key={reg}>
                        <button
                          onClick={() => toggle(regKey)}
                          className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted/30 transition-colors text-left"
                        >
                          {regOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          <Folder className="h-3.5 w-3.5 text-amber-400" />
                          <span className="text-xs flex-1">{reg}</span>
                          <span className="text-[10px] text-muted-foreground">{regCount}</span>
                        </button>
                        {regOpen && (
                          <div className="pl-6 pb-1 space-y-1">
                            {Object.entries(suppliers).sort(([a],[b])=>a.localeCompare(b)).map(([supplier, files]) => {
                              const supplierKey = `supplier:${cat}:${reg}:${supplier}`;
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
                                      {files.sort((a,b)=>a.name.localeCompare(b.name)).map((f) => (
                                        <button
                                          key={f.drive_id}
                                          onClick={() => setPreview(f)}
                                          className={cn(
                                            "w-full flex items-center gap-2 px-2 py-1 rounded text-xs",
                                            "hover:bg-primary/5 hover:text-primary text-left transition-colors"
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

import { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  FileText, FolderOpen, Plus, Info, ExternalLink, MapPin,
  ChevronDown, ChevronRight, Database, BarChart3, Globe2, Users2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FSE_DESTINATIONS, getFSEStats, type FSEDestination, type FSECategory, type FSEDocument } from "@/data/fseDatabase";

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
const DocChip = ({ doc }: { doc: FSEDocument }) => {
  const base = doc.status === "active"
    ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
    : doc.status === "multi-destination"
    ? "bg-amber-500/10 text-amber-700 border-amber-500/20"
    : "bg-red-400/10 text-red-500 border-red-400/20";

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border", base)}>
      <StatusDot status={doc.status} />
      {doc.name}
      {doc.status === "multi-destination" && (
        <Badge variant="outline" className="h-4 px-1 text-[9px] font-bold border-amber-500/30 text-amber-600">M</Badge>
      )}
      {doc.googleDriveUrl && (
        <a href={doc.googleDriveUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="hover:text-primary">
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </span>
  );
};

// ─── Destination Card (Interactive Map Tab) ───
const DestinationCard = ({ dest }: { dest: FSEDestination }) => {
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
                <button
                  onClick={() => setSelectedCat(isSelected ? null : cat.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-xs rounded-md transition-colors",
                    isSelected ? "bg-primary/5 text-primary" : "hover:bg-muted/50 text-foreground"
                  )}
                >
                  <StatusDot status={docCount > 0 ? (catHasMulti ? "multi-destination" : "active") : "empty"} />
                  <span className="flex-1 text-left truncate">{cat.label}</span>
                  {catHasMulti && <Badge variant="outline" className="h-4 px-1 text-[9px] font-bold border-amber-500/30 text-amber-600">M</Badge>}
                  <span className="text-muted-foreground font-mono text-[11px]">{docCount}</span>
                </button>

                {isSelected && docCount > 0 && (
                  <div className="ml-5 pl-3 border-l-2 border-primary/10 py-2 flex flex-wrap gap-1.5">
                    {cat.documents.map((doc, i) => <DocChip key={i} doc={doc} />)}
                    {catHasMulti && (
                      <p className="w-full text-[10px] text-amber-600 mt-1 italic flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" />
                        Arquivado neste destino conforme ponto de saída
                      </p>
                    )}
                  </div>
                )}
                {isSelected && docCount === 0 && (
                  <div className="ml-5 pl-3 border-l-2 border-red-200 py-2">
                    <span className="text-[11px] text-muted-foreground italic">Sem documentos registados</span>
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
const InteractiveMapTab = () => (
  <div className="space-y-4">
    {/* Info banner */}
    <div className="flex gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-xs leading-relaxed">
      <Info className="h-4 w-4 shrink-0 mt-0.5" />
      <p>
        <strong>Regra de arquivo:</strong> parceiros com saídas de múltiplos destinos (ex: Living Tours, 2Feel) têm ficheiros separados por ponto de saída. O serviço com saída Porto arquiva-se em Porto; o serviço com saída Lisboa arquiva-se em Lisboa.
      </p>
    </div>

    {/* Destination Grid */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {FSE_DESTINATIONS.map(dest => (
        <DestinationCard key={dest.name} dest={dest} />
      ))}
    </div>
  </div>
);

// ─── Summary Table Tab ───
const CAT_ORDER = ["aloj", "anim", "guias", "quintas", "rest", "mar", "terr", "mon"] as const;
const CAT_HEADERS = ["Alojamento", "Anim. Turística", "Guias Externos", "Quintas & Caves", "Restauração", "Transp. Marítimos", "Transp. Terrestres", "Monumentos"];

const SummaryTableTab = () => {
  const totals = CAT_ORDER.map(() => ({ count: 0, multi: false }));
  let grandTotal = 0;
  let grandFilledCats = 0;

  const rows = FSE_DESTINATIONS.map(dest => {
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
          {/* Totals */}
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
  );
};

// ─── Main Page ───
const FSEDatabasePage = () => (
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
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Adicionar FSE
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Novo FSE</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground py-4">
              Formulário de onboarding de novo fornecedor — em desenvolvimento. Futuramente criará pasta no Drive via Make.com.
            </p>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <StatsHeader />

      {/* Tabs */}
      <Tabs defaultValue="map" className="w-full">
        <TabsList>
          <TabsTrigger value="map" className="gap-1.5 text-xs">
            <MapPin className="h-3.5 w-3.5" />
            Mapa Interativo
          </TabsTrigger>
          <TabsTrigger value="table" className="gap-1.5 text-xs">
            <BarChart3 className="h-3.5 w-3.5" />
            Tabela Resumo
          </TabsTrigger>
        </TabsList>
        <TabsContent value="map">
          <InteractiveMapTab />
        </TabsContent>
        <TabsContent value="table">
          <SummaryTableTab />
        </TabsContent>
      </Tabs>
    </div>
  </AppLayout>
);

export default FSEDatabasePage;

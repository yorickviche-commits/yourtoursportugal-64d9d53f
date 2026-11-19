import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import {
  Plus,
  MoreVertical,
  Eye,
  GripVertical,
  RefreshCw,
  Save,
  Trash2,
  ArrowDownUp,
  MessageCircle,
  CheckSquare,
  Filter,
} from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import NewLeadDialog from "@/components/NewLeadDialog";
import CrmLeadPreview from "@/components/crm/CrmLeadPreview";
import YtRefBadge from "@/components/crm/YtRefBadge";
import StageBadge from "@/components/crm/StageBadge";
import { getStageColor, stageLabel } from "@/components/crm/stageAppearance";
import { useCrmPipeline, type CrmLead } from "@/hooks/useCrmPipeline";
import { usePushLead } from "@/hooks/useNetHunt";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  CRM_LIMITS,
  EMPTY_CRM_FILTERS,
  ageDays,
  pipelineStages,
  matchesCrmFilters,
  type CrmFilters,
  type CrmSort,
  type Pipeline,
} from "@/lib/crmPipeline";
import { displayLeadCode } from "@/lib/leadCode";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";
const money = (v: number) =>
  v.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
const date = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("pt-PT") : "—";
const SORTS = {
  trip_start: "Início da viagem",
  created_at: "Data de criação",
  days: "Dias na etapa",
  last_email: "Último email enviado",
};
const VIEWS: { name: string; pipeline: Pipeline }[] = [
  { name: "YT Sales Pipeline", pipeline: "sales" },
  { name: "YT Operations Pipeline", pipeline: "operations" },
  { name: "Todas", pipeline: "all" },
];
export default function CRMPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const query = useCrmPipeline();
  const leads = query.data ?? [];
  const push = usePushLead();
  const [pipeline, setPipeline] = useState<Pipeline>("sales");
  const [filters, setFilters] = useState<CrmFilters>(EMPTY_CRM_FILTERS);
  const [sort, setSort] = useState<CrmSort>({
    key: "trip_start",
    direction: "asc",
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<CrmLead | null>(null);
  const [creation, setCreation] = useState<string | null>(null);
  const [pending, setPending] = useState<{ id: string; stage: string } | null>(
    null,
  );
  const [optimistic, setOptimistic] = useState<Record<string, string>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [columnSort, setColumnSort] = useState<Record<string, CrmSort>>({});
  const [mobileStage, setMobileStage] = useState("");
  const [touch, setTouch] = useState<number | null>(null);
  const views = useQuery({
    queryKey: ["crm-saved-views", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_saved_views")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const stages = pipelineStages(pipeline);
  const currentStage = stages.includes(mobileStage) ? mobileStage : stages[0];
  const filtered = useMemo(
    () =>
      leads
        .map((l) => ({ ...l, stage: optimistic[l.id] ?? l.stage }))
        .filter((l) => matchesCrmFilters(l, filters)),
    [leads, filters, optimistic],
  );
  function ordered(rows: CrmLead[], rule: CrmSort) {
    return [...rows].sort((a, b) => {
      const av =
        rule.key === "days"
          ? ageDays(a.stage_changed_at)
          : rule.key === "last_email"
            ? a.last_email
            : a[rule.key];
      const bv =
        rule.key === "days"
          ? ageDays(b.stage_changed_at)
          : rule.key === "last_email"
            ? b.last_email
            : b[rule.key];
      if (av == null) return bv == null ? a.id.localeCompare(b.id) : 1;
      if (bv == null) return -1;
      const value =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv));
      return (
        (rule.direction === "asc" ? value : -value) || a.id.localeCompare(b.id)
      );
    });
  }
  async function move(id: string, stage: string) {
    setPending(null);
    setOptimistic((o) => ({ ...o, [id]: stage }));
    try {
      await push.mutateAsync({ id, changes: { nethunt_stage: stage } });
      toast({ title: "Etapa atualizada" });
    } catch (e) {
      toast({
        title: "Não foi possível mover a lead",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setOptimistic((o) => {
        const next = { ...o };
        delete next[id];
        return next;
      });
      void query.refetch();
    }
  }
  function requestMove(id: string, stage: string) {
    if (leads.find((l) => l.id === id)?.stage === stage) return;
    if (stage.startsWith("OPERATIONS")) setPending({ id, stage });
    else void move(id, stage);
  }
  function drop(result: DropResult) {
    if (
      result.destination &&
      result.destination.droppableId !== result.source.droppableId
    )
      requestMove(result.draggableId, result.destination.droppableId);
  }
  function chooseView(v: Tables<"crm_saved_views">) {
    setPipeline(v.pipeline as Pipeline);
    setFilters({ ...EMPTY_CRM_FILTERS, ...(v.filters as Partial<CrmFilters>) });
    setSort({ ...sort, ...(v.sort as Partial<CrmSort>) });
  }
  async function saveView() {
    if (!user || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("crm_saved_views")
      .insert({ user_id: user.id, name: name.trim(), pipeline, filters, sort });
    setSaving(false);
    if (error) {
      toast({
        title: "Erro ao guardar vista",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setSaveOpen(false);
    setName("");
    void qc.invalidateQueries({ queryKey: ["crm-saved-views"] });
  }
  const owners = [
    ...new Map(
      leads.map((l) => [l.owner_id || l.sales_owner || "", l.owner_name]),
    ).entries(),
  ].filter(([id]) => id);
  function renderColumn(stage: string) {
    const rows = ordered(
      filtered.filter((l) => l.stage === stage),
      columnSort[stage] ?? sort,
    );
    const sum = rows.reduce((s, l) => s + (l.pvp ?? 0), 0);
    const hasValue = rows.some((l) => l.pvp !== null);
    return (
      <section
        key={stage}
        className={cn(
          "flex flex-col shrink-0 w-full md:w-[300px] h-[calc(100dvh-330px)] min-h-[360px] md:h-[calc(100dvh-225px)]",
          collapsed[stage] && "md:w-[64px]",
        )}
        aria-label={stageLabel(stage)}
      >
        <div
          className={cn(
            "border rounded-t-md px-2 py-2 flex items-center gap-1 min-h-14",
            getStageColor(stage),
          )}
        >
          <h2 className="text-xs font-semibold flex-1 min-w-0" title={stage}>
            {collapsed[stage] ? "…" : stageLabel(stage)} ({rows.length})
          </h2>
          {!collapsed[stage] && (
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-8"
              aria-label={`Criar lead em ${stageLabel(stage)}`}
              onClick={() => setCreation(stage)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-8"
                aria-label={`Opções ${stageLabel(stage)}`}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem
                onClick={() =>
                  setCollapsed((c) => ({ ...c, [stage]: !c[stage] }))
                }
              >
                {collapsed[stage] ? "Expandir" : "Colapsar"} coluna
              </DropdownMenuItem>
              {Object.entries(SORTS).map(([key, label]) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() =>
                    setColumnSort((s) => ({
                      ...s,
                      [stage]: { key: key as CrmSort["key"], direction: "asc" },
                    }))
                  }
                >
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {!collapsed[stage] && (
          <>
            <div className="text-xs border-x border-b px-3 py-2 flex justify-between bg-card">
              <span>Soma</span>
              <strong>{hasValue ? money(sum) : "—"}</strong>
            </div>
            <Droppable droppableId={stage}>
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="flex-1 min-h-0 overflow-y-auto space-y-2 p-2 border border-t-0 rounded-b-md bg-muted/10"
                >
                  {rows
                    .slice(0, limits[stage] ?? CRM_LIMITS.cardsPerPage)
                    .map((lead, index) => {
                      const title =
                        lead.client_name.replace(/^YT[\d -]+\s*-\s*/i, "") +
                        (lead.program ? ` - ${lead.program}` : "");
                      const days = ageDays(lead.stage_changed_at);
                      const emailAge = ageDays(lead.last_email);
                      return (
                        <Draggable
                          key={lead.id}
                          draggableId={lead.id}
                          index={index}
                          isDragDisabled={push.isPending}
                        >
                          {(drag) => (
                            <article
                              ref={drag.innerRef}
                              {...drag.draggableProps}
                              className="border rounded-md bg-card p-3 shadow-sm space-y-2"
                            >
                              <div className="flex items-start gap-1">
                                <span
                                  {...drag.dragHandleProps}
                                  aria-label="Mover lead"
                                  className="cursor-grab py-1"
                                >
                                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                                </span>
                                <Button
                                  variant="ghost"
                                  className="p-0 h-auto min-h-11 flex-1 min-w-0 justify-start flex-wrap gap-1 text-left"
                                  title={`${displayLeadCode(lead)} - ${title}`}
                                  onClick={() => navigate(`/leads/${lead.id}`)}
                                >
                                  <YtRefBadge value={displayLeadCode(lead)} />
                                  <span className="truncate text-xs w-full font-semibold">
                                    {title}
                                  </span>
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-11 w-8"
                                  aria-label={`Pré-visualizar ${displayLeadCode(lead)}`}
                                  onClick={() => setPreview(lead)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                              <StageBadge stage={lead.stage} />
                              <dl className="text-xs space-y-1">
                                <div className="flex justify-between gap-2 font-semibold">
                                  <dt>Início da viagem</dt>
                                  <dd>{date(lead.trip_start)}</dd>
                                </div>
                                <div className="flex justify-between gap-2">
                                  <dt>Fim da viagem</dt>
                                  <dd>{date(lead.trip_finish)}</dd>
                                </div>
                                <div
                                  className={cn(
                                    "flex justify-between gap-2",
                                    emailAge !== null &&
                                      emailAge > CRM_LIMITS.emailWarningDays &&
                                      "text-destructive",
                                  )}
                                >
                                  <dt>Último email enviado</dt>
                                  <dd>{date(lead.last_email)}</dd>
                                </div>
                                <div
                                  className={cn(
                                    "flex justify-between",
                                    days !== null &&
                                      days > CRM_LIMITS.stageWarningDays &&
                                      "text-[hsl(var(--stage-budget))] font-semibold",
                                  )}
                                >
                                  <dt>Dias na etapa</dt>
                                  <dd>{days ?? "—"}</dd>
                                </div>
                              </dl>
                              <div className="flex items-center gap-2 text-[10px] border-t pt-2">
                                <span>{lead.client_type || "—"}</span>
                                {lead.overdue > 0 && (
                                  <span
                                    className="text-destructive flex items-center gap-1"
                                    title="Tarefas em atraso"
                                  >
                                    <CheckSquare className="h-3 w-3" />
                                    {lead.overdue}
                                  </span>
                                )}
                                <span
                                  aria-label="WhatsApp ainda não ligado"
                                  className="text-muted-foreground opacity-40"
                                >
                                  <MessageCircle className="h-3 w-3" />
                                </span>
                                <span className="flex-1" />
                                {lead.pvp !== null && (
                                  <span>{money(lead.pvp)}</span>
                                )}
                                <Avatar
                                  className="h-6 w-6"
                                  title={lead.owner_name || "Sem responsável"}
                                >
                                  {lead.avatar && (
                                    <AvatarImage src={lead.avatar} />
                                  )}
                                  <AvatarFallback className="text-[9px]">
                                    {lead.owner_name
                                      .split(" ")
                                      .map((n) => n[0])
                                      .slice(0, 2)
                                      .join("") || "—"}
                                  </AvatarFallback>
                                </Avatar>
                              </div>
                              <Select
                                value={lead.stage}
                                onValueChange={(value) =>
                                  requestMove(lead.id, value)
                                }
                                disabled={push.isPending}
                              >
                                <SelectTrigger
                                  aria-label={`Mover ${displayLeadCode(lead)}`}
                                  className="md:hidden h-11 text-xs"
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {pipelineStages("all").map((s) => (
                                    <SelectItem key={s} value={s}>
                                      {stageLabel(s)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </article>
                          )}
                        </Draggable>
                      );
                    })}
                  {provided.placeholder}
                  {rows.length > (limits[stage] ?? 30) && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() =>
                        setLimits((l) => ({
                          ...l,
                          [stage]: (l[stage] ?? 30) + 30,
                        }))
                      }
                    >
                      Mostrar mais ({rows.length - (limits[stage] ?? 30)})
                    </Button>
                  )}
                  {!rows.length && (
                    <p className="text-xs text-muted-foreground text-center py-8">
                      Sem ficheiros
                    </p>
                  )}
                </div>
              )}
            </Droppable>
          </>
        )}
      </section>
    );
  }
  return (
    <AppLayout>
      <div className="space-y-3 min-w-0">
        <header className="flex justify-between items-center">
          <h1 className="text-lg font-bold">CRM · Pipelines</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
          >
            <RefreshCw
              className={cn("h-4 w-4 mr-2", query.isFetching && "animate-spin")}
            />
            Atualizar
          </Button>
        </header>
        <div className="flex gap-4 min-w-0">
          <aside className="hidden md:flex flex-col w-48 shrink-0 gap-1 border-r pr-3">
            <h2 className="text-xs font-semibold text-muted-foreground py-2">
              Vistas
            </h2>
            {VIEWS.map((v) => (
              <Button
                key={v.pipeline}
                variant={pipeline === v.pipeline ? "secondary" : "ghost"}
                className="justify-between h-auto py-3 text-xs whitespace-normal text-left"
                onClick={() => {
                  setPipeline(v.pipeline);
                  setFilters(EMPTY_CRM_FILTERS);
                }}
              >
                <span>{v.name}</span>
                <span>
                  {
                    leads.filter((l) =>
                      pipelineStages(v.pipeline).includes(
                        optimistic[l.id] ?? l.stage,
                      ),
                    ).length
                  }
                </span>
              </Button>
            ))}
            {views.error && (
              <p className="text-xs text-destructive">
                Erro ao carregar vistas
              </p>
            )}
            {views.data?.map((v) => (
              <div key={v.id} className="flex items-center">
                <Button
                  variant="ghost"
                  className="text-xs flex-1 min-w-0 justify-between"
                  onClick={() => chooseView(v)}
                >
                  <span className="truncate">{v.name}</span>
                  <span>
                    {
                      leads.filter(
                        (l) =>
                          pipelineStages(v.pipeline as Pipeline).includes(
                            l.stage,
                          ) &&
                          matchesCrmFilters(l, {
                            ...EMPTY_CRM_FILTERS,
                            ...(v.filters as Partial<CrmFilters>),
                          }),
                      ).length
                    }
                  </span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Apagar vista ${v.name}`}
                  onClick={async () => {
                    const { error } = await supabase
                      .from("crm_saved_views")
                      .delete()
                      .eq("id", v.id);
                    if (error)
                      toast({ title: error.message, variant: "destructive" });
                    else
                      void qc.invalidateQueries({
                        queryKey: ["crm-saved-views"],
                      });
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSaveOpen(true)}
            >
              <Save className="h-3 w-3 mr-2" />
              Guardar vista
            </Button>
          </aside>
          <main className="flex-1 min-w-0 space-y-3">
            <div className="md:hidden">
              <Select
                value={pipeline}
                onValueChange={(v) => {
                  const saved = views.data?.find(
                    (view) => `view:${view.id}` === v,
                  );
                  if (saved) chooseView(saved);
                  else setPipeline(v as Pipeline);
                }}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIEWS.map((v) => (
                    <SelectItem key={v.pipeline} value={v.pipeline}>
                      {v.name} (
                      {
                        leads.filter((l) =>
                          pipelineStages(v.pipeline).includes(l.stage),
                        ).length
                      }
                      )
                    </SelectItem>
                  ))}
                  {views.data?.map((v) => (
                    <SelectItem key={v.id} value={`view:${v.id}`}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value="stage">
                <SelectTrigger
                  className="w-44 h-11 md:h-9 text-xs"
                  aria-label="Agrupar cartões"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stage">Cartões por etapa</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={sort.key}
                onValueChange={(key) =>
                  setSort((s) => ({ ...s, key: key as CrmSort["key"] }))
                }
              >
                <SelectTrigger
                  className="w-44 h-11 md:h-9 text-xs"
                  aria-label="Ordenar por"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SORTS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                aria-label="Inverter ordenação"
                onClick={() =>
                  setSort((s) => ({
                    ...s,
                    direction: s.direction === "asc" ? "desc" : "asc",
                  }))
                }
              >
                <ArrowDownUp className="h-4 w-4" />
              </Button>
              <Input
                className="flex-1 min-w-36 h-11 md:h-9 text-base md:text-sm"
                placeholder="Pesquisar YT, cliente, programa…"
                value={filters.search}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, search: e.target.value }))
                }
              />
              <Button
                variant="outline"
                size="icon"
                aria-label="Filtros"
                onClick={() => setFilterOpen(!filterOpen)}
              >
                <Filter className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="md:hidden"
                aria-label="Guardar vista"
                onClick={() => setSaveOpen(true)}
              >
                <Save className="h-4 w-4" />
              </Button>
            </div>
            {filterOpen && (
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 border-y py-3">
                {[
                  ["owner", "Responsável", owners],
                  [
                    "client_type",
                    "Tipo",
                    [
                      ["B2B", "B2B"],
                      ["B2C", "B2C"],
                    ],
                  ],
                  [
                    "source",
                    "Origem",
                    [
                      ...new Set(leads.map((l) => l.source).filter(Boolean)),
                    ].map((s) => [s, s]),
                  ],
                ].map(([key, label, options]) => (
                  <Select
                    key={String(key)}
                    value={filters[key as keyof CrmFilters] || "any"}
                    onValueChange={(v) =>
                      setFilters((f) => ({
                        ...f,
                        [String(key)]: v === "any" ? "" : v,
                      }))
                    }
                  >
                    <SelectTrigger
                      className="h-11 text-xs"
                      aria-label={String(label)}
                    >
                      <SelectValue placeholder={String(label)} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">
                        {String(label)} · Todos
                      </SelectItem>
                      {(options as string[][]).map(([value, text]) => (
                        <SelectItem key={value} value={value}>
                          {text || value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ))}
                <label className="text-xs">
                  Viagem desde
                  <Input
                    type="date"
                    className="h-11 text-base"
                    value={filters.from}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, from: e.target.value }))
                    }
                  />
                </label>
                <label className="text-xs">
                  Viagem até
                  <Input
                    type="date"
                    className="h-11 text-base"
                    value={filters.to}
                    onChange={(e) =>
                      setFilters((f) => ({ ...f, to: e.target.value }))
                    }
                  />
                </label>
                <Button
                  variant="ghost"
                  onClick={() => setFilters(EMPTY_CRM_FILTERS)}
                >
                  Limpar filtros
                </Button>
              </div>
            )}
            {query.error && (
              <div className="text-destructive text-sm" role="alert">
                Não foi possível carregar os pipelines:{" "}
                {query.error instanceof Error
                  ? query.error.message
                  : String(query.error)}
              </div>
            )}
            <div className="md:hidden">
              <Select value={currentStage} onValueChange={setMobileStage}>
                <SelectTrigger
                  className="h-11 text-xs"
                  aria-label="Etapa visível"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((s) => (
                    <SelectItem key={s} value={s}>
                      {stageLabel(s)} (
                      {filtered.filter((l) => l.stage === s).length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {query.isLoading ? (
              <div className="flex gap-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-96 w-full md:w-72" />
                ))}
              </div>
            ) : (
              <DragDropContext onDragEnd={drop}>
                {!isMobile && (
                  <div className="flex gap-3 overflow-x-auto pb-3">
                    {stages.map(renderColumn)}
                  </div>
                )}
                {isMobile && (
                  <div
                    onTouchStart={(e) =>
                      setTouch(e.touches[0]?.clientX ?? null)
                    }
                    onTouchEnd={(e) => {
                      const end = e.changedTouches[0]?.clientX;
                      if (
                        touch !== null &&
                        end !== undefined &&
                        Math.abs(end - touch) > 70
                      ) {
                        const next =
                          stages[
                            stages.indexOf(currentStage) +
                              (end < touch ? 1 : -1)
                          ];
                        if (next) setMobileStage(next);
                      }
                      setTouch(null);
                    }}
                  >
                    {renderColumn(currentStage)}
                  </div>
                )}
              </DragDropContext>
            )}
          </main>
        </div>
        <CrmLeadPreview lead={preview} onClose={() => setPreview(null)} />
        <NewLeadDialog
          open={!!creation}
          onOpenChange={(open) => {
            if (!open) setCreation(null);
          }}
          initialStage={creation ?? undefined}
        />
        <Dialog
          open={!!pending}
          onOpenChange={(open) => {
            if (!open) setPending(null);
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mover para Operações?</DialogTitle>
            </DialogHeader>
            <p className="text-sm">
              {pending && stageLabel(pending.stage)}. Esta alteração segue o
              processo atual de operações e sincronização.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPending(null)}>
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (pending) void move(pending.id, pending.stage);
                }}
              >
                Confirmar mudança
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Guardar vista pessoal</DialogTitle>
            </DialogHeader>
            <Input
              aria-label="Nome da vista"
              placeholder="Nome da vista"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <DialogFooter>
              <Button onClick={saveView} disabled={saving || !name.trim()}>
                Guardar vista
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

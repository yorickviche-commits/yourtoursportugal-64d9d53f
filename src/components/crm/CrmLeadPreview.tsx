import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  useLeadTimeline,
  useNHTasks,
  describeFieldChange,
} from "@/hooks/useNetHunt";
import type { CrmLead } from "@/hooks/useCrmPipeline";
import YtRefBadge from "./YtRefBadge";
import StageBadge from "./StageBadge";
import { displayLeadCode } from "@/lib/leadCode";
export default function CrmLeadPreview({
  lead,
  onClose,
}: {
  lead: CrmLead | null;
  onClose: () => void;
}) {
  const timeline = useLeadTimeline(lead?.id);
  const tasks = useNHTasks(lead?.id);
  const navigate = useNavigate();
  return (
    <Sheet
      open={!!lead}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Pré-visualização</SheetTitle>
        </SheetHeader>
        {lead && (
          <div className="space-y-5 mt-5">
            <YtRefBadge value={displayLeadCode(lead)} />
            <h2 className="font-semibold break-words">{lead.client_name}</h2>
            <StageBadge stage={lead.stage} />
            <dl className="text-sm space-y-2">
              <div>{lead.email || "Sem email"}</div>
              <div>{lead.phone || "Sem telefone"}</div>
              <div>
                {lead.destination} · {lead.pax} pax
              </div>
              <div>
                {lead.trip_start || "Sem início"} →{" "}
                {lead.trip_finish || "Sem fim"}
              </div>
              <div>{lead.owner_name || "Sem responsável"}</div>
            </dl>
            <Button onClick={() => navigate(`/leads/${lead.id}`)}>
              Abrir ficha
            </Button>
            <h3 className="text-sm font-semibold">Próximas tarefas</h3>
            {tasks.error ? (
              <p className="text-destructive text-sm">
                Não foi possível carregar as tarefas.
              </p>
            ) : (
              (tasks.data ?? [])
                .filter(
                  (t) =>
                    !t.completed &&
                    !["done", "completed", "cancelled"].includes(
                      t.status ?? "",
                    ),
                )
                .slice(0, 5)
                .map((t) => (
                  <div key={t.id} className="border-b pb-2 text-sm">
                    {t.title}
                    <p className="text-xs text-muted-foreground">
                      {t.due_date ?? t.due_at ?? "Sem prazo"}
                    </p>
                  </div>
                ))
            )}
            <h3 className="text-sm font-semibold">Últimos eventos</h3>
            {timeline.error ? (
              <p className="text-destructive text-sm">
                Não foi possível carregar o histórico.
              </p>
            ) : (
              (timeline.data ?? []).slice(0, 8).map((t) => (
                <div key={t.id} className="text-sm border-b pb-2">
                  <p>
                    {t.subject ||
                      (t.event_type === "field_change"
                        ? describeFieldChange(t.payload).lines.join(" · ")
                        : t.snippet) ||
                      "Evento"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.event_time
                      ? new Date(t.event_time).toLocaleString("pt-PT")
                      : "—"}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

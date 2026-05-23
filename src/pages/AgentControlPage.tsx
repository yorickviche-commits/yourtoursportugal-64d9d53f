import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAgentNotifications, useMarkNotificationRead, useDismissNotification } from '@/hooks/useAgentNotifications';
import { useAgentPendingActions, useApproveAction, useRejectAction } from '@/hooks/useAgentPendingActions';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Bell, Zap, CheckCircle, XCircle, Clock, AlertTriangle,
  Info, AlertCircle, Mail, CalendarCheck, FileText, X, Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

const PRIORITY_CONFIG = {
  urgent: { color: 'bg-red-500', text: 'text-red-600', label: 'Urgente', border: 'border-l-red-500' },
  high:   { color: 'bg-orange-500', text: 'text-orange-600', label: 'Alto', border: 'border-l-orange-500' },
  medium: { color: 'bg-yellow-500', text: 'text-yellow-600', label: 'Médio', border: 'border-l-yellow-400' },
  low:    { color: 'bg-blue-400', text: 'text-blue-500', label: 'Info', border: 'border-l-blue-400' },
};

const TYPE_ICON = {
  alert:           <AlertCircle className="h-4 w-4 text-red-500" />,
  warning:         <AlertTriangle className="h-4 w-4 text-orange-500" />,
  info:            <Info className="h-4 w-4 text-blue-500" />,
  action_required: <Zap className="h-4 w-4 text-yellow-500" />,
};

const ACTION_ICON: Record<string, React.ReactNode> = {
  send_email:            <Mail className="h-4 w-4" />,
  create_calendar_event: <CalendarCheck className="h-4 w-4" />,
  request_invoice:       <FileText className="h-4 w-4" />,
  send_proposal_followup:<Mail className="h-4 w-4" />,
  update_status:         <CheckCircle className="h-4 w-4" />,
};

const STATUS_CONFIG = {
  pending:  { label: 'A aguardar', color: 'bg-yellow-100 text-yellow-800' },
  approved: { label: 'Aprovado', color: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rejeitado', color: 'bg-red-100 text-red-800' },
  executed: { label: 'Executado', color: 'bg-blue-100 text-blue-800' },
  failed:   { label: 'Erro', color: 'bg-gray-100 text-gray-800' },
};

const AgentControlPage = () => {
  const { data: notifications = [], isLoading: nLoad } = useAgentNotifications();
  const { data: actions = [], isLoading: aLoad } = useAgentPendingActions();
  const markRead = useMarkNotificationRead();
  const dismiss = useDismissNotification();
  const approve = useApproveAction();
  const reject = useRejectAction();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('notifications');

  const unread = notifications.filter(n => !n.read_at).length;
  const pending = actions.filter(a => a.status === 'pending').length;

  const handleApprove = async (id: string, title: string) => {
    await approve.mutateAsync(id);
    toast({ title: 'Acção aprovada', description: title });
  };

  const handleReject = async (id: string, title: string) => {
    await reject.mutateAsync({ id });
    toast({ title: 'Acção rejeitada', description: title, variant: 'destructive' });
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-md">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Agent Control Center</h1>
            <p className="text-xs text-muted-foreground">Monitorização e aprovação de acções do Spark</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 border border-green-200">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium text-green-700">Spark activo</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Notificações novas', value: unread, icon: <Bell className="h-4 w-4" />, color: 'text-violet-600' },
            { label: 'Acções pendentes', value: pending, icon: <Zap className="h-4 w-4" />, color: 'text-yellow-600' },
            { label: 'Total hoje', value: notifications.length + actions.length, icon: <CheckCircle className="h-4 w-4" />, color: 'text-blue-600' },
          ].map(s => (
            <div key={s.label} className="bg-card border border-border rounded-xl p-4">
              <div className={cn("flex items-center gap-2 mb-1", s.color)}>
                {s.icon}
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-3.5 w-3.5" />
              Notificações
              {unread > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-violet-600 text-white rounded-full">{unread}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="actions" className="gap-2">
              <Zap className="h-3.5 w-3.5" />
              Acções Pendentes
              {pending > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-yellow-500 text-white rounded-full">{pending}</span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* NOTIFICATIONS */}
          <TabsContent value="notifications" className="space-y-3 mt-4">
            {nLoad && <p className="text-sm text-muted-foreground text-center py-8">A carregar...</p>}
            {!nLoad && notifications.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sem notificações</p>
              </div>
            )}
            {notifications.map(n => {
              const p = PRIORITY_CONFIG[n.priority] || PRIORITY_CONFIG.medium;
              return (
                <div
                  key={n.id}
                  onClick={() => !n.read_at && markRead.mutate(n.id)}
                  className={cn(
                    "bg-card border border-border rounded-xl p-4 border-l-4 cursor-pointer transition-all",
                    p.border,
                    !n.read_at ? 'shadow-sm' : 'opacity-60'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{TYPE_ICON[n.type]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-foreground">{n.title}</span>
                        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", p.color, 'bg-opacity-10')}>{p.label}</span>
                        {!n.read_at && <span className="h-2 w-2 rounded-full bg-violet-500 ml-auto shrink-0" />}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{n.body}</p>
                      {n.entity_ref && (
                        <p className="text-[11px] text-foreground/50 mt-1.5 font-medium">{n.entity_ref}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {n.agent_name} · {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); dismiss.mutate(n.id); }}
                      className="p-1 hover:bg-muted rounded shrink-0"
                    >
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              );
            })}
          </TabsContent>

          {/* PENDING ACTIONS */}
          <TabsContent value="actions" className="space-y-3 mt-4">
            {aLoad && <p className="text-sm text-muted-foreground text-center py-8">A carregar...</p>}
            {!aLoad && actions.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Zap className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sem acções pendentes</p>
              </div>
            )}
            {actions.map(a => {
              const s = STATUS_CONFIG[a.status] || STATUS_CONFIG.pending;
              const isPending = a.status === 'pending';
              return (
                <div key={a.id} className={cn(
                  "bg-card border border-border rounded-xl p-4 transition-all",
                  isPending ? 'shadow-sm' : 'opacity-60'
                )}>
                  <div className="flex items-start gap-3">
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      {ACTION_ICON[a.action_type] || <Zap className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-foreground">{a.title}</span>
                        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", s.color)}>{s.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{a.description}</p>

                      {/* Email preview */}
                      {a.payload?.body_preview && (
                        <div className="mt-2 p-2.5 bg-muted/50 rounded-lg border border-border">
                          <p className="text-[10px] text-muted-foreground font-medium mb-1">
                            Para: {a.payload.to} · {a.payload.subject}
                          </p>
                          <p className="text-xs text-foreground/70 italic">"{a.payload.body_preview}..."</p>
                        </div>
                      )}

                      {a.entity_ref && (
                        <p className="text-[11px] text-foreground/50 mt-1.5 font-medium">{a.entity_ref}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {a.agent_name} · {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                  </div>

                  {isPending && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                      <Button
                        size="sm"
                        className="flex-1 gap-1.5 bg-green-600 hover:bg-green-700 text-white h-8"
                        onClick={() => handleApprove(a.id, a.title)}
                        disabled={approve.isPending}
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1.5 text-red-600 border-red-200 hover:bg-red-50 h-8"
                        onClick={() => handleReject(a.id, a.title)}
                        disabled={reject.isPending}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Rejeitar
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default AgentControlPage;

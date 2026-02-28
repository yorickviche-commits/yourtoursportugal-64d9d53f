import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { mockLeads } from '@/data/mockLeads';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type DetailTab = 'dados_gerais' | 'travel_planner' | 'custos' | 'itinerario' | 'operacoes';

const DETAIL_TABS: { key: DetailTab; label: string }[] = [
  { key: 'dados_gerais', label: 'Dados Gerais' },
  { key: 'travel_planner', label: 'Travel Planner' },
  { key: 'custos', label: 'Custos' },
  { key: 'itinerario', label: 'Itinerário' },
  { key: 'operacoes', label: 'Operações' },
];

const RIGHT_TABS = ['Email', 'Tasks', 'Notas', 'Comentários', 'Follow up', 'Chatbot'];

const LeadDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const lead = mockLeads.find(l => l.id === id);
  const [activeTab, setActiveTab] = useState<DetailTab>('dados_gerais');

  if (!lead) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Simulação não encontrada</p>
          <Link to="/leads" className="text-[hsl(var(--info))] text-sm hover:underline mt-2 inline-block">Voltar</Link>
        </div>
      </AppLayout>
    );
  }

  const statusLabel = lead.status === 'new' ? 'em construção' : lead.status;

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div>
          <Link to="/leads" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
            <ArrowLeft className="h-3 w-3" /> Voltar às simulações
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-bold text-foreground">
                Nº{lead.id.replace('L-', '')} - {lead.email} - - {lead.destination} - adt:{lead.pax} - chl:0 - inf:0
              </h1>
              <p className="text-sm font-semibold text-[hsl(var(--warning))]">[ {statusLabel} ]</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="text-xs">Pagamento</Button>
              <div className="bg-destructive text-destructive-foreground text-xs font-bold px-3 py-1.5 rounded">
                NOT PAID 0€ - {lead.budgetLevel}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation tabs */}
        <div className="flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-0">
            {DETAIL_TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px",
                  activeTab === tab.key
                    ? "border-[hsl(var(--info))] text-[hsl(var(--info))]"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {RIGHT_TABS.map(tab => (
              <button key={tab} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Dados Gerais */}
        {activeTab === 'dados_gerais' && (
          <div className="space-y-6">
            {/* Version selector */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">🔒 Versão · 0 🔗</span>
              <Button variant="outline" size="sm" className="text-xs">Duplicar</Button>
              <Button variant="outline" size="sm" className="text-xs">Nova Versão</Button>
            </div>

            {/* Informação geral */}
            <div>
              <h3 className="text-sm font-bold text-foreground mb-3">Informação geral</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Nº VI</label>
                  <Input className="h-8 text-xs mt-1" defaultValue={lead.id.replace('L-', '')} readOnly />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Criador da Simulação</label>
                  <Input className="h-8 text-xs mt-1" defaultValue={lead.salesOwner} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Data</label>
                  <Input className="h-8 text-xs mt-1" defaultValue={new Date(lead.createdAt).toLocaleString('pt-PT')} readOnly />
                </div>
              </div>
            </div>

            {/* Dados do cliente */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground mb-3">Dados do cliente</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Nome</label>
                  <Input className="h-8 text-xs mt-1" defaultValue={lead.clientName} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">E-mail</label>
                  <Input className="h-8 text-xs mt-1" defaultValue={lead.email} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Telefone</label>
                  <Input className="h-8 text-xs mt-1" defaultValue={lead.phone || ''} />
                </div>
              </div>
            </div>

            {/* Dados da viagem */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground mb-3">Dados da viagem</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Categoria</label>
                  <Input className="h-8 text-xs mt-1" defaultValue={lead.comfortLevel || ''} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Destino</label>
                  <Input className="h-8 text-xs mt-1" defaultValue={lead.destination} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Data inicial</label>
                  <Input className="h-8 text-xs mt-1" defaultValue={lead.travelDates} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-3">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Nº de adultos</label>
                  <Input className="h-8 text-xs mt-1" type="number" defaultValue={lead.pax} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Nº de jovens</label>
                  <Input className="h-8 text-xs mt-1" type="number" defaultValue={0} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Nº de crianças</label>
                  <Input className="h-8 text-xs mt-1" type="number" defaultValue={0} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-3">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Budget total da viagem (€)</label>
                  <Input className="h-8 text-xs mt-1" defaultValue="" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Total da Viagem (€)</label>
                  <Input className="h-8 text-xs mt-1" defaultValue="" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Idioma</label>
                  <Input className="h-8 text-xs mt-1" defaultValue="EN" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-3">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Origem do Itinerário</label>
                  <Input className="h-8 text-xs mt-1" defaultValue={lead.source === 'ai_simulation' ? 'AI Simulation' : lead.source} />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Valor a Receber Pelo Guia</label>
                  <Input className="h-8 text-xs mt-1" defaultValue="" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Desconto</label>
                  <Input className="h-8 text-xs mt-1" defaultValue="" />
                </div>
              </div>
            </div>

            {/* Travel styles */}
            {lead.travelStyle && lead.travelStyle.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-2">Estilos de viagem</h3>
                <div className="flex gap-2 flex-wrap">
                  {lead.travelStyle.map(style => (
                    <span key={style} className="text-xs bg-[hsl(var(--info-muted))] text-[hsl(var(--info))] px-2 py-1 rounded">{style}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Magic question */}
            {lead.magicQuestion && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground mb-2">✨ O que tornaria esta viagem inesquecível?</h3>
                <p className="text-sm text-foreground italic">"{lead.magicQuestion}"</p>
              </div>
            )}

            {/* Preferências */}
            <div>
              <label className="text-[10px] text-muted-foreground uppercase">Preferências / Notas</label>
              <Textarea className="mt-1 text-xs" rows={3} defaultValue={lead.notes || ''} />
            </div>

            {/* Valor Net + Margem */}
            <div className="border-t pt-4">
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <p className="text-xs text-muted-foreground">Valor Net</p>
                  <p className="text-sm font-semibold text-[hsl(var(--info))]">—</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Margem</p>
                  <p className="text-sm font-semibold text-foreground">—</p>
                </div>
              </div>
            </div>

            {/* Payment history */}
            <div>
              <h3 className="text-sm font-bold text-foreground mb-2">Histórico de Pagamento</h3>
              <p className="text-xs text-[hsl(var(--urgent))]">Activate Follow-Up</p>
              <Input className="h-8 text-xs mt-1 max-w-xs" placeholder="dd/mm/aaaa --:--" />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between border-t pt-4">
              <Button variant="destructive" size="sm" className="text-xs gap-1">
                <Trash2 className="h-3 w-3" /> Remover
              </Button>
              <Button size="sm" className="text-xs gap-1">
                <Save className="h-3 w-3" /> Atualizar
              </Button>
            </div>
          </div>
        )}

        {/* Other tabs placeholder */}
        {activeTab !== 'dados_gerais' && (
          <div className="bg-card rounded-lg border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {activeTab === 'travel_planner' && 'Travel Planner — Organização de Experiências, Cronograma, Mapa, Resumo'}
              {activeTab === 'custos' && 'Orçamentação por dia — atividades, fornecedor, NET, margem, PVP, lucro'}
              {activeTab === 'itinerario' && 'Itinerário comercial — vista cliente'}
              {activeTab === 'operacoes' && 'Operações — reservas, pagamentos, faturas por dia'}
            </p>
            <p className="text-xs text-muted-foreground mt-2">Disponível quando conectado ao Google Sheets via Make.com</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default LeadDetailPage;

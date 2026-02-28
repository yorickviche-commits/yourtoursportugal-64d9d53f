import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Save, Trash2, FileText, ClipboardList } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { mockLeads } from '@/data/mockLeads';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import TagSelect from '@/components/TagSelect';
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

const CATEGORIAS = ['Premium & Boutique', 'Standard', 'Luxury', 'Budget', 'Adventure'];
const DESTINOS = ['Porto & Douro Valley', 'Lisbon & Sintra', 'Algarve', 'Azores', 'Madeira', 'Minho', 'Alentejo', 'Silver Coast'];
const IDIOMAS = ['EN', 'PT', 'FR', 'ES', 'DE', 'IT', 'NL'];
const ORIGENS = ['website', 'AI Simulation', 'referral', 'partner', 'social_media', 'direct'];

const LeadDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const lead = mockLeads.find(l => l.id === id);
  const [activeTab, setActiveTab] = useState<DetailTab>('dados_gerais');

  // Tag select states
  const [categoria, setCategoria] = useState<string[]>(lead?.comfortLevel ? [lead.comfortLevel] : []);
  const [destino, setDestino] = useState<string[]>(lead?.destination ? [lead.destination] : []);
  const [idioma, setIdioma] = useState<string[]>(['EN']);
  const [origem, setOrigem] = useState<string[]>(lead?.source === 'ai_simulation' ? ['AI Simulation'] : lead?.source ? [lead.source] : []);
  const [travelStyles, setTravelStyles] = useState<string[]>(lead?.travelStyle || []);
  const [activeVersion, setActiveVersion] = useState(1);

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
                Nº{lead.id.replace('L-', '')} - {lead.email} - {lead.destination} - adt:{lead.pax} - chl:0 - inf:0
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
              <div className="flex items-center gap-1">
                {[1, 2, 3].map(v => (
                  <button key={v} onClick={() => setActiveVersion(v)}
                    className={cn("px-2.5 py-1 text-xs rounded border transition-colors",
                      activeVersion === v ? "bg-[hsl(var(--info))] text-white border-[hsl(var(--info))]" : "border-border text-muted-foreground hover:text-foreground"
                    )}>
                    V{v}
                  </button>
                ))}
              </div>
              <span className="text-xs text-muted-foreground">🔒 Versão · {activeVersion}</span>
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

            {/* Dados da viagem - with tag selects */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground mb-3">Dados da viagem</h3>
              <div className="grid grid-cols-3 gap-4">
                <TagSelect label="Categoria" value={categoria} options={CATEGORIAS} onChange={setCategoria} />
                <TagSelect label="Destino" value={destino} options={DESTINOS} onChange={setDestino} multiple />
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Data inicial</label>
                  <Input className="h-8 text-xs mt-1" type="date" defaultValue={lead.travelDates} />
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
                <TagSelect label="Idioma" value={idioma} options={IDIOMAS} onChange={setIdioma} />
              </div>
              <div className="grid grid-cols-3 gap-4 mt-3">
                <TagSelect label="Origem do Itinerário" value={origem} options={ORIGENS} onChange={setOrigem} />
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

            {/* Travel styles as tag select */}
            <TagSelect
              label="Estilos de viagem"
              value={travelStyles}
              options={['Food & Wine', 'Culture & History', 'Nature & Adventure', 'Beach & Relax', 'City Break', 'Road Trip', 'Wellness', 'Photography']}
              onChange={setTravelStyles}
              multiple
            />

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

        {/* Travel Planner */}
        {activeTab === 'travel_planner' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Travel Planner</h3>
              <Button size="sm" className="text-xs gap-1 bg-gradient-to-r from-[hsl(var(--info))] to-[hsl(var(--info)/0.7)] text-white">
                🤖 Gerar com Claude AI
              </Button>
            </div>
            <div className="bg-card rounded-lg border p-6 text-center space-y-2">
              <p className="text-sm text-muted-foreground">O Travel Planner será gerado automaticamente pelo Claude AI</p>
              <p className="text-xs text-muted-foreground">Com base nos dados do lead, discovery form e base de dados YT, o Claude cria a estrutura base do programa e itinerário.</p>
              <p className="text-xs text-muted-foreground mt-4">Integração via Make.com → Claude API → Google Sheets</p>
            </div>
          </div>
        )}

        {/* Custos */}
        {activeTab === 'custos' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Orçamentação & Margens</h3>
              <Button size="sm" className="text-xs gap-1 bg-gradient-to-r from-[hsl(var(--info))] to-[hsl(var(--info)/0.7)] text-white">
                🤖 Calcular Budget com AI
              </Button>
            </div>
            <div className="bg-card rounded-lg border p-6 text-center space-y-2">
              <p className="text-sm text-muted-foreground">Orçamentação detalhada por dia com atividades, fornecedor, preço NET, margem %, PVP, lucro</p>
              <p className="text-xs text-muted-foreground">Claude AI consulta a base de dados de custos e calcula margens automaticamente.</p>
            </div>
          </div>
        )}

        {/* Itinerário */}
        {activeTab === 'itinerario' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Itinerário Digital (Customer-Facing)</h3>
              <Button size="sm" className="text-xs gap-1 bg-gradient-to-r from-[hsl(var(--info))] to-[hsl(var(--info)/0.7)] text-white">
                🤖 Gerar Itinerário com AI
              </Button>
            </div>
            <div className="bg-card rounded-lg border p-6 text-center space-y-2">
              <p className="text-sm text-muted-foreground">Itinerário digital customer-facing com imagens, gerado pelo Claude AI</p>
              <p className="text-xs text-muted-foreground">Versão comercial, inspiracional e visual para envio ao cliente.</p>
            </div>
          </div>
        )}

        {/* Operações */}
        {activeTab === 'operacoes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Operações</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Baseado na versão aceite (V{activeVersion})</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Quando a simulação é confirmada e o depósito pago, o costing da última versão aceite popula as rubricas operacionais.
            </p>

            {/* Briefing buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" size="sm" className="text-xs gap-2 h-12 justify-start">
                <ClipboardList className="h-4 w-4 text-[hsl(var(--info))]" />
                <div className="text-left">
                  <p className="font-medium">Briefing Geral FSEs</p>
                  <p className="text-muted-foreground text-[10px]">Para cada fornecedor relevante, guia e transporte</p>
                </div>
              </Button>
              <Button variant="outline" size="sm" className="text-xs gap-2 h-12 justify-start">
                <FileText className="h-4 w-4 text-[hsl(var(--success))]" />
                <div className="text-left">
                  <p className="font-medium">Briefing Final Cliente</p>
                  <p className="text-muted-foreground text-[10px]">Versão compilada para envio ao cliente</p>
                </div>
              </Button>
            </div>

            <div className="bg-card rounded-lg border p-6 text-center space-y-2">
              <p className="text-sm text-muted-foreground">Reservas, pagamentos, faturas por dia — operações completas</p>
              <p className="text-xs text-muted-foreground">Disponível após confirmação da simulação.</p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default LeadDetailPage;

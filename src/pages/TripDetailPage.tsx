import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, FileText, MessageSquare,
  PanelRightClose, PanelRight,
  Plus, Trash2, Upload, X,
  AlertTriangle, CreditCard, CheckCircle2, Circle, Loader2,
} from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import StatusBadge from '@/components/StatusBadge';
import { useTripQuery, useUpdateTrip } from '@/hooks/useTripsQuery';
import { useTripItineraryQuery, useCreateTripItineraryItem, useUpdateTripItineraryItem, useDeleteTripItineraryItem } from '@/hooks/useTripItineraryQuery';
import { useCostItemsQuery, useCreateCostItem, useUpdateCostItem, useDeleteCostItem } from '@/hooks/useCostItemsQuery';
import { useContactsQuery } from '@/hooks/useContactsQuery';
import { useDocumentsQuery, useCreateDocument, useDeleteDocument } from '@/hooks/useDocumentsQuery';
import { useActivityLogQuery } from '@/hooks/useActivityLogQuery';
import { statusConfig, urgencyConfig, budgetLabels } from '@/lib/config';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { logActivity } from '@/hooks/useActivityLog';
import EditableCostingTable from '@/components/trip/EditableCostingTable';
import OperationsTable from '@/components/trip/OperationsTable';
import { formatDistanceToNow } from 'date-fns';
import { pt } from 'date-fns/locale';

type TripTab = 'details' | 'itinerary' | 'costing' | 'operations' | 'contacts' | 'activity' | 'documents';

const TripDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { data: trip, isLoading } = useTripQuery(id);
  const updateTripMutation = useUpdateTrip();
  const { toast } = useToast();
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<TripTab>('details');

  // Sub-data queries
  const { data: itineraryItems = [] } = useTripItineraryQuery(id);
  const { data: costItems = [] } = useCostItemsQuery(id);
  const { data: contacts = [] } = useContactsQuery(trip?.lead_id || undefined);
  const { data: documents = [] } = useDocumentsQuery('trip', id);
  const { data: activityLogs = [] } = useActivityLogQuery('trip', id);

  // Mutations
  const createItinerary = useCreateTripItineraryItem();
  const updateItinerary = useUpdateTripItineraryItem();
  const deleteItinerary = useDeleteTripItineraryItem();
  const createCost = useCreateCostItem();
  const updateCost = useUpdateCostItem();
  const deleteCost = useDeleteCostItem();
  const createDoc = useCreateDocument();
  const deleteDoc = useDeleteDocument();

  // New itinerary form
  const [newItDay, setNewItDay] = useState(1);
  const [newItTitle, setNewItTitle] = useState('');

  // Checklist local state
  const [checklistItems, setChecklistItems] = useState([
    { id: 1, label: 'Hotel reservations confirmed', done: false },
    { id: 2, label: 'Airport transfers booked', done: false },
    { id: 3, label: 'Restaurant reservations made', done: false },
    { id: 4, label: 'Activity tickets purchased', done: false },
    { id: 5, label: 'Travel insurance verified', done: false },
    { id: 6, label: 'Welcome pack prepared', done: false },
  ]);
  const [newCheckItem, setNewCheckItem] = useState('');

  // Derived data
  const totalValue = trip?.total_value || 0;
  const costSubtotal = costItems.reduce((sum, c) => sum + (c.total_cost || 0), 0);
  const profit = totalValue - costSubtotal;
  const completedChecks = checklistItems.filter(c => c.done).length;

  const itineraryByDay = useMemo(() => {
    const grouped: Record<number, typeof itineraryItems> = {};
    itineraryItems.forEach(item => {
      if (!grouped[item.day_number]) grouped[item.day_number] = [];
      grouped[item.day_number].push(item);
    });
    return Object.entries(grouped).sort(([a], [b]) => Number(a) - Number(b));
  }, [itineraryItems]);

  const tabs: { key: TripTab; label: string }[] = [
    { key: 'details', label: 'Detalhes' },
    { key: 'itinerary', label: `Itinerário (${itineraryItems.length})` },
    { key: 'costing', label: `Custos (${costItems.length})` },
    { key: 'operations', label: 'Operações' },
    { key: 'contacts', label: `Contactos (${contacts.length})` },
    { key: 'activity', label: `Atividade (${activityLogs.length})` },
    { key: 'documents', label: `Docs (${documents.length})` },
  ];

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">A carregar viagem...</span>
        </div>
      </AppLayout>
    );
  }

  if (!trip) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Viagem não encontrada</p>
          <Link to="/trips" className="text-[hsl(var(--info))] text-sm hover:underline mt-2 inline-block">Voltar às viagens</Link>
        </div>
      </AppLayout>
    );
  }

  const toggleCheckItem = (checkId: number) => setChecklistItems(prev => prev.map(i => i.id === checkId ? { ...i, done: !i.done } : i));
  const addCheckItem = () => { if (!newCheckItem.trim()) return; setChecklistItems(prev => [...prev, { id: Date.now(), label: newCheckItem.trim(), done: false }]); setNewCheckItem(''); };
  const removeCheckItem = (checkId: number) => setChecklistItems(prev => prev.filter(i => i.id !== checkId));

  const handleSaveNotes = async (notes: string) => {
    try {
      await updateTripMutation.mutateAsync({ id: trip.id, updates: { notes } });
      await logActivity('trip_notes_updated', 'trip', trip.id);
      toast({ title: 'Notas guardadas' });
    } catch (err: any) { toast({ title: 'Erro', description: err.message, variant: 'destructive' }); }
  };

  const handleAddItineraryItem = async () => {
    if (!newItTitle.trim()) return;
    await createItinerary.mutateAsync({ trip_id: trip.id, day_number: newItDay, title: newItTitle.trim() });
    await logActivity('itinerary_item_added', 'trip', trip.id, { title: newItTitle });
    setNewItTitle('');
    toast({ title: 'Item adicionado' });
  };

  // Costing handlers (dynamic save)
  const handleAddCostItem = async (item: any) => {
    await createCost.mutateAsync(item);
    await logActivity('cost_item_added', 'trip', trip.id);
  };
  const handleUpdateCostItem = async (costId: string, updates: any) => {
    await updateCost.mutateAsync({ id: costId, updates });
  };
  const handleDeleteCostItem = async (costId: string) => {
    await deleteCost.mutateAsync({ id: costId, tripId: trip.id });
    await logActivity('cost_item_deleted', 'trip', trip.id);
  };


  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <Link to="/trips" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
              <ArrowLeft className="h-3 w-3" /> Voltar às viagens
            </Link>
            <h1 className="text-xl font-semibold">{trip.client_name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {trip.destination} · {trip.pax} pax · {budgetLabels[trip.budget_level || 'medium']}
              {trip.lead_id && (
                <> · <Link to={`/leads/${trip.lead_id}`} className="text-[hsl(var(--info))] hover:underline">Ver Lead</Link></>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge {...urgencyConfig[trip.urgency || 'normal']} />
            <StatusBadge {...statusConfig[trip.status]} />
            <button onClick={() => setRightPanelOpen(!rightPanelOpen)} className="p-2 hover:bg-muted rounded-md transition-colors ml-2">
              {rightPanelOpen ? <PanelRightClose className="h-4 w-4 text-muted-foreground" /> : <PanelRight className="h-4 w-4 text-muted-foreground" />}
            </button>
          </div>
        </div>

        {/* Blocker */}
        {trip.has_blocker && (
          <div className="rounded-lg p-3 flex items-start gap-2 border bg-destructive/5 border-destructive/20">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-destructive">⚠ Blocker</p>
              <p className="text-xs text-foreground mt-0.5">{trip.blocker_note || 'Blocker ativo'}</p>
            </div>
          </div>
        )}

        {/* Payment Summary */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Total da Viagem</p>
                <p className="text-lg font-bold">€{totalValue.toLocaleString()}</p>
              </div>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Custos Operacionais</p>
              <p className="text-sm font-semibold text-[hsl(var(--warning))]">€{costSubtotal.toLocaleString()}</p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Margem</p>
              <p className={cn("text-sm font-semibold", profit > 0 ? "text-[hsl(var(--success))]" : "text-destructive")}>
                €{profit.toLocaleString()} ({totalValue > 0 ? Math.round((profit / totalValue) * 100) : 0}%)
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={cn("px-4 py-2 text-xs font-medium border-b-2 transition-colors -mb-px whitespace-nowrap",
                activeTab === tab.key ? "border-[hsl(var(--info))] text-[hsl(var(--info))]" : "border-transparent text-muted-foreground hover:text-foreground"
              )}>{tab.label}</button>
          ))}
        </div>

        {/* Main Layout */}
        <div className="flex gap-6">
          <div className={cn("space-y-6 min-w-0", rightPanelOpen ? "flex-1" : "w-full")}>

            {/* Details Tab */}
            {activeTab === 'details' && (
              <>
                <div className="bg-card rounded-lg border p-4">
                  <h2 className="text-sm font-semibold mb-3">Detalhes da Viagem</h2>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><p className="text-muted-foreground">Datas</p><p className="font-medium">{trip.start_date || '—'} → {trip.end_date || '—'}</p></div>
                    <div><p className="text-muted-foreground">Sales Owner</p><p className="font-medium">{trip.sales_owner || '—'}</p></div>
                    <div><p className="text-muted-foreground">Trip Code</p><p className="font-medium">{trip.trip_code}</p></div>
                    <div><p className="text-muted-foreground">Status</p><p className="font-medium">{trip.status}</p></div>
                  </div>
                </div>
                <div className="bg-card rounded-lg border p-4">
                  <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Notas Internas</h2>
                  <Textarea className="text-xs min-h-[60px]" defaultValue={trip.notes || ''} onBlur={e => handleSaveNotes(e.target.value)} />
                </div>
              </>
            )}

            {/* Itinerary Tab */}
            {activeTab === 'itinerary' && (
              <div className="space-y-4">
                <div className="bg-card rounded-lg border p-4">
                  <h2 className="text-sm font-semibold mb-3">Adicionar Item</h2>
                  <div className="flex gap-2 items-end">
                    <div className="w-20">
                      <label className="text-[10px] text-muted-foreground">Dia</label>
                      <Input type="number" min={1} value={newItDay} onChange={e => setNewItDay(Number(e.target.value))} className="h-8 text-xs" />
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground">Título</label>
                      <Input value={newItTitle} onChange={e => setNewItTitle(e.target.value)} placeholder="Ex: Visita guiada ao Palácio da Pena" className="h-8 text-xs" />
                    </div>
                    <Button size="sm" className="text-xs gap-1" onClick={handleAddItineraryItem} disabled={createItinerary.isPending}>
                      <Plus className="h-3 w-3" /> Adicionar
                    </Button>
                  </div>
                </div>

                {itineraryByDay.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">Sem itinerário. Adicione itens acima.</p>
                ) : (
                  itineraryByDay.map(([dayNum, items]) => (
                    <div key={dayNum} className="bg-card rounded-lg border overflow-hidden">
                      <div className="px-4 py-3 border-b border-border bg-muted/30">
                        <p className="text-xs font-bold text-[hsl(var(--info))]">Dia {dayNum}</p>
                      </div>
                      <div className="divide-y divide-border">
                        {items.map(item => (
                          <div key={item.id} className="px-4 py-3 flex items-center justify-between group">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium">{item.title}</p>
                              {item.description && <p className="text-[10px] text-muted-foreground mt-0.5">{item.description}</p>}
                              <div className="flex items-center gap-2 mt-0.5">
                                {item.location && <span className="text-[10px] text-muted-foreground">📍 {item.location}</span>}
                                {item.start_time && <span className="text-[10px] text-muted-foreground">🕐 {item.start_time}{item.end_time ? `–${item.end_time}` : ''}</span>}
                              </div>
                            </div>
                            <button onClick={async () => { await deleteItinerary.mutateAsync({ id: item.id, tripId: trip.id }); await logActivity('itinerary_item_deleted', 'trip', trip.id); }}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded">
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Costing Tab */}
            {activeTab === 'costing' && (
              <div className="bg-card rounded-lg border overflow-hidden">
                <EditableCostingTable
                  items={costItems}
                  tripId={trip.id}
                  onAddItem={handleAddCostItem}
                  onUpdateItem={handleUpdateCostItem}
                  onDeleteItem={handleDeleteCostItem}
                />
              </div>
            )}

            {/* Operations Tab */}
            {activeTab === 'operations' && (
              <div className="bg-card rounded-lg border overflow-hidden">
                <OperationsTable
                  costItems={costItems}
                  tripId={trip.id}
                  tripCode={trip.trip_code}
                  startDate={trip.start_date}
                />
              </div>
            )}

            {/* Contacts Tab */}
            {activeTab === 'contacts' && (
              <div className="bg-card rounded-lg border">
                <div className="px-4 py-3 border-b border-border">
                  <h2 className="text-sm font-semibold">Contactos da Lead</h2>
                </div>
                {contacts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">Sem contactos associados</p>
                ) : (
                  <div className="divide-y divide-border">
                    {contacts.map(c => (
                      <div key={c.id} className="px-4 py-3">
                        <p className="text-xs font-medium">{c.name}</p>
                        <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                          {c.email && <span>✉ {c.email}</span>}
                          {c.phone && <span>📞 {c.phone}</span>}
                          <span className="px-1.5 py-0.5 rounded bg-muted text-[9px]">{c.role}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Activity Tab */}
            {activeTab === 'activity' && (
              <div className="bg-card rounded-lg border">
                <div className="px-4 py-3 border-b border-border">
                  <h2 className="text-sm font-semibold">Histórico de Atividade</h2>
                </div>
                {activityLogs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">Sem atividade registada</p>
                ) : (
                  <div className="divide-y divide-border">
                    {activityLogs.map(log => (
                      <div key={log.id} className="px-4 py-3 flex items-center gap-3">
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                          <FileText className="h-3 w-3 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium">{log.action_type.replace(/_/g, ' ')}</p>
                          <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: pt })}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Documents Tab */}
            {activeTab === 'documents' && (
              <div className="bg-card rounded-lg border">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Documentos</h2>
                  <Button variant="outline" size="sm" className="text-xs gap-1">
                    <Upload className="h-3 w-3" /> Upload
                  </Button>
                </div>
                {documents.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">Sem documentos</p>
                ) : (
                  <div className="divide-y divide-border">
                    {documents.map(doc => (
                      <div key={doc.id} className="px-4 py-3 flex items-center justify-between group">
                        <div className="flex items-center gap-2">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs">{doc.file_name}</span>
                        </div>
                        <button onClick={async () => { await deleteDoc.mutateAsync({ id: doc.id, entityType: 'trip', entityId: trip.id }); }}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded">
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          {rightPanelOpen && (
            <div className="w-[280px] shrink-0 space-y-4">
              <div className="bg-card rounded-lg border p-4">
                <h2 className="text-sm font-semibold mb-3">Operational Checklist</h2>
                <div className="space-y-1.5">
                  {checklistItems.map(item => (
                    <div key={item.id} className="flex items-center gap-2 group">
                      <button onClick={() => toggleCheckItem(item.id)} className="shrink-0">
                        {item.done ? <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" /> : <Circle className="h-4 w-4 text-muted-foreground hover:text-foreground" />}
                      </button>
                      <span className={cn("text-xs flex-1", item.done && "line-through text-muted-foreground")}>{item.label}</span>
                      <button onClick={() => removeCheckItem(item.id)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-muted rounded">
                        <X className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-1 mt-3">
                  <Input className="h-7 text-[10px] flex-1" placeholder="Novo item..." value={newCheckItem} onChange={e => setNewCheckItem(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCheckItem()} />
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={addCheckItem}><Plus className="h-3 w-3" /></Button>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                    <span>{completedChecks}/{checklistItems.length}</span>
                    <span>{checklistItems.length > 0 ? Math.round((completedChecks / checklistItems.length) * 100) : 0}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-[hsl(var(--success))] rounded-full transition-all" style={{ width: `${checklistItems.length > 0 ? (completedChecks / checklistItems.length) * 100 : 0}%` }} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default TripDetailPage;

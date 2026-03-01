import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, ExternalLink, FileText, MessageSquare,
  PanelRightClose, PanelRight, ChevronDown, ChevronRight,
  Plus, Trash2, Pencil, Upload, Image as ImageIcon, Link as LinkIcon,
  AlertTriangle, Bell, CreditCard, CheckCircle2, Circle, X,
  Bold, Italic, List, ListOrdered, Heading2,
} from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import StatusBadge from '@/components/StatusBadge';
import CostingTable, { CostingDay } from '@/components/trip/CostingTable';
import OperationsTable, { OperationsDay } from '@/components/trip/OperationsTable';
import { mockTrips } from '@/data/mockData';
import { statusConfig, urgencyConfig, budgetLabels } from '@/lib/config';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';

// ─── Itinerary data ───
interface ItineraryImage {
  id: string;
  url: string;
  source: 'unsplash' | 'upload' | 'url';
  caption?: string;
}

interface ItineraryDay {
  day: number;
  title: string;
  description: string;
  images: ItineraryImage[];
  expanded: boolean;
}

const defaultItineraryDays: ItineraryDay[] = [
  {
    day: 1, title: 'Arrival & City Exploration',
    description: 'Airport pickup, hotel check-in, walking tour of historic center, welcome dinner.',
    images: [
      { id: 'img1', url: 'https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=400&h=250&fit=crop', source: 'unsplash', caption: 'Lisbon historic center' },
      { id: 'img2', url: 'https://images.unsplash.com/photo-1513735492321-236cf8720a89?w=400&h=250&fit=crop', source: 'unsplash', caption: 'Welcome dinner' },
      { id: 'img3', url: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=400&h=250&fit=crop', source: 'unsplash', caption: 'Hotel view' },
    ],
    expanded: true,
  },
  {
    day: 2, title: 'Cultural Immersion',
    description: 'Morning museum visit, traditional cooking class, afternoon free time, fado evening.',
    images: [
      { id: 'img4', url: 'https://images.unsplash.com/photo-1574236170880-9f28b63b3edd?w=400&h=250&fit=crop', source: 'unsplash', caption: 'Museum' },
      { id: 'img5', url: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=400&h=250&fit=crop', source: 'unsplash', caption: 'Cooking class' },
      { id: 'img6', url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&h=250&fit=crop', source: 'unsplash', caption: 'Fado night' },
    ],
    expanded: false,
  },
  {
    day: 3, title: 'Day Trip',
    description: 'Full-day excursion with private guide, lunch at local restaurant, return by evening.',
    images: [
      { id: 'img7', url: 'https://images.unsplash.com/photo-1497802176320-541c8e8de98d?w=400&h=250&fit=crop', source: 'unsplash', caption: 'Countryside' },
      { id: 'img8', url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=250&fit=crop', source: 'unsplash', caption: 'Local restaurant' },
      { id: 'img9', url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&h=250&fit=crop', source: 'unsplash', caption: 'Sunset view' },
    ],
    expanded: false,
  },
];

// ─── Checklist ───
interface CheckItem {
  id: number;
  label: string;
  done: boolean;
}

// ─── Files ───
interface LinkedFile {
  id: string;
  name: string;
  type: string;
  date: string;
  editing?: boolean;
}

// ─── Notifications ───
interface Notification {
  id: string;
  type: 'blocker' | 'warning' | 'info';
  message: string;
  dismissed: boolean;
}

// ─── Costing data ───
const mockCostingDays: CostingDay[] = [
  {
    day: 1, date: '27/Dec/2026', title: 'Arrival & Transfer',
    activities: [
      { id: 'c1', name: 'Transfer-in Aeroporto - Hotel', supplier: '2Feel Portugal', perPersonOrTotal: 'TOTAL', numAdults: 0, numYouth: 0, priceAdults: 0, priceYouth: 0, netTotal: 79, marginPercent: 30, pvpTotal: 102.7, profit: 23.7 },
    ],
  },
  {
    day: 2, date: '28/Dec/2026', title: 'Lisbon Full Day Private Tour',
    activities: [
      { id: 'c2', name: 'Lisbon FD Privado', supplier: '2Feel Portugal', perPersonOrTotal: 'TOTAL', numAdults: 0, numYouth: 0, priceAdults: 0, priceYouth: 0, netTotal: 296, marginPercent: 30, pvpTotal: 384.8, profit: 88.8 },
      { id: 'c3', name: 'Passeio de tuk tuk (2h)', supplier: 'Tuk On Me', perPersonOrTotal: 'TOTAL', numAdults: 0, numYouth: 0, priceAdults: 0, priceYouth: 0, netTotal: 220, marginPercent: 30, pvpTotal: 286, profit: 66 },
      { id: 'c4', name: 'Almoço', supplier: null, perPersonOrTotal: 'POR PESSOA', numAdults: 4, numYouth: 1, priceAdults: 40, priceYouth: 40, netTotal: 200, marginPercent: 30, pvpTotal: 260, profit: 60 },
      { id: 'c5', name: 'Prova de Pastéis de Belém', supplier: null, perPersonOrTotal: 'POR PESSOA', numAdults: 4, numYouth: 1, priceAdults: 5, priceYouth: 5, netTotal: 25, marginPercent: 30, pvpTotal: 32.5, profit: 7.5 },
    ],
  },
  {
    day: 3, date: '29/Dec/2026', title: 'Sintra & Cascais Full Day',
    activities: [
      { id: 'c6', name: 'Sintra & Cascais FD Privado', supplier: '2Feel Portugal', perPersonOrTotal: 'TOTAL', numAdults: 0, numYouth: 0, priceAdults: 0, priceYouth: 0, netTotal: 320, marginPercent: 30, pvpTotal: 416, profit: 96 },
      { id: 'c7', name: 'Almoço Sintra', supplier: null, perPersonOrTotal: 'POR PESSOA', numAdults: 4, numYouth: 1, priceAdults: 35, priceYouth: 35, netTotal: 175, marginPercent: 30, pvpTotal: 227.5, profit: 52.5 },
    ],
  },
];

const mockOperationsDays: OperationsDay[] = [
  {
    day: 1, date: '27/Dec/2026', title: 'Arrival & Transfer',
    activities: [
      { id: 'o1', name: 'Transfer-in Aeroporto - Hotel', supplier: '2Feel Portugal', numPeople: 0, netTotal: 79, paidAmount: 0, startTime: '14:30', endTime: '15:30', reservationStatus: 'confirmed', paymentStatus: 'conta_mensal', invoiceStatus: 'pending' },
    ],
  },
  {
    day: 2, date: '28/Dec/2026', title: 'Lisbon Full Day',
    activities: [
      { id: 'o2', name: 'Lisbon FD Privado', supplier: '2Feel Portugal', numPeople: 0, netTotal: 296, paidAmount: 0, startTime: '', endTime: '', reservationStatus: 'pending', paymentStatus: 'conta_mensal', invoiceStatus: 'pending' },
      { id: 'o3', name: 'Tuk tuk (2h)', supplier: 'Tuk On Me', numPeople: 0, netTotal: 220, paidAmount: 0, startTime: '', endTime: '', reservationStatus: 'pending', paymentStatus: 'a_pagar_backoffice', invoiceStatus: 'pending' },
    ],
  },
  {
    day: 3, date: '29/Dec/2026', title: 'Sintra & Cascais',
    activities: [
      { id: 'o6', name: 'Sintra & Cascais FD', supplier: '2Feel Portugal', numPeople: 0, netTotal: 320, paidAmount: 0, startTime: '', endTime: '', reservationStatus: 'pending', paymentStatus: 'conta_mensal', invoiceStatus: 'pending' },
    ],
  },
];

// ─── Image Add Dialog Component ───
const ImageAddDialog = ({ onAdd, replace }: { onAdd: (img: ItineraryImage) => void; replace?: boolean }) => {
  const [imageSource, setImageSource] = useState<'unsplash' | 'url' | 'upload'>('url');
  const [urlInput, setUrlInput] = useState('');
  const [caption, setCaption] = useState('');
  const [unsplashQuery, setUnsplashQuery] = useState('');
  const [open, setOpen] = useState(false);

  // Unsplash mock results
  const unsplashResults = unsplashQuery ? [
    `https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=400&h=250&fit=crop&q=${unsplashQuery}`,
    `https://images.unsplash.com/photo-1513735492321-236cf8720a89?w=400&h=250&fit=crop&q=${unsplashQuery}`,
    `https://images.unsplash.com/photo-1497802176320-541c8e8de98d?w=400&h=250&fit=crop&q=${unsplashQuery}`,
    `https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=400&h=250&fit=crop&q=${unsplashQuery}`,
    `https://images.unsplash.com/photo-1574236170880-9f28b63b3edd?w=400&h=250&fit=crop&q=${unsplashQuery}`,
    `https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&h=250&fit=crop&q=${unsplashQuery}`,
  ] : [];

  const handleAdd = (url: string, src: 'unsplash' | 'url' | 'upload' = imageSource) => {
    onAdd({ id: `img-${Date.now()}`, url, source: src, caption: caption || undefined });
    setUrlInput('');
    setCaption('');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {replace ? (
          <button className="p-1.5 bg-white/80 rounded-full hover:bg-white">
            <Pencil className="h-3 w-3 text-foreground" />
          </button>
        ) : (
          <button className="flex items-center justify-center w-full h-full min-h-[6rem] rounded-lg border-2 border-dashed border-border hover:border-[hsl(var(--info))] hover:bg-muted/30 transition-colors text-muted-foreground hover:text-[hsl(var(--info))]">
            <Plus className="h-5 w-5 mr-1" />
            <span className="text-xs">Adicionar imagem</span>
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">Adicionar Imagem</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Source tabs */}
          <div className="flex gap-1 bg-muted rounded-lg p-0.5">
            {(['unsplash', 'url', 'upload'] as const).map(src => (
              <button key={src} onClick={() => setImageSource(src)}
                className={cn("flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  imageSource === src ? "bg-background shadow-sm" : "text-muted-foreground"
                )}>
                {src === 'unsplash' ? '🖼 Unsplash' : src === 'url' ? '🔗 URL / Drive' : '📁 Upload'}
              </button>
            ))}
          </div>

          {imageSource === 'unsplash' && (
            <div className="space-y-3">
              <Input placeholder="Pesquisar Unsplash... (ex: lisbon, douro)" value={unsplashQuery}
                onChange={e => setUnsplashQuery(e.target.value)} className="h-8 text-xs" />
              {unsplashResults.length > 0 && (
                <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                  {unsplashResults.map((url, i) => (
                    <button key={i} onClick={() => handleAdd(url, 'unsplash')}
                      className="rounded-md overflow-hidden border hover:ring-2 ring-[hsl(var(--info))] transition-all">
                      <img src={url} alt="" className="w-full h-16 object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {imageSource === 'url' && (
            <div className="space-y-2">
              <Input placeholder="URL da imagem ou Google Drive link" value={urlInput}
                onChange={e => setUrlInput(e.target.value)} className="h-8 text-xs" />
              <Input placeholder="Legenda (opcional)" value={caption}
                onChange={e => setCaption(e.target.value)} className="h-8 text-xs" />
              <Button size="sm" className="text-xs w-full" disabled={!urlInput}
                onClick={() => handleAdd(urlInput, 'url')}>
                Adicionar
              </Button>
            </div>
          )}

          {imageSource === 'upload' && (
            <div className="space-y-2">
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-[hsl(var(--info))] transition-colors">
                <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">Arrastar ou clicar para carregar</p>
                <p className="text-[10px] text-muted-foreground mt-1">JPG, PNG, WebP · Max 5MB</p>
              </div>
              <Input placeholder="Legenda (opcional)" value={caption}
                onChange={e => setCaption(e.target.value)} className="h-8 text-xs" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ─── Mini Rich Text Editor ───
const RichTextEditor = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <div className="border rounded-lg overflow-hidden">
    <div className="flex items-center gap-0.5 px-2 py-1 border-b bg-muted/30">
      {[
        { icon: Bold, title: 'Bold' },
        { icon: Italic, title: 'Italic' },
        { icon: Heading2, title: 'Heading' },
        { icon: List, title: 'Bullet list' },
        { icon: ListOrdered, title: 'Numbered list' },
      ].map(({ icon: Icon, title }) => (
        <button key={title} title={title} className="p-1.5 hover:bg-muted rounded transition-colors">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      ))}
    </div>
    <Textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      className="border-0 rounded-none text-xs min-h-[80px] focus-visible:ring-0 resize-none"
      placeholder="Descreva as atividades do dia..."
    />
  </div>
);

// ─── Main Page ───
const TripDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const trip = mockTrips.find((t) => t.id === id);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  // Itinerary state
  const [itinerary, setItinerary] = useState<ItineraryDay[]>(defaultItineraryDays);

  // Checklist state
  const [checklistItems, setChecklistItems] = useState<CheckItem[]>([
    { id: 1, label: 'Hotel reservations confirmed', done: true },
    { id: 2, label: 'Airport transfers booked', done: true },
    { id: 3, label: 'Restaurant reservations made', done: false },
    { id: 4, label: 'Activity tickets purchased', done: false },
    { id: 5, label: 'Travel insurance verified', done: true },
    { id: 6, label: 'Welcome pack prepared', done: false },
  ]);
  const [newCheckItem, setNewCheckItem] = useState('');

  // Files state
  const [files, setFiles] = useState<LinkedFile[]>([
    { id: 'f1', name: 'Itinerary_v2.pdf', type: 'PDF', date: '2026-02-24' },
    { id: 'f2', name: 'Hotel_Confirmation.pdf', type: 'PDF', date: '2026-02-22' },
    { id: 'f3', name: 'Client_Preferences.docx', type: 'DOC', date: '2026-02-20' },
  ]);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editFileName, setEditFileName] = useState('');

  // Notifications state
  const [notifications, setNotifications] = useState<Notification[]>([
    ...(trip?.hasBlocker ? [{ id: 'n1', type: 'blocker' as const, message: trip.blockerNote || '', dismissed: false }] : []),
    { id: 'n2', type: 'warning' as const, message: 'Pagamento do depósito pendente — vence em 3 dias', dismissed: false },
    { id: 'n3', type: 'info' as const, message: 'Guia confirmado para Dia 1 — aguarda briefing', dismissed: false },
  ]);

  // Payment state
  const totalValue = trip?.totalValue || 0;
  const [depositPaid, setDepositPaid] = useState(totalValue * 0.3);
  const balanceDue = totalValue - depositPaid;

  if (!trip) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Trip not found</p>
          <Link to="/trips" className="text-[hsl(var(--info))] text-sm hover:underline mt-2 inline-block">Back to trips</Link>
        </div>
      </AppLayout>
    );
  }

  const toggleItineraryDay = (day: number) => {
    setItinerary(prev => prev.map(d => d.day === day ? { ...d, expanded: !d.expanded } : d));
  };

  const updateDayDescription = (day: number, description: string) => {
    setItinerary(prev => prev.map(d => d.day === day ? { ...d, description } : d));
  };

  const updateDayTitle = (day: number, title: string) => {
    setItinerary(prev => prev.map(d => d.day === day ? { ...d, title } : d));
  };

  const replaceImageInDay = (day: number, slotIndex: number, img: ItineraryImage) => {
    setItinerary(prev => prev.map(d => {
      if (d.day !== day) return d;
      const newImages = [...d.images];
      newImages[slotIndex] = img;
      return { ...d, images: newImages };
    }));
  };

  const removeImageFromDay = (day: number, slotIndex: number) => {
    setItinerary(prev => prev.map(d => {
      if (d.day !== day) return d;
      const newImages = [...d.images];
      newImages[slotIndex] = { id: `empty-${slotIndex}`, url: '', source: 'url' };
      return { ...d, images: newImages };
    }));
  };

  const addItineraryDay = () => {
    const newDay = itinerary.length + 1;
    const emptyImages: ItineraryImage[] = [
      { id: `empty-0-${newDay}`, url: '', source: 'url' },
      { id: `empty-1-${newDay}`, url: '', source: 'url' },
      { id: `empty-2-${newDay}`, url: '', source: 'url' },
    ];
    setItinerary(prev => [...prev, { day: newDay, title: `Day ${newDay}`, description: '', images: emptyImages, expanded: true }]);
  };

  const toggleCheckItem = (id: number) => {
    setChecklistItems(prev => prev.map(i => i.id === id ? { ...i, done: !i.done } : i));
  };

  const addCheckItem = () => {
    if (!newCheckItem.trim()) return;
    setChecklistItems(prev => [...prev, { id: Date.now(), label: newCheckItem.trim(), done: false }]);
    setNewCheckItem('');
  };

  const removeCheckItem = (id: number) => {
    setChecklistItems(prev => prev.filter(i => i.id !== id));
  };

  const startRenameFile = (file: LinkedFile) => {
    setEditingFileId(file.id);
    setEditFileName(file.name);
  };

  const confirmRenameFile = () => {
    if (editingFileId && editFileName.trim()) {
      setFiles(prev => prev.map(f => f.id === editingFileId ? { ...f, name: editFileName.trim() } : f));
    }
    setEditingFileId(null);
  };

  const deleteFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const addFile = () => {
    setFiles(prev => [...prev, { id: `f-${Date.now()}`, name: `New_File_${prev.length + 1}.pdf`, type: 'PDF', date: new Date().toISOString().split('T')[0] }]);
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, dismissed: true } : n));
  };

  const activeNotifications = notifications.filter(n => !n.dismissed);
  const completedChecks = checklistItems.filter(c => c.done).length;

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <Link to="/trips" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
              <ArrowLeft className="h-3 w-3" /> Back to trips
            </Link>
            <h1 className="text-xl font-semibold">{trip.clientName}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {trip.destination} · {trip.pax} pax · {budgetLabels[trip.budgetLevel]}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge {...urgencyConfig[trip.urgency]} />
            <StatusBadge {...statusConfig[trip.status]} />
            <button onClick={() => setRightPanelOpen(!rightPanelOpen)}
              className="p-2 hover:bg-muted rounded-md transition-colors ml-2"
              title={rightPanelOpen ? 'Hide side panels' : 'Show side panels'}>
              {rightPanelOpen ? <PanelRightClose className="h-4 w-4 text-muted-foreground" /> : <PanelRight className="h-4 w-4 text-muted-foreground" />}
            </button>
          </div>
        </div>

        {/* ═══ Notifications / Blockers Bar ═══ */}
        {activeNotifications.length > 0 && (
          <div className="space-y-2">
            {activeNotifications.map(n => (
              <div key={n.id} className={cn(
                "rounded-lg p-3 flex items-start justify-between gap-2 border",
                n.type === 'blocker' && "bg-destructive/5 border-destructive/20",
                n.type === 'warning' && "bg-[hsl(var(--warning))]/5 border-[hsl(var(--warning))]/20",
                n.type === 'info' && "bg-[hsl(var(--info))]/5 border-[hsl(var(--info))]/20",
              )}>
                <div className="flex items-start gap-2">
                  {n.type === 'blocker' && <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />}
                  {n.type === 'warning' && <Bell className="h-4 w-4 text-[hsl(var(--warning))] shrink-0 mt-0.5" />}
                  {n.type === 'info' && <Bell className="h-4 w-4 text-[hsl(var(--info))] shrink-0 mt-0.5" />}
                  <div>
                    <p className={cn("text-xs font-semibold",
                      n.type === 'blocker' && "text-destructive",
                      n.type === 'warning' && "text-[hsl(var(--warning))]",
                      n.type === 'info' && "text-[hsl(var(--info))]",
                    )}>
                      {n.type === 'blocker' ? '⚠ Blocker' : n.type === 'warning' ? '⚠ Aviso' : 'ℹ Info'}
                    </p>
                    <p className="text-xs text-foreground mt-0.5">{n.message}</p>
                  </div>
                </div>
                <button onClick={() => dismissNotification(n.id)} className="p-0.5 hover:bg-muted rounded shrink-0">
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ═══ Payment Summary Bar ═══ */}
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Total da Viagem</p>
                  <p className="text-lg font-bold">€{totalValue.toLocaleString()}</p>
                </div>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Depósito Pago</p>
                <p className="text-sm font-semibold text-[hsl(var(--success))]">€{depositPaid.toLocaleString()}</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Saldo em Falta</p>
                <p className={cn("text-sm font-semibold", balanceDue > 0 ? "text-[hsl(var(--warning))]" : "text-[hsl(var(--success))]")}>
                  €{balanceDue.toLocaleString()}
                </p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Status Pagamento</p>
                <span className={cn("text-xs font-bold px-2 py-0.5 rounded",
                  balanceDue > 0 ? "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))]" : "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]"
                )}>
                  {balanceDue > 0 ? 'PARCIAL' : 'PAGO'}
                </span>
              </div>
            </div>
            <Button variant="outline" size="sm" className="text-xs gap-1">
              <CreditCard className="h-3 w-3" /> Registar Pagamento
            </Button>
          </div>
        </div>

        {/* ═══ Main Layout ═══ */}
        <div className="flex gap-6 transition-all duration-200">
          <div className={cn("space-y-6 min-w-0 transition-all duration-200", rightPanelOpen ? "flex-1" : "w-full")}>

            {/* Trip Info */}
            <div className="bg-card rounded-lg border p-4">
              <h2 className="text-sm font-semibold mb-3">Trip Details</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Dates</p>
                  <p className="font-medium">{trip.startDate} → {trip.endDate}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Sales Owner</p>
                  <p className="font-medium">{trip.salesOwner}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Value</p>
                  <p className="font-medium">€{trip.totalValue.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Trip ID</p>
                  <p className="font-medium">{trip.id}</p>
                </div>
              </div>
            </div>

            {/* ═══ Itinerary — Collapsible with Rich Editor & Images ═══ */}
            <div className="bg-card rounded-lg border">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="text-sm font-semibold">Itinerary</h2>
                <Button variant="outline" size="sm" className="text-xs gap-1" onClick={addItineraryDay}>
                  <Plus className="h-3 w-3" /> Adicionar Dia
                </Button>
              </div>

              <div className="divide-y divide-border">
                {itinerary.map(day => (
                  <div key={day.day}>
                    {/* Day header — clickable */}
                    <button
                      onClick={() => toggleItineraryDay(day.day)}
                      className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors text-left"
                    >
                      <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold shrink-0">
                        {day.day}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{day.title}</p>
                        {!day.expanded && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{day.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-muted-foreground">{day.images.filter(i => i.url).length}/3 imgs</span>
                        {day.expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </button>

                    {/* Expanded content */}
                    {day.expanded && (
                      <div className="px-4 pb-4 space-y-4">
                        {/* Title edit */}
                        <Input
                          className="h-8 text-xs font-medium"
                          value={day.title}
                          onChange={e => updateDayTitle(day.day, e.target.value)}
                        />

                        {/* Rich text editor */}
                        <RichTextEditor
                          value={day.description}
                          onChange={v => updateDayDescription(day.day, v)}
                        />

                        {/* 3 image slots per day */}
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase font-medium mb-2">3 Imagens do Dia</p>
                          <div className="grid grid-cols-3 gap-3">
                            {[0, 1, 2].map(slotIndex => {
                              const img = day.images[slotIndex];
                              const hasImage = img && img.url;

                              return hasImage ? (
                                <div key={slotIndex} className="relative group rounded-lg overflow-hidden border h-32">
                                  <img src={img.url} alt={img.caption || ''} className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <ImageAddDialog onAdd={(newImg) => replaceImageInDay(day.day, slotIndex, newImg)} replace />
                                    <button onClick={() => removeImageFromDay(day.day, slotIndex)}
                                      className="p-1.5 bg-destructive rounded-full text-white hover:bg-destructive/80">
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                  {img.caption && (
                                    <p className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-2 py-1 truncate">
                                      {img.caption}
                                    </p>
                                  )}
                                  <div className="absolute top-1 right-1">
                                    {img.source === 'unsplash' && <ImageIcon className="h-3 w-3 text-white/70" />}
                                    {img.source === 'url' && <LinkIcon className="h-3 w-3 text-white/70" />}
                                    {img.source === 'upload' && <Upload className="h-3 w-3 text-white/70" />}
                                  </div>
                                </div>
                              ) : (
                                <div key={slotIndex} className="h-32">
                                  <ImageAddDialog onAdd={(newImg) => replaceImageInDay(day.day, slotIndex, newImg)} />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Costing */}
            <CostingTable days={mockCostingDays} />

            {/* Operations */}
            <OperationsTable days={mockOperationsDays} />

            {/* Notes */}
            <div className="bg-card rounded-lg border p-4">
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Internal Notes
              </h2>
              <Textarea className="text-xs min-h-[60px]" defaultValue={trip.notes} />
            </div>
          </div>

          {/* ═══ Right Sidebar ═══ */}
          {rightPanelOpen && (
            <div className="w-[280px] shrink-0 space-y-4">

              {/* ═══ Operational Checklist ═══ */}
              <div className="bg-card rounded-lg border p-4">
                <h2 className="text-sm font-semibold mb-3">Operational Checklist</h2>
                <div className="space-y-1.5">
                  {checklistItems.map(item => (
                    <div key={item.id} className="flex items-center gap-2 group">
                      <button onClick={() => toggleCheckItem(item.id)} className="shrink-0">
                        {item.done
                          ? <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" />
                          : <Circle className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                        }
                      </button>
                      <span className={cn("text-xs flex-1", item.done && "line-through text-muted-foreground")}>
                        {item.label}
                      </span>
                      <button onClick={() => removeCheckItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-muted rounded">
                        <X className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
                {/* Add new item */}
                <div className="flex items-center gap-1 mt-3">
                  <Input className="h-7 text-[10px] flex-1" placeholder="Novo item..."
                    value={newCheckItem} onChange={e => setNewCheckItem(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCheckItem()} />
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={addCheckItem}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                {/* Progress */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                    <span>{completedChecks}/{checklistItems.length} concluídos</span>
                    <span>{checklistItems.length > 0 ? Math.round((completedChecks / checklistItems.length) * 100) : 0}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-[hsl(var(--success))] rounded-full transition-all"
                      style={{ width: `${checklistItems.length > 0 ? (completedChecks / checklistItems.length) * 100 : 0}%` }} />
                  </div>
                </div>
              </div>

              {/* ═══ Linked Files ═══ */}
              <div className="bg-card rounded-lg border p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Linked Files
                  </h2>
                  <Button variant="ghost" size="sm" className="h-6 px-2" onClick={addFile}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {files.map(file => (
                    <div key={file.id} className="group flex items-center justify-between p-2 rounded-md border hover:bg-muted/30 transition-colors">
                      {editingFileId === file.id ? (
                        <Input className="h-6 text-[10px] flex-1 mr-1" value={editFileName}
                          onChange={e => setEditFileName(e.target.value)}
                          onBlur={confirmRenameFile}
                          onKeyDown={e => e.key === 'Enter' && confirmRenameFile()}
                          autoFocus />
                      ) : (
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-[10px] truncate">{file.name}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-0.5 shrink-0">
                        {editingFileId !== file.id && (
                          <>
                            <button onClick={() => startRenameFile(file)}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-all">
                              <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
                            </button>
                            <button onClick={() => deleteFile(file.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-all">
                              <Trash2 className="h-2.5 w-2.5 text-destructive" />
                            </button>
                            <button className="p-1 hover:bg-muted rounded transition-all">
                              <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
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

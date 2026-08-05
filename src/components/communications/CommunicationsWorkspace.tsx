/**
 * AI-first email workspace for a lead / trip.
 *
 * Purpose → AI generation → block-by-block editing (rich text) → live preview
 * of exactly what the client receives → send through the Gmail reservas
 * integration → logged in the timeline.
 */
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles, Loader2, Send, Wand2, Paperclip, LinkIcon, X, Eye, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RichHtmlEditor } from './RichHtmlEditor';
import HistoryTimeline, { type EmailLogRow } from './HistoryTimeline';
import { getProposalAppUrl, getProposalShareUrl } from '@/lib/proposalShare';
import {
  buildEmailHtml, buildEmailPlain, textToHtml,
  type EmailBlocks, type ProgramLite,
} from '@/lib/emailHtml';

const PURPOSES = [
  { value: 'auto', label: 'Auto (recomendado)' },
  { value: 'proposal', label: 'Proposta (1ª apresentação)' },
  { value: 'proposal_update', label: 'Proposta atualizada / nova versão' },
  { value: 'welcome', label: 'Boas-vindas' },
  { value: 'qualification', label: 'Qualificação (falta informação)' },
  { value: 'followup', label: 'Follow-up' },
  { value: 'booking', label: 'Booking / Operações' },
  { value: 'custom', label: 'Custom' },
];

const LANGUAGES = ['EN', 'PT', 'ES', 'FR', 'DE', 'IT', 'NL'];

const REWRITES = [
  { key: 'regenerate', label: 'Regenerar' },
  { key: 'shorten', label: 'Encurtar' },
  { key: 'premium', label: 'Mais premium' },
  { key: 'friendly', label: 'Mais próximo' },
  { key: 'translate', label: 'Traduzir' },
];

interface Props {
  scope: 'lead' | 'trip';
  entityId: string;
  recipientEmail?: string;
  clientName?: string;
  salesOwner?: string;
  language?: string;
}

const emptyBlocks: EmailBlocks = {
  subject: '',
  greeting: '',
  opening: '',
  main: '',
  closing: '',
  next_steps: [],
  signature: '',
  includeProgram: true,
  includePrice: true,
  links: [],
  attachments: [],
};

export function CommunicationsWorkspace({
  scope, entityId, recipientEmail, clientName, salesOwner, language,
}: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const filterField = scope === 'lead' ? 'lead_id' : 'trip_id';

  const [to, setTo] = useState(recipientEmail || '');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [lang, setLang] = useState((language || 'EN').toUpperCase());
  const [purpose, setPurpose] = useState('auto');
  const [notes, setNotes] = useState('');
  const [blocks, setBlocks] = useState<EmailBlocks>(emptyBlocks);
  const [program, setProgram] = useState<ProgramLite | null>(null);
  const [resolved, setResolved] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [rewriting, setRewriting] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [files, setFiles] = useState<{ filename: string; mimeType: string; contentBase64: string }[]>([]);
  const [showPreview, setShowPreview] = useState(true);

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['comms_log', scope, entityId],
    queryFn: async () => {
      if (!entityId) return [];
      const { data, error } = await supabase
        .from('booking_emails_log')
        .select('id, subject, body, supplier_email, sent_at, email_category')
        .eq(filterField, entityId)
        .order('sent_at', { ascending: false });
      if (error) throw error;
      return (data || []) as EmailLogRow[];
    },
    enabled: !!entityId,
  });

  const hasContent = !!(blocks.subject || blocks.opening || blocks.main);

  const previewHtml = useMemo(
    () => buildEmailHtml(blocks, blocks.includeProgram ? program : null),
    [blocks, program],
  );

  const invokeAi = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('generate-email-blocks', {
      body: { leadId: scope === 'lead' ? entityId : entityId, language: lang, senderName: salesOwner || 'Your Tours Portugal', customNotes: notes, ...payload },
    });
    if (error) {
      let detail = error.message;
      try { detail = (await (error as any).context?.text?.()) || detail; } catch { /* ignore */ }
      throw new Error(detail);
    }
    if ((data as any)?.error) throw new Error((data as any).error);
    return data as any;
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const data = await invokeAi({ purpose, mode: 'full' });
      const b = data.blocks || {};
      const prog: ProgramLite | null = data.program
        ? {
            ...data.program,
            weblink: data.program.publicToken ? getProposalShareUrl(data.program.publicToken) : undefined,
          }
        : null;
      setProgram(prog);
      setResolved(data.purpose_resolved);
      setMissing(data.missing_info || []);
      setBlocks({
        subject: b.subject || '',
        greeting: textToHtml(b.greeting || ''),
        opening: textToHtml(b.opening || ''),
        main: textToHtml(b.main || ''),
        closing: textToHtml(b.closing || ''),
        next_steps: Array.isArray(b.next_steps) ? b.next_steps : [],
        signature: textToHtml(b.signature || ''),
        includeProgram: !!data.include_program && !!prog,
        includePrice: !!data.include_program,
        links: [
          ...(prog?.publicToken
            ? [{ label: 'Itinerário digital', url: getProposalAppUrl(prog.publicToken as unknown as string), enabled: true }]
            : []),
          ...(prog?.bookNowUrl ? [{ label: 'Pagamento seguro', url: prog.bookNowUrl, enabled: false }] : []),
          { label: 'yourtours.pt', url: 'https://www.yourtours.pt', enabled: true },
        ],
        attachments: [],
      });
      toast({ title: 'Email gerado', description: `Tipo: ${data.purpose_resolved}` });
    } catch (e: any) {
      toast({ title: 'Falha na geração', description: e.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const rewrite = async (blockKey: keyof EmailBlocks, action: string) => {
    setRewriting(`${blockKey}:${action}`);
    try {
      const data = await invokeAi({
        purpose: resolved || purpose,
        mode: 'block',
        blockKey,
        action,
        currentText: String(blocks[blockKey] || ''),
      });
      setBlocks(p => ({ ...p, [blockKey]: textToHtml(data.text || '') }));
    } catch (e: any) {
      toast({ title: 'Falha ao reescrever', description: e.message, variant: 'destructive' });
    } finally {
      setRewriting(null);
    }
  };

  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    for (const f of Array.from(list)) {
      const b64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(',')[1] || '');
        r.onerror = rej;
        r.readAsDataURL(f);
      });
      setFiles(p => [...p, { filename: f.name, mimeType: f.type || 'application/octet-stream', contentBase64: b64 }]);
    }
  };

  const warnings = useMemo(() => {
    const w: string[] = [];
    if (!to.trim()) w.push('Destinatário em falta.');
    if (!blocks.subject.trim()) w.push('Assunto em falta.');
    if (!blocks.signature) w.push('Assinatura em falta.');
    if (clientName && blocks.greeting && !blocks.greeting.toLowerCase().includes(clientName.split(' ')[0].toLowerCase()))
      w.push('A saudação não menciona o nome do cliente.');
    if (blocks.includeProgram && !program) w.push('Bloco de programa ativo mas sem proposta associada.');
    if (!blocks.next_steps.some(s => s.action?.trim())) w.push('Sem "Next Steps" definidos.');
    return w;
  }, [to, blocks, clientName, program]);

  const send = async () => {
    if (!to.trim() || !blocks.subject.trim()) {
      toast({ title: 'Faltam dados', description: 'Destinatário e assunto são obrigatórios.', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const html = previewHtml;
      const { data, error } = await supabase.functions.invoke('send-booking-email', {
        body: {
          to: to.trim(),
          cc: cc.trim() || undefined,
          bcc: bcc.trim() || undefined,
          subject: blocks.subject,
          html,
          body: buildEmailPlain(blocks, blocks.includeProgram ? program : null),
          attachments: files,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const { data: auth } = await supabase.auth.getUser();
      await supabase.from('booking_emails_log').insert({
        [filterField]: entityId,
        supplier_email: to.trim(),
        subject: blocks.subject,
        body: html,
        email_category: resolved || purpose,
        sent_by: auth?.user?.id ?? null,
      } as never);

      qc.invalidateQueries({ queryKey: ['comms_log', scope, entityId] });
      toast({ title: 'Email enviado', description: 'Já aparece em Enviados no Gmail.' });
      setFiles([]);
    } catch (e: any) {
      let detail = e.message;
      try { detail = (await e?.context?.text?.()) || detail; } catch { /* ignore */ }
      toast({ title: 'Falha no envio', description: detail, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const BlockCard = ({
    title, blockKey, minHeight = 90,
  }: { title: string; blockKey: 'greeting' | 'opening' | 'main' | 'closing' | 'signature'; minHeight?: number }) => (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-1 border-b px-3 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {REWRITES.map(r => (
            <Button
              key={r.key}
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[10px]"
              disabled={!!rewriting}
              onClick={() => rewrite(blockKey, r.key)}
            >
              {rewriting === `${blockKey}:${r.key}` ? <Loader2 className="h-3 w-3 animate-spin" /> : r.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="p-2">
        <RichHtmlEditor
          value={String(blocks[blockKey] || '')}
          onChange={v => setBlocks(p => ({ ...p, [blockKey]: v }))}
          minHeight={minHeight}
          placeholder="Escreva ou gere com AI…"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header / setup */}
      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-2.5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--info))]" /> AI Email Composer
          </h2>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Emails no estilo da casa (capa clicável, programa dia-a-dia, preço, Book Now) enviados via reservas@yourtours.pt.
          </p>
        </div>

        <div className="grid gap-3 p-3 md:grid-cols-4">
          <div className="md:col-span-2">
            <Label className="text-[10px]">Para</Label>
            <Input value={to} onChange={e => setTo(e.target.value)} className="h-8 text-xs" placeholder="cliente@email.com" />
          </div>
          <div>
            <Label className="text-[10px]">CC</Label>
            <Input value={cc} onChange={e => setCc(e.target.value)} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[10px]">BCC</Label>
            <Input value={bcc} onChange={e => setBcc(e.target.value)} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[10px]">Idioma</Label>
            <Select value={lang} onValueChange={setLang}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{LANGUAGES.map(l => <SelectItem key={l} value={l} className="text-xs">{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-[10px]">Purpose</Label>
            <Select value={purpose} onValueChange={setPurpose}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{PURPOSES.map(p => <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={generate} disabled={generating} className="h-8 w-full gap-1.5 text-xs">
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              Gerar Email
            </Button>
          </div>
          <div className="md:col-span-4">
            <Label className="text-[10px]">Notas para a AI (opcional)</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="text-xs"
              placeholder="Ex.: mencionar que adicionámos o picnic privado e o cruzeiro em barco rabelo." />
          </div>
        </div>

        {(resolved || missing.length > 0) && (
          <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2">
            {resolved && <Badge variant="secondary" className="text-[10px]">Tipo: {resolved}</Badge>}
            {program && <Badge variant="secondary" className="text-[10px]">Proposta: {program.title}</Badge>}
            {program?.bookNowUrl && <Badge variant="secondary" className="text-[10px]">Book Now ativo</Badge>}
            {missing.length > 0 && (
              <span className="text-[10px] text-[hsl(var(--warning))]">Em falta no lead: {missing.join(', ')}</span>
            )}
          </div>
        )}
      </div>

      {hasContent && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Blocks */}
          <div className="space-y-3">
            <div className="rounded-lg border bg-card p-2">
              <Label className="px-1 text-[10px]">Assunto</Label>
              <Input value={blocks.subject} onChange={e => setBlocks(p => ({ ...p, subject: e.target.value }))} className="h-8 text-xs" />
            </div>

            <BlockCard title="Saudação" blockKey="greeting" minHeight={44} />
            <BlockCard title="Abertura" blockKey="opening" />
            <BlockCard title="Conteúdo principal" blockKey="main" minHeight={130} />

            {/* Program toggles */}
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Bloco do programa</p>
                  <p className="text-[10px] text-muted-foreground">
                    {program ? 'Capa, dias e horários vindos do Travel Planner / proposta.' : 'Sem proposta associada a este lead.'}
                  </p>
                </div>
                <Switch checked={blocks.includeProgram} disabled={!program}
                  onCheckedChange={v => setBlocks(p => ({ ...p, includeProgram: v }))} />
              </div>
              {blocks.includeProgram && (
                <div className="mt-2 flex items-center justify-between border-t pt-2">
                  <span className="text-[11px]">Incluir Total Price {program?.totalEur ? `(${program.totalEur} EUR)` : ''}</span>
                  <Switch checked={blocks.includePrice} onCheckedChange={v => setBlocks(p => ({ ...p, includePrice: v }))} />
                </div>
              )}
            </div>

            <BlockCard title="Fecho" blockKey="closing" minHeight={70} />

            {/* Next steps */}
            <div className="rounded-lg border bg-card">
              <div className="flex items-center border-b px-3 py-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Your Next Steps</span>
                <Button variant="ghost" size="sm" className="ml-auto h-6 px-1.5 text-[10px]"
                  onClick={() => setBlocks(p => ({ ...p, next_steps: [...p.next_steps, { action: '', responsible: '', timeframe: '' }] }))}>
                  + Passo
                </Button>
              </div>
              <div className="space-y-2 p-2">
                {blocks.next_steps.length === 0 && <p className="px-1 text-[10px] text-muted-foreground">Sem passos definidos.</p>}
                {blocks.next_steps.map((s, i) => (
                  <div key={i} className="grid grid-cols-12 items-center gap-1">
                    <Input value={s.action} placeholder="Ação" className="col-span-6 h-7 text-xs"
                      onChange={e => setBlocks(p => ({ ...p, next_steps: p.next_steps.map((x, j) => j === i ? { ...x, action: e.target.value } : x) }))} />
                    <Input value={s.responsible || ''} placeholder="Responsável" className="col-span-3 h-7 text-xs"
                      onChange={e => setBlocks(p => ({ ...p, next_steps: p.next_steps.map((x, j) => j === i ? { ...x, responsible: e.target.value } : x) }))} />
                    <Input value={s.timeframe || ''} placeholder="Prazo" className="col-span-2 h-7 text-xs"
                      onChange={e => setBlocks(p => ({ ...p, next_steps: p.next_steps.map((x, j) => j === i ? { ...x, timeframe: e.target.value } : x) }))} />
                    <Button variant="ghost" size="sm" className="col-span-1 h-7 w-7 p-0"
                      onClick={() => setBlocks(p => ({ ...p, next_steps: p.next_steps.filter((_, j) => j !== i) }))}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Links */}
            <div className="rounded-lg border bg-card">
              <div className="flex items-center gap-1.5 border-b px-3 py-1.5">
                <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Links úteis</span>
              </div>
              <div className="space-y-1.5 p-2">
                {blocks.links.map((l, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Switch checked={l.enabled}
                      onCheckedChange={v => setBlocks(p => ({ ...p, links: p.links.map((x, j) => j === i ? { ...x, enabled: v } : x) }))} />
                    <Input value={l.label} className="h-7 w-32 text-xs"
                      onChange={e => setBlocks(p => ({ ...p, links: p.links.map((x, j) => j === i ? { ...x, label: e.target.value } : x) }))} />
                    <Input value={l.url} className="h-7 flex-1 text-xs"
                      onChange={e => setBlocks(p => ({ ...p, links: p.links.map((x, j) => j === i ? { ...x, url: e.target.value } : x) }))} />
                  </div>
                ))}
                <Button variant="ghost" size="sm" className="h-6 text-[10px]"
                  onClick={() => setBlocks(p => ({ ...p, links: [...p.links, { label: '', url: '', enabled: true }] }))}>
                  + Link
                </Button>
              </div>
            </div>

            {/* Attachments */}
            <div className="rounded-lg border bg-card">
              <div className="flex items-center gap-1.5 border-b px-3 py-1.5">
                <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Anexos</span>
                <label className="ml-auto cursor-pointer text-[10px] text-[hsl(var(--info))]">
                  + Ficheiro
                  <input type="file" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
                </label>
              </div>
              <div className="space-y-1 p-2">
                {files.length === 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    Sem anexos. O itinerário vai como link (capa clicável) — recomendado para entregabilidade.
                  </p>
                )}
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="truncate">{f.filename}</span>
                    <Button variant="ghost" size="sm" className="ml-auto h-6 w-6 p-0" onClick={() => setFiles(p => p.filter((_, j) => j !== i))}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <BlockCard title="Assinatura" blockKey="signature" minHeight={70} />
          </div>

          {/* Preview + send */}
          <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
            <div className="rounded-lg border bg-card">
              <div className="flex items-center gap-2 border-b px-3 py-1.5">
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Pré-visualização</span>
                <Button variant="ghost" size="sm" className="ml-auto h-6 text-[10px]" onClick={() => setShowPreview(v => !v)}>
                  {showPreview ? 'Ocultar' : 'Mostrar'}
                </Button>
              </div>
              {showPreview && (
                <div className="max-h-[70vh] overflow-auto bg-white p-4">
                  <div className="text-xs text-[#64748b]">Assunto: <strong>{blocks.subject}</strong></div>
                  <div className="mt-3 border-t pt-3" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                </div>
              )}
            </div>

            <div className="rounded-lg border bg-card p-3">
              {warnings.length === 0 ? (
                <p className="flex items-center gap-1.5 text-[11px] text-[hsl(var(--success))]">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Pronto a enviar.
                </p>
              ) : (
                <ul className="space-y-1">
                  {warnings.map(w => (
                    <li key={w} className="flex items-start gap-1.5 text-[11px] text-[hsl(var(--warning))]">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {w}
                    </li>
                  ))}
                </ul>
              )}
              <Button onClick={send} disabled={sending} className="mt-3 h-9 w-full gap-1.5 text-xs">
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Enviar ao cliente
              </Button>
            </div>
          </div>
        </div>
      )}

      <HistoryTimeline rows={history} isLoading={isLoading} />
    </div>
  );
}

export default CommunicationsWorkspace;

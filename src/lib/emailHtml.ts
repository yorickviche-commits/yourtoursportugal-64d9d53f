/**
 * "Casa YT" email HTML builder.
 *
 * Builds the exact house style used by Your Tours Portugal for client emails:
 * greeting → contextual opening → dashed divider → linked program title with
 * the YT code → clickable 21:9 cover → day-by-day itinerary with times →
 * Total Price → Important Notes → Book Now → dashed divider → Your Next Steps
 * → signature.
 *
 * Everything is inline-styled (Gmail strips <style>) and the base font is
 * always Trebuchet MS.
 */

export const EMAIL_FONT = "'Trebuchet MS', 'Lucida Grande', Tahoma, sans-serif";
const YT_BLUE = '#0a2540';
const MUTED = '#64748b';

export interface EmailNextStep {
  action: string;
  responsible?: string;
  timeframe?: string;
}

export interface EmailLink {
  label: string;
  url: string;
  enabled: boolean;
}

export interface EmailAttachmentOption {
  key: string;
  label: string;
  kind: 'proposal_pdf' | 'file';
  url?: string;
  enabled: boolean;
}

export interface EmailBlocks {
  subject: string;
  /** HTML fragments (rich text from the editor). */
  greeting: string;
  opening: string;
  main: string;
  closing: string;
  next_steps: EmailNextStep[];
  signature: string;
  includeProgram: boolean;
  includePrice: boolean;
  links: EmailLink[];
  attachments: EmailAttachmentOption[];
}

export interface ProgramDayLite {
  day_number?: number;
  title?: string;
  subtitle?: string;
  date_label?: string;
  date?: string;
  items?: string[];
  highlights?: string[];
}

export interface ProgramLite {
  title?: string;
  clientName?: string;
  ytCode?: string;
  dateLabel?: string;
  weblink?: string;
  heroImageUrl?: string | null;
  brandLogoUrl?: string | null;
  totalEur?: number | null;
  currency?: string;
  importantNotes?: string | null;
  bookNowUrl?: string | null;
  days?: ProgramDayLite[];
}

/* ─── helpers ─────────────────────────────────────────────────────────── */

export const escapeHtmlText = (s: string) =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Converts plain/markdown-ish AI text into simple HTML paragraphs. */
export function textToHtml(text: string): string {
  if (!text) return '';
  if (/<(p|div|ul|ol|br|strong|em|span|h\d)[\s>/]/i.test(text)) return text;
  return escapeHtmlText(text)
    .replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>')
    .split(/\n{2,}/)
    .map(p => `<p style="margin:0 0 12px">${p.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Strips tags to build the plain-text alternative. */
export function htmlToPlain(html: string): string {
  return (html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h\d|tr)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const dayItems = (d: ProgramDayLite): string[] => {
  if (Array.isArray(d.items) && d.items.length) return d.items.map(String);
  if (Array.isArray(d.highlights) && d.highlights.length) return d.highlights.map(String);
  return [];
};

/** Splits "Pick-up at your accommodation 10:00" into text + time. */
function splitTime(item: string): { text: string; time: string } {
  const m = item.match(/(?:^|[\s(—-])((?:[01]?\d|2[0-3])[:h][0-5]\d)\s*[)]?\s*$/);
  if (m) return { text: item.slice(0, m.index).replace(/[\s—-]+$/, '').trim(), time: m[1].replace('h', ':') };
  const lead = item.match(/^((?:[01]?\d|2[0-3])[:h][0-5]\d)\s*[—-]?\s*(.+)$/);
  if (lead) return { text: lead[2].trim(), time: lead[1].replace('h', ':') };
  return { text: item, time: '' };
}

const divider = `<div style="border-top:1px dashed #9db6d1;margin:22px 0"></div>`;

const money = (v: number, currency = 'EUR') =>
  `${v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

/* ─── program block ───────────────────────────────────────────────────── */

export function buildProgramHtml(p: ProgramLite, opts: { includePrice: boolean }): string {
  const parts: string[] = [];
  const titleLine = [p.title, p.clientName].filter(Boolean).join(' ');
  const refLine = [p.dateLabel, p.ytCode].filter(Boolean).join(' - ');

  parts.push(divider);

  if (titleLine || refLine) {
    const inner = `
      <span style="font-size:17px;font-weight:bold;color:#1155cc;text-decoration:underline">${escapeHtmlText(titleLine)}</span>
      ${refLine ? `<br><span style="font-size:16px;font-weight:bold;color:#1155cc;text-decoration:underline">${escapeHtmlText(refLine)}</span>` : ''}`;
    parts.push(
      `<p style="margin:0 0 4px">${
        p.weblink ? `<a href="${p.weblink}" style="text-decoration:none">${inner}</a>` : inner
      }${p.weblink ? ` <span style="font-size:13px;font-style:italic;color:${MUTED}">(click on the weblink to access digital itinerary)</span>` : ''}</p>`,
    );
  }

  if (p.heroImageUrl) {
    const img = `<img src="${p.heroImageUrl}" alt="${escapeHtmlText(p.title || 'Itinerary')}" width="640" style="display:block;width:100%;max-width:640px;border-radius:6px;border:0" />`;
    parts.push(`<p style="margin:8px 0 18px">${p.weblink ? `<a href="${p.weblink}">${img}</a>` : img}</p>`);
  }

  (p.days || []).forEach((d, i) => {
    const items = dayItems(d);
    parts.push(
      `<p style="margin:14px 0 2px;font-size:14px;font-weight:bold;color:${YT_BLUE}">Day ${d.day_number ?? i + 1} — ${escapeHtmlText(d.title || '')}</p>`,
    );
    const dl = d.date_label || d.date;
    if (dl) parts.push(`<p style="margin:0;font-size:12px;color:${MUTED}">${escapeHtmlText(String(dl))}</p>`);
    if (d.subtitle) parts.push(`<p style="margin:2px 0 0;font-size:12px;font-style:italic;color:${MUTED}">${escapeHtmlText(d.subtitle)}</p>`);
    if (items.length) {
      parts.push(`<p style="margin:8px 0 4px;font-size:11px;letter-spacing:.06em;color:${MUTED}">ITINERARY &amp; INCLUDED:</p>`);
      const rows = items.map(raw => {
        const { text, time } = splitTime(raw);
        return `<tr>
          <td style="padding:2px 8px 2px 0;font-size:13px;color:#334155;vertical-align:top">• ${escapeHtmlText(text)}</td>
          <td style="padding:2px 0;font-size:12px;color:${MUTED};text-align:right;white-space:nowrap;vertical-align:top">${escapeHtmlText(time)}</td>
        </tr>`;
      }).join('');
      parts.push(`<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:collapse">${rows}</table>`);
    }
  });

  if (opts.includePrice && p.totalEur && p.totalEur > 0) {
    parts.push(
      `<p style="margin:20px 0 6px;font-size:18px;font-weight:bold;color:${YT_BLUE}">Total Price (All-Inclusive): ${money(Number(p.totalEur), p.currency || 'EUR')}</p>`,
    );
  }

  if (p.importantNotes && p.importantNotes.trim()) {
    parts.push(`<p style="margin:16px 0 6px;font-weight:bold;text-decoration:underline;color:${YT_BLUE}">Important Notes:</p>`);
    parts.push(
      p.importantNotes
        .split('\n')
        .filter(l => l.trim())
        .map(l => `<p style="margin:0 0 4px;font-size:13px;color:#334155">• ${escapeHtmlText(l.replace(/^[•\-\s]+/, ''))}</p>`)
        .join(''),
    );
  }

  if (p.bookNowUrl) {
    parts.push(
      `<p style="margin:22px 0;text-align:center"><a href="${p.bookNowUrl}" style="display:inline-block;background:${YT_BLUE};color:#ffffff;padding:14px 30px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">BOOK NOW</a><br><span style="font-size:11px;color:${MUTED}">Book with deposit — 100% refundable if plans change</span></p>`,
    );
  }

  parts.push(divider);
  return parts.join('\n');
}

/* ─── full email ──────────────────────────────────────────────────────── */

export function buildEmailHtml(blocks: EmailBlocks, program?: ProgramLite | null): string {
  const body: string[] = [];

  if (program?.brandLogoUrl) {
    body.push(`<p style="margin:0 0 16px"><img src="${program.brandLogoUrl}" alt="Logo" height="52" style="height:52px;border:0" /></p>`);
  }
  if (blocks.greeting) body.push(blocks.greeting);
  if (blocks.opening) body.push(blocks.opening);
  if (blocks.main) body.push(blocks.main);

  if (blocks.includeProgram && program) {
    body.push(buildProgramHtml(program, { includePrice: blocks.includePrice }));
  }

  if (blocks.closing) body.push(blocks.closing);

  const steps = (blocks.next_steps || []).filter(s => s.action?.trim());
  if (steps.length) {
    body.push(`<p style="margin:20px 0 8px;font-weight:bold;color:${YT_BLUE}">Your Next Steps</p>`);
    body.push(
      `<ol style="margin:0 0 12px;padding-left:20px">${steps
        .map(s => {
          const meta = [s.responsible, s.timeframe].filter(Boolean).join(' · ');
          return `<li style="margin:0 0 6px;font-size:13px;color:#334155">${escapeHtmlText(s.action)}${
            meta ? ` <span style="color:${MUTED};font-size:12px">(${escapeHtmlText(meta)})</span>` : ''
          }</li>`;
        })
        .join('')}</ol>`,
    );
  }

  const enabledLinks = (blocks.links || []).filter(l => l.enabled && l.url);
  if (enabledLinks.length) {
    body.push(
      `<p style="margin:14px 0 0;font-size:13px">${enabledLinks
        .map(l => `<a href="${l.url}" style="color:#1155cc">${escapeHtmlText(l.label)}</a>`)
        .join(' &nbsp;·&nbsp; ')}</p>`,
    );
  }

  if (blocks.signature) body.push(`<div style="margin-top:22px">${blocks.signature}</div>`);

  return `<div style="font-family:${EMAIL_FONT};font-size:14px;line-height:1.6;color:#1f2937;max-width:680px">
${body.join('\n')}
</div>`;
}

export function buildEmailPlain(blocks: EmailBlocks, program?: ProgramLite | null): string {
  return htmlToPlain(buildEmailHtml(blocks, program));
}

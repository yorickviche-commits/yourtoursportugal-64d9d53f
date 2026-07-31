import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML coming from Magpie (summary, description, additional_info,
 * terms_and_conditions). Never render Magpie HTML without passing it through here.
 */
export function sanitizeMagpieHtml(html?: string | null): string {
  if (!html) return '';
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'div', 'span', 'strong', 'b', 'em', 'i', 'u',
      'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'a', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'blockquote', 'hr',
    ],
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  });
}

/** Renders sanitized Magpie HTML. */
export function MagpieHtml({ html, className }: { html?: string | null; className?: string }) {
  const clean = sanitizeMagpieHtml(html);
  if (!clean) return null;
  return (
    <div
      className={className}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

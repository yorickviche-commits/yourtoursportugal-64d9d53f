import type { DeepLink } from '@/types/ops';

// Placeholder bases — replace with real endpoints when available.
const NETHUNT_BASE = 'https://nethunt.com/record/';
const GMAIL_SEARCH = 'https://mail.google.com/mail/u/0/#search/';
const CALENDAR_BASE = 'https://calendar.google.com/calendar/u/0/r/day/';

export const nethuntLink = (recordId: string) => `${NETHUNT_BASE}${recordId}`;
export const gmailLink = (query: string) => `${GMAIL_SEARCH}${encodeURIComponent(query)}`;
export const calendarLink = (isoDate: string) => `${CALENDAR_BASE}${isoDate.replace(/-/g, '/')}`;
export const fseLink = (bookingId: string) => `/fse?booking=${bookingId}`;

export function bookingLinks(bookingId: string, clientName: string, isoDate: string): DeepLink[] {
  return [
    { type: 'nethunt', label: 'CRM', url: nethuntLink(bookingId) },
    { type: 'gmail', label: 'Email', url: gmailLink(clientName) },
    { type: 'calendar', label: 'Calendar', url: calendarLink(isoDate) },
    { type: 'fse', label: 'FSE', url: fseLink(bookingId) },
  ];
}

/** Open a deep link in a new tab. */
export function openDeepLink(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

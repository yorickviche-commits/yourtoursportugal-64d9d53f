import { stripBoldMarkers } from './richText';

interface IncludedDaySource {
  day_number?: number;
  title?: string;
  bullets?: (string | { text: string })[];
  items?: string[];
  highlights?: string[];
}

/** Always derive inclusions from current itinerary rows, never a saved override. */
export function getIncludedDays(days: readonly IncludedDaySource[]) {
  return days.map((day, index) => ({
    day_number: day.day_number ?? index + 1,
    title: day.title || '',
    items: (day.bullets ?? day.items ?? day.highlights ?? []).map(item =>
      typeof item === 'string' ? item : item.text,
    ),
  }));
}

export function buildIncludedText(days: readonly IncludedDaySource[], dayLabel: string): string {
  return getIncludedDays(days)
    .map(day => `**${dayLabel} ${day.day_number} — ${stripBoldMarkers(day.title)}**\n${day.items.map(item => `• ${item}`).join('\n')}`)
    .join('\n\n');
}
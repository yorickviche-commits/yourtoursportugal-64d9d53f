import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formata "Segunda, 29 de outubro" a partir de uma data YYYY-MM-DD + offset de dias (dia 1 = startDate). */
export function formatDayLabelPT(startDate?: string | null, dayNumber = 1): string | null {
  if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return null;
  const [y, m, d] = startDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + (Math.max(1, dayNumber) - 1));
  const label = new Intl.DateTimeFormat('pt-PT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(date);
  const [weekday, ...rest] = label.split(', ');
  if (rest.length === 0) return label.charAt(0).toUpperCase() + label.slice(1);
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${rest.join(', ')}`;
}

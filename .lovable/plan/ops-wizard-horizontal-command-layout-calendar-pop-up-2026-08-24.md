# Ops Wizard — Horizontal Command Layout + Calendar Pop-up

## 1. Horizontal "TODAY" layout

Replace the current 3-vertical-column body with a wide horizontal board that uses the full screen width:

- All panels (Priority Actions, Pipeline / Stages, Booking Detail, Activity) become horizontally aligned **collapsible cards** in one row, each scrollable inside itself.
- A master control bar on top: **EXPAND ALL / COLLAPSE ALL** plus a chevron on every card header for individual expand/collapse (collapsed = thin vertical rail with title + count badge, so the space goes to what is open).
- Horizontal scroll for the board when many cards are open; vertical scroll inside each card. No content cut off, no wasted whitespace.
- Card widths adapt: open cards share the remaining space equally; collapsed ones take ~48px.

## 2. Visibility / typography pass

- Kill the low-contrast grey-on-white: minimum contrast body text, labels in bold uppercase with tracking, values in semibold/bold.
- Stronger separators (1px solid borders + subtle blue tint on card headers instead of faint grey).
- Status chips get filled backgrounds (red / amber / green) with bold text instead of pale outlines.
- KPI row numbers larger and bold, labels bold small-caps.

## 3. Calendar event pop-up

- Clicking a departure in the calendar opens a compact popover/dialog with: booking ID, client, product, departure date, pax, language, stage, readiness %, and the missing/alert chips.
- Two buttons: **Abrir Dados Gerais** (opens the Lovable lead file in a new tab, `/leads/:id` general data tab) and **Ver no Pipeline** (selects the booking in the pipeline card).
- Calendar keeps its own full-width view mode.

## 4. Alert states redefined (4 pillars)

Rework the pillar model so each is a clear state/alert per booking:

1. **PAYMENTS** — client payment/deposit received or missing (missing = alert).
2. **FSE & BOOKINGS** — all suppliers/FSE reservations complete.
3. **BRIEFING FSE** — final technical briefing sent to suppliers/guide/transport.
4. **BRIEFING CLIENTE** — final client briefing/documents sent.

Each renders as a bold chip: green (complete), amber (partial), red (missing/blocking). Same 4 states feed the KPI row, the MISSING INFO panel, the pipeline badges and the calendar pop-up, so one definition drives the whole page.

## Technical notes

- `src/lib/readiness.ts`: replace the pillar list with the 4 states above (payment, fse_bookings, briefing_fse, briefing_client) and their keyword matchers; keep `pillarStatus` / `readinessPercent` signatures so nothing else breaks.
- `src/pages/OpsWizardPage.tsx`: new `CollapsibleBoard` + `BoardCard` local components with an `openCards` state set; master expand/collapse; horizontal flex board with `overflow-x-auto`.
- Calendar: add `selectedEvent` state in `ReservasCalendar`, render a shadcn `Popover`/`Dialog` with the booking summary and the two actions.
- Mock data layer (`src/data/mockOps.ts`) stays the data source; the Supabase swap (Secção C) remains untouched until you ask for it.

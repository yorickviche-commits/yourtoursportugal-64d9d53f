# Ops Wizard — Operations Intelligence Page

A single dark-theme screen at `/ops` that replaces the "Bookings & Reservas" sidebar entry. Mock data only, no backend calls.

## What gets built

**Route `/ops`** — one full-height screen, no page scroll:

- **Top bar** — gradient dot + "OPS WIZARD", subtitle "Your Tours Portugal · Operations Intelligence", current time and a green "⟳ Synced" pill.
- **KPI row** — 4 clickable cards that filter the Priority Queue: urgent actions (red), pending approvals (amber), blocked bookings (amber-yellow), departures ≤7 days (purple).
- **Column 1 (380px) — Priority Queue**: ALL/CRITICAL/HIGH/MEDIUM chips, ranked action cards (index, severity badge, deadline badge, title/subtitle, stage + state + score, primary/secondary buttons). Empty state: dashed panel "ALL CLEAR — no pending actions in this filter".
- **Column 2 (flexible) — Operations Pipeline**: the 8 stages in fixed order with count badge, proportional bar and red blocked-dot; below it "BOOKINGS IN <stage>" compact rows that expand to show missing-info chips (red = blocking, amber = not) and deep-link buttons. Default stage: Deposit / Payment Received.
- **Column 3 (400px) — Review & Approve**: recipient avatar/initials, DEADLINE + SUBJECT meta strip, editable monospace textarea with the draft body, EDIT DRAFT / APPROVE & SEND, SCHEDULE / REJECT, "update stage after sending" select, and an OPEN IN row of the action's deep links. APPROVE & SEND marks the action done locally, toasts "Sent · stage updated", auto-selects the next action.
- **Bottom bar** — LIVE ACTIVITY with pulsing green dot, 4 recent mock events, and an "✦ ASK OPS" button opening a popover with an input and a hardcoded reply.

## Files

New:
- `src/pages/OpsWizardPage.tsx` — the screen plus its local sub-components (queue card, pipeline stage row, booking row, review panel, bottom bar).
- `src/lib/priority.ts` — `priorityScore(action, booking)`: severity base 7/5/3, +2 deadline <24h, +1 departure ≤7d, +1.5 blocking missing item, +1 lastContactDays>45, clamped to 10, one decimal.
- `src/lib/missing.ts` — `requiredFields(stage)` with the exact per-stage lists.
- `src/lib/links.ts` — `NETHUNT_BASE`, `GMAIL_SEARCH`, `CALENDAR_BASE` constants + builders; all links open in a new tab.

Existing, minimal edits:
- `src/App.tsx` — add the `/ops` route.
- `src/components/AppSidebar.tsx` + `src/lib/pagePermissions.ts` — replace the "Bookings & Reservas" entry with "Ops Wizard" → `/ops` (permission key `ops`).
- `index.html` — load Instrument Sans + IBM Plex Mono from Google Fonts.

Untouched: `src/types/ops.ts` and `src/data/mockOps.ts` (already present with the 14 bookings / 7 actions / 4 activity events); existing `/trips` page and `/bookings/:id` route stay in place, only the menu entry moves to Ops Wizard.

## Technical notes

- Design tokens are applied as scoped inline/arbitrary values inside the Ops Wizard page so the rest of the app's theme is unaffected: base `#04070f`, panels `rgba(255,255,255,0.015)` with `rgba(91,155,255,0.12)` borders, text `#dfe8f8` / 50% muted, accent `#1c4fd8`, accent light `#5b9bff`, severities `#ff4d5e` / `#ffab2e` / `#5b9bff`, success `#2ee6a8`, purple `#b79dff`. Panels 11–13px radius, buttons/cards 7–9px.
- All state is React `useState` in the page: selected action, filter, selected stage, expanded booking, draft text, done action ids.
- Queue sorted by `priorityScore` desc then `deadlineISO` asc. Icons from lucide-react only. No animations beyond the single pulsing activity dot.

## Goal

Transform Spark from a passive dashboard into an **action cockpit**. Each agent gets its own page where it:
1. Diagnoses what to do (with full context)
2. Drafts the work (emails, status changes, notes)
3. Presents it to the human **one item at a time** with **Send / Edit / Skip / Approve / Reject** controls

Keep the current `/agents` overview, but every card opens a dedicated page.

## Routes

```
/agents                            ← existing overview (unchanged layout, cards become links)
/agents/qualification              ← New Leads triage
/agents/itinerary                  ← Proposal builder queue
/agents/followup                   ← Follow-up email queue
/agents/supplier                   ← FSE Pre-Booker (the main workflow)
/agents/ops-review                 ← Daily operations review
```

Each sub-page is a focused workspace, full width, large cards.

## Shared UI primitives (new)

`src/components/agents/AgentPageShell.tsx`
- Header: agent icon + name + role + back link to `/agents`
- Sidebar (left, ~280px): scrollable list of pending items with status dot, name, urgency. Click selects.
- Main panel (right): the **active item card** — large, with all context + action zone.

`src/components/agents/ActionApprovalCard.tsx`
- Renders an "AI suggested action" with:
  - Reason / explanation block
  - Target (lead / supplier / email recipient)
  - Big primary button "Aprovar e Executar"
  - Secondary "Editar" / "Rejeitar"

`src/components/agents/EmailReviewQueue.tsx`
- For email batches (FSE pre-bookings, follow-ups)
- Shows queue: `Email 2 de 7 — Fornecedor X`
- Pre-filled editor (reuses existing `BookingRequestDialog` HTML editor logic, inline)
- Buttons: `Enviar` · `Editar` · `Saltar` · `Enviar Todos os Restantes`
- After send/skip → auto-advance to next email

## Agent-specific behavior

### 1. New Leads & Qualification (`/agents/qualification`)
- Left list: leads in `new`/`contacted` sorted by budget weight
- Right card per lead: name, contact, budget, destination, pax, raw simulation text
- AI suggestions (computed locally from lead data):
  - "Score = X/100 → Qualificar para `qualified`" → Approve button
  - "Score < 50 → Rejeitar com email pré-feito" → Email review
  - "Pedir mais info ao cliente" → Email draft via existing `generate-email` function

### 2. Itinerary Construction & Proposal (`/agents/itinerary`)
- Left list: qualified leads without proposal + last-minute high-budget
- Right card: lead context + "Gerar travel plan + proposta" CTA (links to existing builder), or "Acelerar last-minute"
- Action: status nudge to `negotiation`, or shortcut to `/leads/:id?tab=planner`

### 3. Follow-up Agent (`/agents/followup`)
- Left list: `proposal_sent`/`negotiation` stale > N days
- Right: EmailReviewQueue — AI drafts a follow-up email per lead (calls existing `generate-email` function with a "follow-up after proposal" template)
- Human walks through, sends or edits each

### 4. FSE Supplier Pre-Booker (`/agents/supplier`) — **the headline flow**
- Left list: leads in `won` or `proposal_sent` with travel ≤ 45d
- When a lead is selected:
  1. Pull its `cost_items` (already linked to FSE suppliers) via existing `useCostItemsQuery`
  2. Filter cost items where: supplier set AND not already requested in `trip_operations`/`lead_operations`
  3. Show panel: *"Esta lead tem X serviços confirmados sem pedido de reserva enviado. Pedir permissão para enviar pré-bookings a todos os fornecedores?"*
  4. Big **"Preparar X emails"** button
  5. Opens EmailReviewQueue: each cost item generates a pre-composed booking email (reuses the same default body as `BookingRequestDialog`)
  6. Human reviews email #1, clicks Enviar (or Editar), advances to #2, …, until queue done
  7. Each send updates `trip_operations`/`lead_operations` booking_status='requested' and logs to `booking_emails_log` (same logic as today)

### 5. Operations Wizard Review (`/agents/ops-review`)
- Left list: won leads with travel D-14 or sooner
- Right card per lead: checklist
  - Bookings confirmed: X/Y → action "Reenviar pendentes" (→ EmailReviewQueue)
  - Payments outstanding: list
  - Missing pickup times / supplier email gaps
  - Final voucher status
- Each row has Approve / Mark Done / Open lead

## Wiring

- `/agents` overview: each card now also has a button "Abrir centro do agente →" pointing to the sub-page.
- Add 5 routes in `src/App.tsx` (lazy-loaded).
- No DB changes — all data already exists (`leads`, `cost_items`, `trip_operations`, `lead_operations`, `booking_emails_log`).
- Email send reuses the existing `send-booking-email` edge function. Follow-up/qualification emails reuse `generate-email` + a generic "send Gmail" path; if no generic send exists, add a minimal `send-generic-email` edge function (small, mirrors `send-booking-email` but with arbitrary subject/body and no operation update).

## Scope decisions

- Build the **shell + overview links + FSE Supplier Pre-Booker page (full flow)** in this iteration since that's the example the user gave.
- The other 4 sub-pages get the same shell with their lists + a "coming soon" hint for AI email batches, but qualification/follow-up email queues will be wired in a follow-up iteration to keep this change shippable.

If you want all 5 agent flows fully wired in one go (longer, heavier), say so and I'll expand.

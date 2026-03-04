

# Plan: Connect Everything to the Database — Make It Real

## Current State

The entire application runs on **in-memory mock data**. Nothing persists between page reloads. Here's what needs to move to the database:

| Data | Current Source | Status |
|------|---------------|--------|
| Leads/Simulations | `mockLeads.ts` + React context (in-memory) | Not persisted |
| Trips | `mockData.ts` (static) | Not persisted |
| Approvals | `mockData.ts` (static) | Not persisted |
| Tasks | `TasksBoard.tsx` (static) | Not persisted |
| Dashboard stats | `mockData.ts` (static) | Not persisted |
| Itineraries | Supabase tables exist | Partially connected |
| Operations | Hardcoded in `LeadDetailPage` | Not persisted |

The itineraries/itinerary_days tables already exist in Supabase. Everything else needs tables.

---

## Implementation Plan

### Phase 1: Create Database Tables

Create new Supabase tables via migrations:

**`leads` table** — core entity for all simulations
- id (uuid), lead_code (text, auto-generated YT-YYYY-####), client_name, email, phone, destination, travel_dates, travel_end_date, number_of_days, dates_type, pax, pax_children, pax_infants, status, source, budget_level, sales_owner, notes, travel_style (jsonb), comfort_level, magic_question, active_version, created_by (uuid ref profiles), created_at, updated_at
- RLS: authenticated users can CRUD their org's leads

**`trips` table** — confirmed bookings
- id (uuid), trip_code (text), client_name, destination, start_date, end_date, status, sales_owner, budget_level, pax, urgency, total_value, notes, has_blocker, blocker_note, lead_id (ref leads), created_by, created_at, updated_at
- RLS: authenticated can read/write

**`approvals` table**
- id, trip_id, client_name, type, title, submitted_by, submitted_at, priority, summary, status (pending/approved/rejected), resolved_by, resolved_at
- RLS: authenticated can read, manage own

**`tasks` table**
- id, title, description, category, priority, status, team, assigned_to, due_date, trip_id, lead_id, created_by, created_at, updated_at
- RLS: authenticated can CRUD

### Phase 2: Replace Mock Data with Supabase Queries

For each page, replace static imports with real-time Supabase queries using React Query:

1. **`useLeads` hook** — rewrite to fetch/mutate from `leads` table instead of React state
2. **`LeadsFilesPage`** — query leads table with filters, search, pagination
3. **`LeadDetailPage`** — fetch single lead, save/update/delete to DB
4. **`Dashboard`** — aggregate queries (count trips next 7 days, pending approvals, etc.)
5. **`TripsPage`** — query trips table with urgency filters
6. **`TripDetailPage`** — fetch/update trip from DB
7. **`ApprovalsPage`** — query approvals, update status on approve/reject
8. **`TasksPage`** — full CRUD on tasks table

### Phase 3: Wire All Buttons and Actions

Every action button must trigger a real database mutation:

- **Nova Lead** → INSERT into leads table → navigate to detail
- **Guardar (Save)** → UPDATE lead in DB
- **Duplicar** → INSERT new lead with copied data
- **Nova Versão** → UPDATE active_version on lead
- **Remover** → DELETE lead (or soft-delete with status)
- **Status change** → UPDATE lead/trip status
- **Approve/Reject** → UPDATE approval status
- **Task toggle** → UPDATE task status
- **New Task** → INSERT into tasks

### Phase 4: Activity Logging

The `activity_logs` table already exists. Wire key actions to log:
- Lead created/updated/deleted
- Trip status changed
- Approval resolved
- Task completed

---

## Technical Approach

- Use **React Query** (`useQuery` / `useMutation`) for all data fetching and mutations with proper cache invalidation
- Create custom hooks: `useLeadsQuery`, `useTripsQuery`, `useTasksQuery`, `useApprovalsQuery`
- Seed the database with the existing mock data so the team starts with familiar records
- Keep the `LeadsProvider` context but back it with Supabase instead of useState
- All RLS policies use `auth.uid() IS NOT NULL` for authenticated access (internal team only)

---

## Files to Create/Modify

**New files:**
- `src/hooks/useLeadsQuery.ts` — Supabase-backed leads hook
- `src/hooks/useTripsQuery.ts` — Supabase-backed trips hook  
- `src/hooks/useTasksQuery.ts` — Supabase-backed tasks hook
- `src/hooks/useApprovalsQuery.ts` — Supabase-backed approvals hook

**Modified files:**
- `src/pages/Dashboard.tsx` — real data queries
- `src/pages/LeadsFilesPage.tsx` — real leads from DB
- `src/pages/LeadDetailPage.tsx` — real CRUD
- `src/pages/TripsPage.tsx` — real trips from DB
- `src/pages/TripDetailPage.tsx` — real trip CRUD
- `src/pages/ApprovalsPage.tsx` — real approvals
- `src/pages/TasksPage.tsx` — real tasks
- `src/components/NewLeadDialog.tsx` — insert to DB
- `src/components/leads/AISimulationForm.tsx` — insert to DB

**Database migrations:** 1 migration with leads, trips, approvals, tasks tables + RLS + seed data

---

## Execution Order

Given the scope, this should be implemented in this sequence:
1. Database migration (all 4 tables + RLS + seed data)
2. Leads system (highest priority — most used feature)
3. Trips + Dashboard
4. Tasks + Approvals
5. Activity logging integration

This will make the entire system production-ready with real persistence.




# Audit: What Works vs What Doesn't — Full Gap Analysis

## CONNECTED TO DATABASE (Real Data)

| Feature | Page | Status | Details |
|---------|------|--------|---------|
| **Leads List** | `LeadsFilesPage` | **WORKS** | Reads from `leads` table (5 records). Filters, search, stats all use real data |
| **Lead Detail — Dados Gerais** | `LeadDetailPage` | **WORKS** | Save, duplicate, new version, delete, status change — all write to DB |
| **Lead Creation (Nova Lead)** | `NewLeadDialog` | **WORKS** | Inserts into `leads` table with auto-generated `YT-YYYY-####` code |
| **AI Import (email parse)** | `NewLeadDialog` | **WORKS** | Calls `parse-lead-email` edge function |
| **Dashboard stats** | `Dashboard` | **WORKS** | Counts trips, leads, approvals from real DB data |
| **Trips List** | `TripsPage` | **WORKS** | Reads from `trips` table (6 records) with urgency filters |
| **Approvals List + Approve/Reject** | `ApprovalsPage` | **WORKS** | Full CRUD on `approvals` table, activity logging |
| **Itinerary Editor** | `LeadDetailPage > Itinerário` | **WORKS** | Reads/writes `itineraries` + `itinerary_days` tables |
| **Public Preview** | `/preview/:id` | **WORKS** | Public route reads published itineraries |
| **Auth (Login/Signup)** | `LoginPage` | **WORKS** | Real Supabase auth with email/password |

## NOT CONNECTED — Still Using Mock/Static Data

| Feature | Page | Problem | Fix Required |
|---------|------|---------|--------------|
| **Trip Detail** | `TripDetailPage` | Uses `mockTrips.find()` + hardcoded itinerary, costing, operations, checklist, files, notifications | Rewrite to use `useTripQuery()` + DB for all sub-data |
| **Tasks Page** | `TasksPage` | Uses `MOCK_TASKS` from `TasksBoard.tsx` (hardcoded array). "Nova Task" button does nothing | Connect to `tasks` table, add create/update/toggle mutations |
| **Dashboard TasksBoard** | `TasksBoard` component | Same `MOCK_TASKS` hardcoded array, calendar view uses static data | Connect to `tasks` table |
| **Travel Planner data** | `LeadDetailPage` | AI generates itinerary but result is stored in React state only — lost on refresh | Persist `itineraryDays` to a `lead_versions` or `lead_planner_data` table |
| **Costing data** | `LeadDetailPage` | AI generates budget but result is stored in React state only — lost on refresh | Persist `costingDays` to a `lead_costing` table |
| **Operations tab** | `LeadDetailPage` | Hardcoded `MOCK_OPS_DAYS` — no real data | Should pull from approved costing data |
| **Files tab (Leads)** | `LeadsFilesPage` | Uses `mockFiles` from `mockLeads.ts` | Connect to storage or a `lead_files` table |
| **CRM Page** | `CRMPage` | Unknown state | Likely placeholder/mock |
| **Partners Page** | `PartnersPage` | Has DB tables but need to verify connection | Check if using real queries |
| **Suppliers Pages** | `AdminSuppliersPage` | Has DB tables | Verify connection |
| **Activity Logs** | `AdminActivityLogsPage` | Table exists, `logActivity()` hook exists, but 0 records — likely RLS blocking inserts | Fix RLS: current policy requires `auth.uid() = user_id` but `user_id` might be null |

## CRITICAL ISSUES

1. **Activity Logs RLS**: Policy requires `user_id = auth.uid()` but `logActivity()` sets `user_id` from `getUser()` which may not match in all cases. 0 records in DB confirms inserts are failing silently.

2. **Travel Planner + Costing data loss**: The most important workflow (AI generates plan → approve → generate costing → operations) loses ALL data on page refresh because it's stored in `useState` only.

3. **TripDetailPage completely static**: Uses `mockTrips.find(t => t.id === id)` — any trip created via DB will show "Trip not found".

4. **Tasks completely static**: The entire Kanban board and task management is hardcoded mock data.

---

## Implementation Plan

### Phase 1: Fix Critical Data Persistence (Travel Planner + Costing)

Create two new tables:
- **`lead_planner_data`** — stores AI-generated travel planner days per lead/version
- **`lead_costing_data`** — stores AI-generated costing days per lead/version

This ensures the core workflow (Dados Gerais → Travel Planner → Custos → Operações) persists across sessions.

### Phase 2: Connect TripDetailPage to Database

Replace `mockTrips.find()` with `useTripQuery(id)`. Move checklist, files, notifications to DB-backed state or at minimum to the `trips` table JSONB fields.

### Phase 3: Connect Tasks to Database

Rewrite `TasksPage` and `TasksBoard` to use `useTasksQuery` hook (already exists). Add create task dialog, toggle mutations, and Kanban drag-and-drop persistence.

### Phase 4: Fix Activity Logs

Fix the RLS policy or the insert logic so activity logs actually persist. Currently 0 records despite the hook being called.

### Phase 5: Connect Operations Tab

Wire the Operations tab in LeadDetailPage to pull from approved costing data instead of `MOCK_OPS_DAYS`.

### Phase 6: Connect Files

Replace `mockFiles` in LeadsFilesPage with real file references (either from storage bucket or a `lead_files` table).

---

## Execution Priority

1. **Travel Planner + Costing persistence** — without this, the core product workflow breaks on every refresh
2. **TripDetailPage** — trips exist in DB but detail page can't show them
3. **Tasks** — hooks exist, just need to connect pages
4. **Activity Logs fix** — quick RLS fix
5. **Operations tab + Files** — lower priority, can use interim solutions

## Files to Create/Modify

**New DB tables:** `lead_planner_data`, `lead_costing_data`
**Modified pages:** `TripDetailPage`, `TasksPage`, `TasksBoard`, `LeadDetailPage` (persist planner/costing), `LeadsFilesPage` (remove mockFiles)
**Fix:** `useActivityLog.ts` or RLS policy on `activity_logs`


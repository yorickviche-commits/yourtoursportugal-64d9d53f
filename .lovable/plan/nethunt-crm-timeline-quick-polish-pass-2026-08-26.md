# NetHunt CRM Timeline — Quick Polish Pass

Close Ops Wizard for now and fix the most visible NetHunt CRM gap: the timeline inside a lead is not reliably showing/loading for the team, even though the backend already has 3,146 timeline events synced.

## Current state (verified)

- `nethunt_timeline` table has **3,146 events** (1,882 email, 965 field_change, 147 calendar, 144 comment, 8 file) and all rows are linked to a `lead_id`.
- **115 leads** have a `nethunt_record_id`.
- `nethunt-pull` cron is running: 1,494 timeline sweeps in the last 7 days, mostly OK.
- The data layer works; the pain points are **visibility, loading feedback, and single-lead refresh** in the UI.

## What gets polished

### 1. Sync diagnostics strip in `LeadCrmTab`
Add a compact, always-visible strip above the timeline that answers:
- Is this lead linked to NetHunt? (record id + direct link)
- Last sync timestamp
- Event count by type for this lead
- One-click "Force full timeline sync" that calls `nethunt-pull` with `{ recordId, fullTimeline: true }` for this record only

This removes the guesswork about whether data exists.

### 2. Timeline reliability fixes
- Ensure `useLeadTimeline` refetches after a manual sync succeeds.
- Add a stale-while-revalidate policy so the timeline does not appear empty during first load.
- Show a clear empty state when no events exist vs. a loading state.
- Surface the last sync error (if any) from `nethunt_sync_log` for this lead.

### 3. Email / event UX improvements
- Make every timeline row clearly identifiable by type (icon + color chip).
- Expandable email rows: load full HTML body via `gmail-record-emails` on demand, with a fallback to "Open in Gmail" if body fetch fails.
- Add deep-link chips: "NetHunt", "Gmail", "Calendar" where applicable.
- Render field-change events as readable "Field: old → new" lines instead of raw JSON.

### 4. Standalone CRM record page guard
`CRMRecordDetailPage` currently fires 9 parallel NetHunt proxy calls. Add:
- A visible "Sync state" badge.
- Graceful per-section fallback (if comments fail, still show emails; if emails fail, still show record fields).
- A timeout/error message instead of an infinite spinner.

## Files touched

- `src/components/crm/LeadCrmTab.tsx` — diagnostics strip, timeline refresh, empty/error states, email expansion.
- `src/hooks/useNetHunt.ts` — add `useSyncLeadFull` mutation and optional `useLeadSyncLog` query.
- `src/pages/CRMRecordDetailPage.tsx` — sync badge, section-level fallbacks, loading/error states.
- `supabase/functions/nethunt-pull/index.ts` — accept `{ recordId, fullTimeline: true }` and route to `syncLeadTimeline` directly for a fast single-lead refresh.

## Out of scope for this pass

- Rebuilding the NetHunt data model.
- New edge functions or connectors.
- WhatsApp/chat integration (NetHunt does not expose this via API).
- Bulk backfill (data already exists; only single-lead force-sync is added).

## Success criteria

A team member opens a linked lead, sees immediately how many NetHunt events exist, clicks one event (especially email), and reads the full body or opens it in Gmail without confusion.

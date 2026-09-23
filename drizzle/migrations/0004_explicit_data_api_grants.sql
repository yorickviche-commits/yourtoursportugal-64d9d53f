-- Explicit Data API grants (Supabase change effective 2026-10-30).
-- Makes the grants reproducible on replay. Additive only; RLS still controls row access.
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- anon: only what the public shared-proposal page needs (RLS policies for anon exist only on these)
grant select on public.proposals, public.proposal_annotations, public.proposal_events,
                public.itineraries, public.itinerary_days to anon;
grant insert on public.proposal_annotations, public.proposal_events to anon;

-- Health check: lists every public table/view and whether the API roles can reach it and RLS is on.
create or replace function public.audit_api_grants()
returns table(relation text, kind text, rls_enabled boolean, authenticated_crud boolean, service_role_crud boolean, anon_select boolean)
language sql stable security invoker set search_path = ''
as $$
  select c.relname::text,
         case c.relkind when 'r' then 'table' when 'p' then 'table' when 'v' then 'view' when 'm' then 'matview' else c.relkind::text end,
         c.relrowsecurity,
         has_table_privilege('authenticated', c.oid, 'select,insert,update,delete'),
         has_table_privilege('service_role',  c.oid, 'select,insert,update,delete'),
         has_table_privilege('anon', c.oid, 'select')
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r','p','v','m')
  order by 1;
$$;
revoke execute on function public.audit_api_grants() from public, anon;
grant execute on function public.audit_api_grants() to authenticated, service_role;
DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.decision_close_candidate(public.decisions)'::regprocedure) INTO definition;
 definition := replace(definition,
 'SELECT sum(CASE WHEN kind=''refund'' THEN -amount ELSE amount END) FROM public.lead_payments WHERE lead_id=d.lead_id AND upper(currency)',
 'SELECT sum(CASE WHEN lp.kind=''refund'' THEN -lp.amount ELSE lp.amount END) FROM public.lead_payments lp WHERE lp.lead_id=d.lead_id AND upper(lp.currency)');
 IF definition = pg_get_functiondef('public.decision_close_candidate(public.decisions)'::regprocedure) THEN RAISE EXCEPTION 'Expected payment definition was not found'; END IF;
 EXECUTE definition;
END $migration$;
DO $fix$
DECLARE definition text;
BEGIN
 definition:=pg_get_functiondef('public.decision_close_candidate(public.decisions)'::regprocedure);
 IF position('coalesce(l.trip_finish,l.trip_start,public.decision_safe_date(l.travel_end_date),public.decision_safe_date(l.travel_dates))' IN definition)=0 THEN RAISE EXCEPTION 'Expected date expression not found'; END IF;
 definition:=replace(definition,'coalesce(l.trip_finish,l.trip_start,public.decision_safe_date(l.travel_end_date),public.decision_safe_date(l.travel_dates))','coalesce(l.trip_finish,public.decision_safe_date(l.travel_end_date),l.trip_start,public.decision_safe_date(l.travel_dates))');
 EXECUTE definition;
END $fix$;
COMMENT ON FUNCTION public.decision_close_candidate(public.decisions) IS 'End date takes precedence over start, including legacy date fields; only an exact operation/thread match can close an operational card.';
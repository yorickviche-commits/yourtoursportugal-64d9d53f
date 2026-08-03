UPDATE public.integration_settings
SET status = 'active',
    config = COALESCE(config, '{}'::jsonb) || jsonb_build_object('enabled', true, 'calendar_id', 'yourtours.pt_jfr4e1bm8giatbcemdtjirvbjs@group.calendar.google.com'),
    error_count = 0
WHERE name = 'google_calendar';
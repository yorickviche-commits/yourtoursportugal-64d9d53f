-- Audited public constraints, policies and trigger functions: no minimum-margin rejection exists.
-- below_min_margin is calculated by a reporting view, not a write constraint.
COMMENT ON COLUMN public.rpt_files.below_min_margin IS 'Informational low-margin flag only. Must never block saving, validation, proposals, PDFs, stages, or payment links.';
COMMENT ON COLUMN public.system_settings.value IS 'Configured setting value. minimum_margin_threshold is an advisory margin reference only, never a blocking minimum.';
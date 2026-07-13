
-- Knowledge Layer Fase 1: schema (sem embeddings; retrieval por filtros)

CREATE TABLE public.reference_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  yt_id TEXT,
  title TEXT NOT NULL,
  client_name TEXT,
  segment TEXT NOT NULL,
  language TEXT NOT NULL,
  pax INT,
  duration_days INT NOT NULL,
  dates TEXT,
  channel TEXT,
  doc_type TEXT,
  wetravel_url TEXT,
  days JSONB NOT NULL,
  signature_elements TEXT[] DEFAULT '{}',
  notes TEXT,
  is_best_of BOOLEAN DEFAULT TRUE,
  usage_count INT DEFAULT 0,
  win_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX reference_programs_title_lang_uniq ON public.reference_programs (title, language);
CREATE INDEX reference_programs_segment_idx ON public.reference_programs (segment);
CREATE INDEX reference_programs_duration_idx ON public.reference_programs (duration_days);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reference_programs TO authenticated;
GRANT ALL ON public.reference_programs TO service_role;
ALTER TABLE public.reference_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal users can read reference_programs" ON public.reference_programs
  FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));
CREATE POLICY "Admins manage reference_programs" ON public.reference_programs
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.day_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  region TEXT NOT NULL,
  canonical_text TEXT NOT NULL,
  segment_fit TEXT[] NOT NULL DEFAULT '{}',
  usage_count INT DEFAULT 0,
  win_count INT DEFAULT 0,
  avg_rating NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX day_modules_region_idx ON public.day_modules (region);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.day_modules TO authenticated;
GRANT ALL ON public.day_modules TO service_role;
ALTER TABLE public.day_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal users read day_modules" ON public.day_modules
  FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));
CREATE POLICY "Admins manage day_modules" ON public.day_modules
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.brand_formulas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  text_pt TEXT,
  text_en TEXT,
  text_es TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_formulas TO authenticated;
GRANT ALL ON public.brand_formulas TO service_role;
ALTER TABLE public.brand_formulas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal users read brand_formulas" ON public.brand_formulas
  FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));
CREATE POLICY "Admins manage brand_formulas" ON public.brand_formulas
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.signature_elements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  segments TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.signature_elements TO authenticated;
GRANT ALL ON public.signature_elements TO service_role;
ALTER TABLE public.signature_elements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal users read signature_elements" ON public.signature_elements
  FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));
CREATE POLICY "Admins manage signature_elements" ON public.signature_elements
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.pricing_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item TEXT NOT NULL,
  price TEXT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_patterns TO authenticated;
GRANT ALL ON public.pricing_patterns TO service_role;
ALTER TABLE public.pricing_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal users read pricing_patterns" ON public.pricing_patterns
  FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));
CREATE POLICY "Admins manage pricing_patterns" ON public.pricing_patterns
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.proposal_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  reference_program_id UUID REFERENCES public.reference_programs(id) ON DELETE SET NULL,
  day_module_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX proposal_references_proposal_idx ON public.proposal_references (proposal_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_references TO authenticated;
GRANT ALL ON public.proposal_references TO service_role;
ALTER TABLE public.proposal_references ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal users manage proposal_references" ON public.proposal_references
  FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));

CREATE TABLE public.proposal_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL,
  client_reaction TEXT,
  edits_made JSONB,
  module_ratings JSONB,
  learnings TEXT,
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX proposal_feedback_proposal_idx ON public.proposal_feedback (proposal_id);
CREATE INDEX proposal_feedback_outcome_idx ON public.proposal_feedback (outcome);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_feedback TO authenticated;
GRANT ALL ON public.proposal_feedback TO service_role;
ALTER TABLE public.proposal_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Internal users manage proposal_feedback" ON public.proposal_feedback
  FOR ALL TO authenticated USING (public.is_internal_user(auth.uid())) WITH CHECK (public.is_internal_user(auth.uid()));

-- updated_at triggers
CREATE TRIGGER trg_reference_programs_updated BEFORE UPDATE ON public.reference_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_day_modules_updated BEFORE UPDATE ON public.day_modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_brand_formulas_updated BEFORE UPDATE ON public.brand_formulas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_signature_elements_updated BEFORE UPDATE ON public.signature_elements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pricing_patterns_updated BEFORE UPDATE ON public.pricing_patterns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

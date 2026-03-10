
CREATE TABLE public.supplier_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  scores jsonb NOT NULL DEFAULT '{}',
  weighted_average numeric DEFAULT 0,
  classification text DEFAULT 'Não Avaliado',
  qualification text DEFAULT 'Não Avaliado',
  occurrences integer DEFAULT 0,
  is_selected boolean DEFAULT false,
  scored_by text DEFAULT 'manual',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(supplier_id)
);

ALTER TABLE public.supplier_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view supplier scores"
ON public.supplier_scores FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins and ops can manage supplier scores"
ON public.supplier_scores FOR ALL TO authenticated
USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'operations_agent'::app_role))
WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'operations_agent'::app_role));

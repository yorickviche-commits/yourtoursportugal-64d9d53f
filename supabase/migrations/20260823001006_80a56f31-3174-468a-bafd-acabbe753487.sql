-- pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- role helpers
CREATE OR REPLACE FUNCTION public.ytb_can_edit(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id
    AND role IN ('super_admin','admin','sales_agent','operations_agent','finance','b2b_manager'))
$$;

CREATE TABLE public.ytb_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_folder_id uuid REFERENCES public.ytb_folders(id) ON DELETE CASCADE,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ytb_folders TO authenticated;
GRANT ALL ON public.ytb_folders TO service_role;
ALTER TABLE public.ytb_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY ytb_folders_select ON public.ytb_folders FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));
CREATE POLICY ytb_folders_write ON public.ytb_folders FOR ALL TO authenticated USING (public.ytb_can_edit(auth.uid())) WITH CHECK (public.ytb_can_edit(auth.uid()));
CREATE TRIGGER trg_ytb_folders_updated BEFORE UPDATE ON public.ytb_folders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ytb_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid REFERENCES public.ytb_folders(id) ON DELETE SET NULL,
  title text NOT NULL,
  type text NOT NULL DEFAULT 'text' CHECK (type IN ('text','pdf','file','link')),
  content text,
  file_path text,
  file_name text,
  file_size bigint,
  url text,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','obsolete')),
  confidentiality text NOT NULL DEFAULT 'internal' CHECK (confidentiality IN ('internal','confidential','client')),
  tags text[] NOT NULL DEFAULT '{}',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_deleted boolean NOT NULL DEFAULT false
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ytb_documents TO authenticated;
GRANT ALL ON public.ytb_documents TO service_role;
ALTER TABLE public.ytb_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY ytb_documents_select ON public.ytb_documents FOR SELECT TO authenticated
  USING (public.is_internal_user(auth.uid()) AND (confidentiality <> 'confidential' OR public.ytb_can_edit(auth.uid())));
CREATE POLICY ytb_documents_write ON public.ytb_documents FOR ALL TO authenticated
  USING (public.ytb_can_edit(auth.uid())) WITH CHECK (public.ytb_can_edit(auth.uid()));
CREATE TRIGGER trg_ytb_documents_updated BEFORE UPDATE ON public.ytb_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_ytb_documents_folder ON public.ytb_documents(folder_id);

CREATE TABLE public.ytb_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT 'gray',
  description text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ytb_categories TO authenticated;
GRANT ALL ON public.ytb_categories TO service_role;
ALTER TABLE public.ytb_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY ytb_categories_select ON public.ytb_categories FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));
CREATE POLICY ytb_categories_write ON public.ytb_categories FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.ytb_document_categories (
  document_id uuid NOT NULL REFERENCES public.ytb_documents(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.ytb_categories(id) ON DELETE CASCADE,
  PRIMARY KEY (document_id, category_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ytb_document_categories TO authenticated;
GRANT ALL ON public.ytb_document_categories TO service_role;
ALTER TABLE public.ytb_document_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY ytb_doc_cat_select ON public.ytb_document_categories FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));
CREATE POLICY ytb_doc_cat_write ON public.ytb_document_categories FOR ALL TO authenticated USING (public.ytb_can_edit(auth.uid())) WITH CHECK (public.ytb_can_edit(auth.uid()));

CREATE TABLE public.ytb_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ytb_classification_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  classification_id uuid NOT NULL REFERENCES public.ytb_classifications(id) ON DELETE CASCADE,
  value text NOT NULL,
  sort_order int NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ytb_classifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ytb_classification_values TO authenticated;
GRANT ALL ON public.ytb_classifications TO service_role;
GRANT ALL ON public.ytb_classification_values TO service_role;
ALTER TABLE public.ytb_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ytb_classification_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY ytb_class_select ON public.ytb_classifications FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));
CREATE POLICY ytb_class_write ON public.ytb_classifications FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY ytb_classv_select ON public.ytb_classification_values FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));
CREATE POLICY ytb_classv_write ON public.ytb_classification_values FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.ytb_document_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.ytb_documents(id) ON DELETE CASCADE,
  version_number int NOT NULL DEFAULT 1,
  title text,
  content text,
  file_path text,
  url text,
  edited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ytb_document_versions TO authenticated;
GRANT ALL ON public.ytb_document_versions TO service_role;
ALTER TABLE public.ytb_document_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY ytb_versions_select ON public.ytb_document_versions FOR SELECT TO authenticated USING (public.is_internal_user(auth.uid()));
CREATE POLICY ytb_versions_write ON public.ytb_document_versions FOR ALL TO authenticated USING (public.ytb_can_edit(auth.uid())) WITH CHECK (public.ytb_can_edit(auth.uid()));

CREATE TABLE public.ytb_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ytb_activity_log TO authenticated;
GRANT ALL ON public.ytb_activity_log TO service_role;
ALTER TABLE public.ytb_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY ytb_log_select ON public.ytb_activity_log FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY ytb_log_insert ON public.ytb_activity_log FOR INSERT TO authenticated WITH CHECK (public.is_internal_user(auth.uid()));

CREATE TABLE public.ytb_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.ytb_documents(id) ON DELETE CASCADE,
  chunk_index int NOT NULL DEFAULT 0,
  chunk_text text NOT NULL,
  embedding vector(1536),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ytb_embeddings TO authenticated;
GRANT ALL ON public.ytb_embeddings TO service_role;
ALTER TABLE public.ytb_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY ytb_emb_select ON public.ytb_embeddings FOR SELECT TO authenticated USING (public.ytb_can_edit(auth.uid()));
CREATE INDEX idx_ytb_embeddings_doc ON public.ytb_embeddings(document_id);
CREATE INDEX idx_ytb_embeddings_vec ON public.ytb_embeddings USING hnsw (embedding vector_cosine_ops);

-- similarity search (service_role / internal use)
CREATE OR REPLACE FUNCTION public.ytb_match_chunks(
  query_embedding vector(1536),
  match_count int DEFAULT 8,
  allow_confidential boolean DEFAULT false
)
RETURNS TABLE(document_id uuid, title text, chunk_text text, similarity float, metadata jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.document_id, d.title, e.chunk_text,
         1 - (e.embedding <=> query_embedding) AS similarity, e.metadata
  FROM public.ytb_embeddings e
  JOIN public.ytb_documents d ON d.id = e.document_id
  WHERE d.is_deleted = false
    AND d.status = 'active'
    AND (allow_confidential OR d.confidentiality <> 'confidential')
    AND e.embedding IS NOT NULL
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count
$$;

-- storage policies
CREATE POLICY ytb_storage_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'yt-brain-docs' AND public.is_internal_user(auth.uid()));
CREATE POLICY ytb_storage_write ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'yt-brain-docs' AND public.ytb_can_edit(auth.uid()));
CREATE POLICY ytb_storage_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'yt-brain-docs' AND public.ytb_can_edit(auth.uid()));
CREATE POLICY ytb_storage_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'yt-brain-docs' AND public.ytb_can_edit(auth.uid()));

-- SEED
INSERT INTO public.ytb_folders (name) VALUES
  ('SOPs & Protocolos'),('Produtos & Itinerários'),('Termos e Condições'),('Tabelas Operacionais'),
  ('ISO & Compliance'),('Best Practices'),('Reviews & Feedback'),('Marketing & Comunicação'),('Fornecedores');

INSERT INTO public.ytb_categories (name, color, description) VALUES
  ('SOP','blue','Procedimentos operacionais padrão'),
  ('Produto','green','Produtos e itinerários'),
  ('T&C','purple','Termos e condições'),
  ('Operacional','orange','Tabelas e dados operacionais'),
  ('ISO','gray','ISO e compliance'),
  ('Best Practice','teal','Boas práticas internas'),
  ('Review','yellow','Reviews e feedback de clientes'),
  ('Marketing','pink','Marketing e comunicação'),
  ('Fornecedor','red','Informação de fornecedores'),
  ('Formação','indigo','Materiais de formação')
ON CONFLICT (name) DO NOTHING;

WITH c AS (
  INSERT INTO public.ytb_classifications (name) VALUES ('Confidencialidade'),('Estado')
  ON CONFLICT (name) DO NOTHING RETURNING id, name
)
INSERT INTO public.ytb_classification_values (classification_id, value, sort_order)
SELECT c.id, v.value, v.ord FROM c
JOIN (VALUES
  ('Confidencialidade','Interno',1),('Confidencialidade','Confidencial',2),('Confidencialidade','Cliente',3),
  ('Estado','Rascunho',1),('Estado','Ativo',2),('Estado','Obsoleto',3)
) AS v(cname, value, ord) ON v.cname = c.name;
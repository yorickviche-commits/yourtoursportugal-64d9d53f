# Feedback Hub — plano de implementação

## Respostas às 5 verificações (feitas no código e na base de dados)

**1. `agent_notifications` tem coluna de destinatário?**
Não — e mais importante: **a tabela não existe na base de dados**. Existe o ficheiro `supabase/migrations/20260523220000_agent_spark_structure.sql` que a cria, mas essa migração nunca foi aplicada (a consulta ao catálogo só devolve `agent_activity_log`, `agent_status`, `agent_task_drafts`). O hook `src/hooks/useAgentNotifications.ts` usa `(supabase as any)` e por isso falha em silêncio; o badge da sidebar mostra sempre 0.
Proposta: criar a tabela na migração do Feedback Hub com o schema exacto do ficheiro existente **mais** `user_id uuid NULL` (destinatário; NULL = para toda a equipa), com GRANTs e policy de SELECT `user_id IS NULL OR user_id = auth.uid()`. É aditivo, não parte nada (não há dados nem tabela), e passa a alimentar corretamente o badge existente.

**2. `@dnd-kit` e função genérica `updated_at`?**
Não existe `@dnd-kit`, mas existe **`@hello-pangea/dnd@^18.0.1`** (já usado no Travel Planner e no Costing) — vou usar essa para o kanban, zero dependências novas. Existe `public.update_updated_at_column()` (SECURITY na forma `SET search_path = public`) — reutilizar, não criar `touch_updated_at`.

**3. Como são identificadas as tabs em `/leads/:id`?**
Apenas por **estado React** (`const [activeTab, setActiveTab] = useState<DetailTab>('dados_gerais')`) — não há query string nem hash. Logo a deteção automática de módulo pela rota **não consegue** distinguir travel_plan / costing / operações. Duas opções (ver riscos): (a) o pop-up recebe o módulo por um contexto leve que a página da lead publica; (b) `resolveModule` devolve `leads` e o utilizador ajusta o select. Proponho (a) com um `FeedbackContextProvider` opcional — 3 linhas em `LeadDetailPage`, sem alterar comportamento.

**4. Referência YT#### disponível na página da lead?**
Sim: `leads.lead_code` (formato `YT-YYYY-0001`) e um campo livre `yt_id` usado como referência preferida (`formState.ytId || lead.yt_id || lead.lead_code`). O mesmo provider do ponto 3 pode passar `lead_ref`, evitando regex frágil sobre o `document.title`.

**5. Posições dos FABs?**
Confirmado: `NewLeadFAB` em `right-6` (é um botão largo com texto, `h-12 px-5`), `TourLauncher` em `right-[180px]`, `AssistantLauncher` em `right-[236px]`. `right-[292px]` está livre.

---

## Bloco A — Base + pop-up + "Os Meus Reportes"

Migração única:
- enums `feedback_type/severity/status/priority`; sequência + tabela `platform_feedback` com trigger de `ref` (`FB-0001`) e `update_updated_at_column`
- tabelas satélite `_attachments`, `_comments`, `_events`, `_votes`
- criação de `agent_notifications` (com `user_id`) conforme resposta 1
- triggers `AFTER INSERT`/`AFTER UPDATE`: eventos, `triaged_at`, `resolved_at`, reabertura, notificação ao reporter, notificação urgente aos `super_admin` em `blocker`
- trigger `BEFORE INSERT` que força `status='new'`, `priority/assignee NULL` para não-admins
- GRANTs em todas as tabelas novas + RLS e policies conforme especificação
- funções `public.can_view_feedback(uuid)` (SECURITY DEFINER) e view `platform_feedback_public` (colunas mínimas)
- bucket privado `feedback-media` + policies de storage
- `permissions`: `page:my_feedback` para todas as roles, `page:admin_feedback` para admin/super_admin

Ficheiros:
- `src/lib/feedbackContext.ts` (captureContext, resolveModule, FEEDBACK_MODULES, parser UA por regex)
- `src/lib/feedbackConstants.ts`
- `src/components/feedback/FeedbackProvider.tsx` (contexto opcional módulo + lead_ref)
- `src/hooks/useFeedbackQuery.ts`, `src/hooks/useFeedbackMutations.ts`
- `src/components/feedback/FeedbackLauncher.tsx`, `FeedbackDialog.tsx`, `FeedbackTypeCards.tsx`, `ImageDropzone.tsx`, `ContextBar.tsx`, `FeedbackBadges.tsx`, `FeedbackDetailSheet.tsx`, `ImageLightbox.tsx`
- `src/pages/MyFeedbackPage.tsx`
- Integrações: `src/lib/pagePermissions.ts`, `src/components/AppSidebar.tsx` (item + item mobile "Reportar problema"), `src/components/AppLayout.tsx`, `src/App.tsx`, `vite.config.ts` (`__APP_VERSION__`), `src/vite-env.d.ts` (declaração do global), `src/pages/LeadDetailPage.tsx` (3 linhas para publicar módulo/lead_ref)
- Regenerar `src/integrations/supabase/types.ts` após a migração

## Bloco B — Dashboard `/admin/feedback`

- `src/pages/AdminFeedbackPage.tsx`
- `src/components/feedback/FeedbackKPIs.tsx` (Recharts existente), `FeedbackBoard.tsx` (kanban com `@hello-pangea/dnd`), `FeedbackTable.tsx` (ordenação, seleção, ações em massa, CSV), `LovablePromptDialog.tsx`
- extensão de `FeedbackDetailSheet.tsx` para `mode='admin'` (estado, prioridade, assignee via `useInternalUsers`, tags, esforço, release, comentários internos, timeline, duplicados, resolver/reabrir/apagar)
- `pagePermissions.ts` + `AppSidebar.tsx`: item "Feedback Hub" com badge de `new` (refetch 60 s)
- vista `platform_feedback_overview` com `security_invoker = on`, filtros e vista persistidos em `localStorage`

---

## Pontos de risco / ambiguidade

1. **Tabs da lead sem rota própria** (resposta 3) — sem o provider, `module` cai em `leads` para travel plan/costing/operações. Proponho o provider; alternativa é mudar as tabs para query string, o que é uma alteração maior à página da lead e não recomendo agora.
2. **`agent_notifications` inexistente** — a criação passa a fazer aparecer notificações no badge da sidebar (comportamento novo visível). Não vou inserir os dados de demonstração da migração antiga.
3. **`reported_by NOT NULL` com `ON DELETE SET NULL`** é contraditório: apagar o utilizador falharia. Proponho `ON DELETE CASCADE` (apaga os reportes) ou tornar a coluna nullable. Preciso da tua escolha — por defeito seguirei nullable, para preservar o histórico.
4. **View `platform_feedback_public` "security definer"** expõe títulos de reportes de todos a qualquer autenticado — é intencional na especificação (secção 2.5) e assumo que sim, mas note-se que descrições e contexto continuam privados.
5. **Limite de 8 MB por imagem** é aplicado no cliente e via `file_size_limit` do bucket; o tipo MIME é restringido no bucket, não em policy.
6. **`app_version` com short SHA** — não há SHA disponível no ambiente de build do Lovable; usarei `VITE_COMMIT_SHA` quando existir, senão data de build ISO curta.
7. **Notificação a todos os super_admins em `blocker`** gera uma linha por admin; assumo volume baixo.
8. Uso de `Ctrl+Shift+F` colide com "procurar em ficheiros" em alguns browsers/OS; mantenho conforme especificado mas com `preventDefault`.

## Dependências novas
**Zero.** DnD via `@hello-pangea/dnd` (já instalado), gráficos via Recharts (já instalado), datas via date-fns (já instalado), parser UA por regex próprio.

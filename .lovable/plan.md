
# Plano: Perfil de Utilizador, Atribuição de Agentes e Dashboards KPI

## 1. Base de dados (migration)

**Leads — atribuição de até 2 agentes**
- Adicionar coluna `assigned_agents uuid[]` em `public.leads` (limite lógico de 2 aplicado na UI + trigger).
- Manter `assigned_to` existente como agente principal (compatibilidade) e sincronizar com `assigned_agents[0]`.
- Índice GIN em `assigned_agents` para queries "minhas leads".
- Policy adicional: utilizador pode ler leads onde `auth.uid() = ANY(assigned_agents)`.

**Activity logs**
- Já existe `activity_logs`. Vamos usá-la para "histórico" no perfil (filtrar por `user_id`).

## 2. Atribuição de agentes na Lead (topo do LeadDetailPage)

- No header do `LeadDetailPage`, novo bloco "Agentes atribuídos":
  - Mostra até 2 avatares + nomes.
  - Botão "Editar" → popover com 2 selects (agente 1, agente 2) listando utilizadores internos (via `profiles` + `user_roles`).
  - Botão "Guardar" faz `update` em `leads.assigned_agents` e sincroniza `assigned_to`.
- Validação: máximo 2, sem duplicados.

## 3. Nova página `/profile/:userId` (e `/profile/me`)

Rota protegida. Layout com tabs:

### Tab 1 — Informações Gerais
- Foto (upload para bucket `avatars` — criar bucket público), nome, email, role(s), estado, telefone (opcional novo campo em `profiles`).
- Editável pelo próprio utilizador e por admin.

### Tab 2 — Histórico & Logs
- Lista dinâmica de `activity_logs` do utilizador (paginada, filtro por tipo e período).

### Tab 3 — Minhas Leads
- Tabela idêntica à lista de leads (`LeadsListPage`), filtrada por `assigned_agents @> [userId]`.
- Colunas: ID (link para lead), nome cliente, status, valor, data. Ordenação e pesquisa.

### Tab 4 — Dashboard KPIs
Cards + gráficos, tudo dinâmico via query em `leads` e `proposals`:
- Propostas enviadas / ganhas / perdidas / em espera (contagem)
- Volume total propostas (€) e volume confirmado (€)
- Margem média (%)
- Taxa de conversão
- Gráfico linha "propostas por mês"
- **Filtros**: período (hoje, 7d, 30d, 90d, ano, custom range), estado, destino
- **Ordenação** por qualquer coluna
- **Exportação**: botões "Export PDF" (jsPDF + autoTable) e "Export Excel" (xlsx / SheetJS)

## 4. Sidebar / Navegação
- Adicionar entrada "O Meu Perfil" no menu (link para `/profile/me`).
- Nome/avatar do utilizador no rodapé da sidebar já linka para `/profile/me`.

## 5. Super Admin Dashboard — "KPIs Equipa"
- Novo secção no dashboard principal (visível apenas a `super_admin`/`admin`):
  - Tabela com uma linha por utilizador interno.
  - Colunas: agente, propostas enviadas, ganhas, perdidas, em espera, volume total, volume confirmado, margem média, taxa conversão.
  - Mesmos filtros de período e ordenação por qualquer coluna.
  - Export PDF + Excel.
  - Cada linha clicável → abre `/profile/:userId` do agente.

## 6. Componentes reutilizáveis
- `KPICards.tsx` — cards de métricas.
- `KPIFilters.tsx` — filtros período + estado + destino.
- `KPIExport.tsx` — botões PDF/Excel usando dados atuais.
- `useUserKPIs(userId, filters)` hook — devolve todas as métricas.
- `useTeamKPIs(filters)` hook — mesmo mas agrupado por agente.

## 7. Dependências novas
- `jspdf`, `jspdf-autotable`, `xlsx` — para exportações.

## 8. Detalhes técnicos
- Fotos: bucket `avatars` público, path `${userId}/avatar.<ext>`, coluna `profiles.avatar_url`.
- KPIs calculados client-side após fetch filtrado (volume manageable) — se crescer, mover para RPC.
- Margem: usar `lead_costing_data` (campo margem) quando existir, senão `(price - cost)/price`.
- Todas as queries respeitam RLS existente; super admin já vê tudo.

## 9. Ordem de execução
1. Migration (assigned_agents, avatar_url, phone, avatars bucket)
2. Hook + UI de atribuição de agentes no LeadDetail
3. Página Profile com 4 tabs
4. Hooks de KPI + export utilities
5. Secção "KPIs Equipa" no dashboard super admin
6. Entrada de menu + sidebar

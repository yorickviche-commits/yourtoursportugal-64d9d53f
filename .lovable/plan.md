# Módulo "Relatórios" (report builder tipo FareHarbor)

## 1. O que encontrei no código atual

- **Camada de dados já existe e está visível nos tipos**: `report_fields` (47 linhas activas para `files`), `rpt_files`, `saved_reports` (10 relatórios de fábrica), `run_report(definition jsonb)` já aparecem em `src/integrations/supabase/types.ts`. Ou seja, a regeneração de tipos já está feita — não é preciso tocar no schema nem em SQL.
- **Permissões**: existem 10 linhas em `permissions` para `page:reports` / `access_financial_reports`. O acesso a páginas passa por `src/lib/pagePermissions.ts` (`PAGES`, `PageKey`, `permKey`) + `usePagePermissions()`; falta acrescentar a chave `reports`. `access_financial_reports` não é uma página, por isso será lida com um hook próprio sobre a mesma tabela `permissions` (mesma lógica de `roleCodes`), e o servidor continua a ser a verdade (o `run_report` já esconde as colunas).
- **Layout/rotas**: `App.tsx` com rotas dentro de `ProtectedRoute`, sidebar em `AppSidebar.tsx` alimentada por `PAGES`. A nova página entra no grupo "Visão Geral".
- **Drag & drop**: está instalado `@hello-pangea/dnd` (usado no Travel Planner e no kanban de feedback). Vou usar esse, **não** `dnd-kit` — evita uma dependência nova e mantém consistência.
- **Tabelas**: `@tanstack/react-table` **não** está instalado. Ver secção Riscos.
- **Formulário "Dados Gerais"**: vive dentro de `src/pages/LeadDetailPage.tsx` (1300 linhas), com estado local `formState`, `categoria`, `destino` e escrita directa nos campos legado (`destination`, `budget_level`, `sales_owner`, `comfort_level`). Os campos novos (`product_type_id`, `owner_id`, `partner_id`, `budget_tier`, `comfort_tier`, `lead_regions`) serão acrescentados num sub-componente novo para não engrossar mais esta página.
- Gráficos: `recharts` existe, mas não é preciso nesta fase (fora de âmbito).

## 2. Árvore de componentes e modelo de estado

```text
/reports  → ReportsPage
  ReportsSidebar        lista saved_reports por categoria + pesquisa + "Novo relatório"
  ReportHeader          nome, nota, menu "Relatórios guardados", Copiar link, Gerar/Cancelar
  ReportBuilder ("Avançado")
    DatesPanel          preset, from/to, eixo de datas, comparar, âmbito B2C/B2B
    FiltersPanel        lista de filtros + popover Adicionar/Editar filtro
    GroupByPanel        checkbox list + lista ordenável (handle ⋮⋮) + bucket
    ColumnsPanel        modo Resumo/Detalhe, tabs, links todos/nenhum/padrão, lista ordenável
  ReportResults
    SummaryTable (árvore + linha Totais fixa)   DetailTable (paginada)
    DetailSheet (drill-down)   CsvExportButton
```

Estado: **um único objecto `ReportDefinition`** em `ReportsPage` (`useState` + reducer leve). Cada painel recebe `definition` e `patch()`. Nada corre automaticamente; `Gerar` chama `runReport` (mutation com `AbortController`). O drag & drop reordena os arrays `group_by` e `columns[mode]`. O drill-down constrói uma definição nova em `mode: "detail"` com filtros `eq` nas chaves do grupo (e `from`/`to` personalizados para chaves de data com bucket). "Copiar link" serializa a definição em base64 no hash e a página restaura-a no arranque.

## 3. Cliente tipado

`src/types/reports.ts` (ReportDefinition, ReportField, RunReportSummary/Detail), `src/lib/reports/runReport.ts` (`supabase.rpc('run_report', { definition })`, erros do Postgres mostrados literalmente), `src/lib/reports/format.ts` (pt-PT: eur, pct, int, days, date, datetime, bool, text), hooks `useReportFields`, `useSavedReports` (+ mutações), `useFieldOptions` (enum estático / tabela / distinct sobre `rpt_files` / texto livre), `useFinancialAccess`.

## 4. Passos

- **Passo 1** — tipos e cliente, campos novos em "Dados Gerais" (Produto, Regiões multi em `lead_regions`, Vendedor, Parceiro só em B2B, Nível de orçamento, Nível de conforto; legado em bloco "Legado" só de leitura), rota `/reports` + item de menu "Relatórios", shell com lista de relatórios guardados e `Gerar` a mostrar JSON.
- **Passo 2** — builder de 4 colunas com drag & drop, gestão de relatórios guardados (novo/editar/apagar/reordenar, cópia dos de fábrica), cabeçalho, Copiar link.
- **Passo 3** — tabela de resultados (resumo em árvore com subtotais e Totais, detalhe paginado, drill-down em painel lateral, bandas de cabeçalho, comparação ano anterior com Δ %, estados de carregamento/vazio/erro/truncado, exportação CSV).
- **Passo 4** — QA dos 10 relatórios de fábrica em três períodos, verificação por SQL, perfis sales_agent/viewer, responsivo, notas no conhecimento do projecto.

Cada passo é validado por mim (browser + SQL) antes de avançar.

## 5. Riscos e pressupostos

- **TanStack Table não está instalado.** Pressuposto: instalo `@tanstack/react-table` no Passo 3 (uma dependência, ~40 kB). Se preferires zero dependências novas, faço a tabela à mão com os componentes `ui/table` já existentes — a árvore com subtotais e ROLLUP é, na prática, mais simples assim. Diz-me se queres a versão sem dependência.
- Drag & drop com `@hello-pangea/dnd` em vez de `dnd-kit` (evita dependência nova).
- `LeadDetailPage.tsx` é grande e sensível (versões, guarda de alterações): os campos novos entram num componente isolado, sem alterar a lógica de gravação existente dos campos legado.
- Ordenação de métricas "entre irmãos" em ROLLUP é a parte mais delicada do Passo 3; se derrapar, corto primeiro a ordenação por clique no cabeçalho do resumo e depois a comparação com ano anterior.
- Nunca escrevo SQL do frontend nem altero os objectos SQL existentes.

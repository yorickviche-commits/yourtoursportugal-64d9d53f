# Data (dia da semana) nos separadores de dia — Custos e Operações

Objetivo: em cada cabeçalho de dia, logo abaixo de "Dia 1", mostrar a data correspondente em português: `Segunda, 29 de outubro`.

## O que muda

### Custos
- No cabeçalho de cada dia passa a aparecer, abaixo do título, a data calculada a partir da data de início da viagem + (nº do dia − 1), no formato `Segunda, 29 de outubro`.
- Substitui a linha de data atual (que mostra o valor bruto quando existe) por este formato consistente.

### Operações
- O mesmo cabeçalho de dia ("Dia 1 — Título") ganha a segunda linha com a data no mesmo formato.
- Quando a lead não tem data de início definida, não se mostra nada (sem placeholders).

## Detalhes técnicos

- Novo helper (ex. `formatDayLabelPT(startDate, dayNumber)`) em `src/lib/utils.ts`, usando `Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })` com capitalização do dia da semana e parsing seguro de `YYYY-MM-DD` (sem desvio de fuso).
- `src/components/trip/LeadCostingEditor.tsx`: já recebe `startDate`; usar o helper no cabeçalho do dia (linha da data).
- `src/components/leads/LeadOperationsEditor.tsx`: aceitar nova prop opcional `startDate` e mostrar a data no `CollapsibleTrigger` do dia.
- `src/pages/LeadDetailPage.tsx`: passar `startDate` (mesma validação `YYYY-MM-DD` já usada em Custos) ao `OperacoesTab`/`LeadOperationsEditor`.
- Sem alterações de base de dados.

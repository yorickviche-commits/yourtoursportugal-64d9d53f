# Files — pesquisa avançada e ordenação por colunas

Renomear a página "Simulações" para **Files** e substituir a fila horizontal de estados por um sistema de filtros mais limpo, mantendo a barra de pesquisa.

## O que muda no topo da página

- Título passa a **Files** (mesma alteração no texto "Sem simulações encontradas" → "Sem files encontradas").
- Os separadores horizontais de estados são removidos.
- Fica: barra de pesquisa + botão **Pesquisa avançada** ao lado.
- Abaixo, quando há filtros ativos, aparecem pequenas etiquetas removíveis (ex.: "Estado: Budgeting ×") e um link "Limpar tudo", para se ver sempre o que está aplicado.

## Painel de Pesquisa avançada

Abre num painel lateral (no telemóvel ocupa o ecrã) com os campos:

- **Estados** — seleção múltipla, agrupada por SALES e OPS
- **Data de partida** — de / até
- **Data de chegada** — de / até
- **Data de criação da file** — de / até
- **Destino** — texto livre
- **Tipo de cliente** — B2C / B2B
- **Canal / origem da lead**
- **Agente** — responsável atribuído
- **Valor (PVP)** — mínimo / máximo
- **Margem %** — mínimo / máximo
- **Estado de pagamento** — Sem pagamentos / Parcial / Pago na totalidade
- **Nº de pax** — mínimo / máximo
- **Nº de dias** — mínimo / máximo

Botões "Aplicar" e "Limpar". Contador de resultados visível ("128 files").

## Ordenação por colunas

Todos os cabeçalhos da tabela ficam clicáveis, com seta a indicar a direção: Id, Nome, Tipo, Destino, Dias, Datas, Pax, PVP, Margem, Criação, Estado. Primeiro clique ordena ascendente, segundo descendente, terceiro volta ao padrão (criação mais recente primeiro). No telemóvel (cartões) aparece um pequeno seletor de ordenação, já que não há cabeçalhos.

## Detalhes técnicos

- Trabalho concentrado em `src/pages/LeadsFilesPage.tsx`, com dois novos componentes: `src/components/leads/LeadsAdvancedFilters.tsx` (Sheet + campos) e `src/components/leads/LeadsFilterChips.tsx`.
- Estado de filtros num único objeto `LeadFilters` mantido na página; filtragem e ordenação em `useMemo` sobre os dados já carregados por `useLeadsQuery` (sem alterações de queries no servidor).
- Estados usam `LEAD_STAGES` / `resolveStage` / `normStage` de `src/lib/leadStages.ts`; a seleção múltipla compara via `normStage`.
- PVP e margem vêm de `useLeadsCostingSummary` (já em uso na página); ordenação e filtros de valor/margem leem esse mapa.
- Estado de pagamento: novo hook `src/hooks/useLeadsPaymentsSummary.ts` que soma `lead_payments.amount` por `lead_id` para as leads listadas e classifica contra o PVP (0 = sem pagamentos, >0 e < PVP = parcial, >= PVP = pago).
- Agentes: filtra por `assigned_agents` (e `sales_owner` como fallback), opções a partir de `useInternalUsers`.
- Datepickers com o padrão shadcn Popover + Calendar já usado no projeto (`pointer-events-auto` no Calendar).
- Sem migrações de base de dados.

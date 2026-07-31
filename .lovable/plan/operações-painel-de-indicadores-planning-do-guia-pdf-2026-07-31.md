# Operações — Painel de indicadores + Planning do Guia (PDF)

Duas adições no fim do separador Operações, sem alterar a lógica de edição/gravação já existente.

## 1. Painel de análise de custos (abre/minimiza no fundo da página)

Barra fixa no fim das Operações, colapsável (fechada por defeito), com o título "Análise de Custos & Margem" e um resumo curto sempre visível (desvio total e margem real).

Indicadores (cartões):
- NET previsto (soma da coluna NET) vs Custo Real confirmado (soma de Custo Real, com fallback ao NET quando ainda não preenchido)
- Desvio absoluto e % (verde se ≤ 0, vermelho se > 0)
- PVP (total do Costing, incluindo override manual quando existe)
- Margem prevista (PVP − NET) em € e %
- Margem real (PVP − Custo Real) em € e %
- Nº de linhas já com custo real confirmado / total (cobertura dos dados)
- Alertas de margem segundo as regras do negócio: saudável > 30%, aviso 25–30%, risco < 25%

Gráficos (recharts, já disponível no projeto):
- Barras agrupadas por dia: NET vs Custo Real
- Barras horizontais do desvio por fornecedor (FSE), ordenadas pelo maior desvio
- Barra comparativa Margem prevista vs Margem real

Notas: valores só de leitura, calculados a partir do estado atual da tabela (reflete edições ainda não gravadas); em mobile os cartões passam a 2 colunas e os gráficos a largura total com altura reduzida.

## 2. Planning do Guia em PDF

Botão "Planning do Guia (PDF)" na barra "Gestão Operacional". Abre um pequeno diálogo para escolher:
- Guia/guias (campo de texto livre, um por linha) — gera uma tabela/secção por guia; se ficar vazio, gera um planning único
- Dias a incluir (todos por defeito)
- Incluir/ocultar valores (NET e Custo Real), já que muitas vezes não se envia preços ao guia

Conteúdo do PDF:
- Capa/cabeçalho: código da lead, cliente, destino, datas, nº de pax (adultos/crianças/bebés), estilo/idioma e notas gerais — os Dados Gerais organizados
- Link clicável "Programa comercial / proposta do cliente" (link público da proposta ativa da lead)
- Por dia: título do dia + link clicável "Ver rota no Google Maps" (quando existe), seguido da tabela: Hora | Atividade | FSE | Pax | Estado da Reserva | Estado do Pagamento (+ NET / Custo Real se ativado)
- Rodapé com paginação e marca Your Tours Portugal, no mesmo estilo visual dos PDFs existentes

## Detalhes técnicos

- Novo `src/components/leads/LeadOpsAnalyticsPanel.tsx` — recebe as `OpsRow[]` do estado local do editor e o total PVP; usa `Collapsible` + `recharts`; sem chamadas extra à base de dados.
- `src/components/leads/LeadOperationsEditor.tsx` — passa a receber `pvpTotal` e dados da lead por props (a página já os tem), monta o painel no fim e o botão do PDF na barra de ações.
- Novo `src/lib/guidePlanningPdf.ts` — jsPDF + jspdf-autotable (mesmas dependências usadas em `src/lib/proposalPdf.ts`), com helpers de link clicável (`textWithLink`).
- Links Google Maps por dia: vêm de `proposals.days[].map_url` da proposta mais recente da lead (é onde o `mapUrl` é persistido hoje — `lead_planner_data` não guarda mapa), emparelhados por número do dia; normalizados com `parseGoogleMapsUrl` de `src/lib/mapEmbed.ts`.
- Link do programa comercial: `public_token` da proposta ativa, via o helper de partilha já existente (`src/lib/proposalShare.ts`).
- Sem alterações de base de dados.

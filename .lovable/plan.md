# Auto-import no Costing + referência YT correta + Planning do Guia em horizontal

Três frentes independentes.

## 1. Auto-import de Costing (PDF / Excel / colar texto)

Novo botão **"Importar Custos (AI)"** na barra do separador Custos, ao lado de "Importar do Travel Planner". Abre um diálogo com três modos:
- **Colar texto** — cola-se o orçamento/tabela em texto livre
- **PDF** — upload de ficheiro PDF
- **Excel/CSV** — upload de `.xlsx`/`.xls`/`.csv`

A AI lê o conteúdo e cria automaticamente as rubricas de custo, extraindo por linha:
- Descrição da atividade/serviço
- Fornecedor (FSE)
- Nº de adultos e nº de crianças
- Se o valor é **total** ou **por pessoa** (ou por noite, quando é alojamento)
- Preço NET adulto / criança
- Margem % e PVP total

Regras de preenchimento:
- Margem por defeito **30%** sempre que o documento não indique outra
- Se o documento indicar PVP mas não margem, a margem é calculada a partir do NET e do PVP
- Campos que a AI não conseguir identificar ficam **vazios/neutros** (nº pax herda o da lead quando existir, preço fica 0, estado `neutro`)
- Se o documento tiver dias identificados, as rubricas vão para o dia correspondente; caso contrário vão todas para o Dia 1
- Linhas de alojamento identificadas vão para a secção **Alojamentos** com tipo "por noite"

Antes de gravar aparece um **ecrã de revisão**: lista das rubricas extraídas, agrupadas por dia, com aviso dos campos em falta. O agente pode editar, apagar linhas e só depois confirmar — o import adiciona às rubricas existentes (não substitui).

## 2. Referência YT nos emails de reserva e nos ficheiros

Atualmente o pedido de reserva ao FSE e o nome dos ficheiros usam a referência interna (`YT-2026-4306`). Passam a usar sempre a referência pública **YT4995** (`yt_id`):
- Assunto do email de reserva
- Corpo do email ("Booking reference")
- Nome do PDF do Planning do Guia
- Título/nome de links de pagamento e restantes textos que hoje mostram o código interno

A referência interna só continua visível no bloco Dados Gerais da lead, como ID de sistema.

## 3. Planning do Guia (PDF) — formato horizontal e uma página por dia

- PDF passa a ser gerado em **A4 horizontal (landscape)**
- **Página 1**: informações gerais da lead, contactos, notas, link do programa comercial e links/anexos
- **Uma página por dia** (page break por dia), com o título do dia, data, link Google Maps da rota e a tabela da operação
- Tabela do dia com colunas largas e legíveis, sem cortes: **Hora | Atividade | FSE / Fornecedor | Pax | Estado Reserva | Estado Pagamento | Estado Fatura** (+ NET / Custo Real quando a opção de valores está ativa)
- Texto das células com wrap (várias linhas) em vez de truncar

## Detalhes técnicos

- Nova edge function `extract-costing-data` (padrão do `extract-supplier-data`): recebe `text` ou PDF em base64, devolve JSON estruturado `{ days: [{ day, items: [...] }] }` validado com Zod; cadeia de fallback AI já usada no projeto (Lovable Gateway → Gemini → OpenAI).
- Excel/CSV parseados no cliente (`xlsx` já disponível via export de KPIs) e convertidos em texto tabular antes de enviar à AI — evita limites de payload.
- Novo `src/components/trip/CostingSmartImportDialog.tsx` com os 3 modos + revisão; devolve `LeadCostingDay[]` mapeados para `LeadCostItem` (com `calcItem` para recalcular NET/PVP/lucro) e `marginPercent` default de `BUSINESS_CONFIG.DEFAULT_MARGIN_PERCENT`.
- `src/components/trip/LeadCostingEditor.tsx`: botão + merge das rubricas importadas no estado existente.
- `src/pages/LeadDetailPage.tsx`: `LeadOperationsEditor` passa a receber `leadCode={displayLeadCode(lead)}` em vez de `lead.lead_code` (propaga para `BookingRequestDialog` e `GuidePlanningDialog`).
- `src/lib/guidePlanningPdf.ts`: `new jsPDF({ orientation: 'landscape' })`, `doc.addPage()` por dia, coluna extra de estado da fatura, `columnStyles` recalculados para a largura de 297 mm; `GuidePlanRow` ganha `invoiceLabel` e `GuidePlanningDialog` passa `INVOICE_OPTIONS`.
- Sem alterações de base de dados.

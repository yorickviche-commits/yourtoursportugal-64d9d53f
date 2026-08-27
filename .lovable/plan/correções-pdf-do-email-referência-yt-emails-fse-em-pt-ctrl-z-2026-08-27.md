# Correções: PDF do email, referência YT, emails FSE em PT, Ctrl+Z e margens em Operações

## 1. PDF anexado ao email ≠ PDF do Travel Planner

Confirmado nos ficheiros: são dois geradores diferentes.

- Travel Planner (botão "PDF") faz `window.print()` sobre o DOM já renderizado (`TravelPlanProposal.tsx`, `handlePrintPdf`) — logo o PDF é exatamente o que se vê no ecrã.
- Emails (`EmailComposerDialog.tsx` e `CommunicationsWorkspace.tsx`) chamam `buildProposalPdfBase64` em `src/lib/proposalPdf.ts`, um documento construído à mão com jsPDF — layout, capa, imagens e secções diferentes.

Solução: passar a ter uma única fonte de verdade para o PDF.

- Criar uma edge function `proposal-pdf` que abre a página pública da proposta (mesma rota/HTML que o cliente vê) e a imprime para PDF, devolvendo base64.
- `buildProposalPdfBase64` passa a invocar essa função e devolve o PDF resultante, mantendo a mesma assinatura para não alterar os dois call sites nem o nome do ficheiro ("YT#### - Cliente - Programa - Datas").
- Manter o gerador jsPDF atual apenas como fallback caso a função falhe, para nunca bloquear o envio de email.

Resultado: o anexo passa a ser byte-a-byte o mesmo documento do itinerário digital / Travel Planner.

## 2. Referência interna a aparecer fora dos Dados Gerais

A ref interna (`lead_code`, ex. `YT-2026-4249`) só deve existir no campo de sistema em Dados Gerais. Restantes pontos passam a usar sempre o YT id.

- `TravelPlanProposal.tsx` linha 1362 (bloco de planning técnico) mostra `File ID: {leadCode}` — passa a mostrar `ytId || leadCode`.
- `LeadDetailPage.tsx` linha 944 passa `leadCode={lead.lead_code}` ao Travel Planner — passa a passar o YT id (como já é feito para Costing e Operações), mantendo o `lead_code` apenas onde é chave de gravação/token.
- Varrimento final por `lead_code` em componentes de UI para garantir que nenhuma vista, PDF ou email o mostra.

## 3. Emails para FSE em português + assunto padronizado + apoio AI

Em `BookingRequestDialog.tsx`:

- Assunto por defeito: `YT#### · <Nome FSE> · <Data> · Pedido de Reserva`.
- Corpo por defeito em português (tratamento formal, tom "founder style"), com Serviço, Data, Hora, Nº de pessoas, Valor e Referência YT, e assinatura Your Tours Portugal / reservas@yourtours.pt.
- Novo botão "AI — Compor" no cabeçalho do editor, que gera/reescreve o corpo em PT via a chain de AI já existente, com um seletor de sugestões de prompt relevantes: pedido de disponibilidade, confirmação de reserva, alteração de horário, alteração de pax, pedido de tarifa net, reconfirmação a 48h, pedido de fatura.
- O texto gerado entra no editor e continua totalmente editável antes de enviar.

## 4. Ctrl+Z nas Operações

Confirmado: `LeadOperationsEditor.tsx` usa `useState` simples para `rows` — o hook `useUndoable` não está ligado, por isso nenhuma ação (incluindo apagar linha) é reversível.

- Ligar `rows` ao `useUndoable` com `bindKeyboard: true`.
- `updateRow`, `addRow`, `removeRow` passam a escrever pelo `set` (uma entrada de histórico por ação); a hidratação inicial usa `reset` para não poluir o histórico.
- Ao desfazer uma remoção, a chave é também retirada de `deletedKeys` para que a gravação não apague a linha restaurada.
- Indicador discreto "Ctrl+Z para desfazer" no cabeçalho de Operações.

## 5. Custo real vs orçamento e margens

Em `LeadOperationsEditor.tsx`:

- `overBudget` exige hoje `netValue > 0`, por isso uma linha não orçamentada (NET 0) com custo real fica verde. Passa a: qualquer custo real acima do NET previsto é vermelho, incluindo NET 0. NET 0 com custo real 0 fica neutro.

Em `LeadOpsAnalyticsPanel.tsx`:

- Validar e corrigir a base dos cálculos: desvio = custo real − NET previsto (com NET 0 tratado como desvio total, não como 0%), e desvio % só apresentado quando existe NET previsto.
- Margens passam a ser explicitamente margem bruta sobre PVP (`(PVP − custo) / PVP`), com rótulos claros "sobre PVP", alinhando os semáforos com os limiares do negócio (>30% saudável, 25–30% aviso, <25% risco).
- Adicionar linha de leitura rápida com NET previsto, custo real, extras não orçamentados (soma das linhas com NET 0 e custo real > 0) e margem final.

## Notas técnicas

Ficheiros afetados: `src/lib/proposalPdf.ts`, nova função `supabase/functions/proposal-pdf/index.ts`, `src/components/trip/TravelPlanProposal.tsx`, `src/pages/LeadDetailPage.tsx`, `src/components/trip/BookingRequestDialog.tsx`, `src/components/leads/LeadOperationsEditor.tsx`, `src/components/leads/LeadOpsAnalyticsPanel.tsx`. Sem alterações de schema.

# Lote 1 — Precisa de ti

**Estado:** construído em preview, sem publicação. Fecho automático continua desativado até confirmação humana em **Fechar todos**. Custos e o processo existente de execução das aprovações não foram alterados.

## 1. O que foi criado

- `decisions`: índice protegido das decisões, com deduplicação, origem, file, área, motivo, preparação, verificação, estado, adiamento e atribuição humana.
- `decision_sources`: preserva as ligações de todas as origens, incluindo duplicados representados por um só cartão.
- `decisions_control`: guarda a confirmação inicial e a última reconciliação.
- `decision_events`: histórico das decisões humanas e dos fechos automáticos.
- `sync_decision_source`, `decision_close_candidate`, `reconcile_decisions`, `decision_action`, `resume_decision`, `activate_decision_auto_close` e funções auxiliares de acesso/data/notificação.
- Triggers nas origens AI, alertas, finanças e tarefas; eventos de estado/datas/remoção da file, pagamentos, reservas e resposta da thread; notificação privada sem conteúdo dos registos.
- Job `cockpit-decisions-hourly`, de hora a hora: 24 verificações por dia, até 60 minutos para regras dependentes apenas da passagem do tempo. Alterações relevantes disparam também a reconciliação. Há custo recorrente de Cloud mesmo quando não encontra trabalho.
- `DecisionsQueue` no topo do Cockpit: agrupamento por file, ordenação por viagem/idade, filtros com contadores, preparação expansível, revisão individual/em grupo, edição, adiamento, simulação, histórico de sete dias e reabertura.
- `LearningDrafts` em Admin → Aprendizagem: 10 propostas históricas do learning loop, fora do Cockpit e sem execução nova.
- `useDecisions` e helpers/testes partilhados.

### Ficheiros principais

Migrations aplicadas:

1. `0048_cockpit_decision_index.sql`
2. `0049_decision_reconciliation_safety.sql`
3. `0050_decision_payment_match_qualification.sql`
4. `0051_decision_finish_date_precedence.sql`

Interface/regras:

- `src/components/workbench/DecisionsQueue.tsx`
- `src/hooks/useDecisions.ts`
- `src/lib/decisions.ts`
- `src/lib/decisions.test.ts`
- `src/lib/decisions.test.sql`
- `src/components/admin/LearningDrafts.tsx`
- `src/pages/AdminSettingsPage.tsx`
- `src/pages/WorkbenchPage.tsx`
- `src/components/ai-approvals/AiApprovalsList.tsx`: apenas exporta o executor existente, para reutilização; o seu comportamento não mudou.
- Tipos gerados, `AGENTS.md` e `roadmap.md`.

## 2. Números da simulação

Consulta final durante a validação, em 24/11/2026:

| Área | Cartões abertos |
|---|---:|
| Vendas | 40 |
| Operações | 48 |
| Finanças | 0 |
| Gerência | 0 |
| **Total** | **88** |

| Regra | Candidatos a fecho |
|---|---:|
| Viagem terminada antes de hoje | 17 |
| File arquivada/perdida/cancelada | 1 |
| Linhas FSE já enviadas/reservadas | 7 |
| Pagamento registado suficiente | 0 |
| Resposta com thread/snapshot comprovados | 0 |
| **Total** | **25** |

**Fechados pela simulação: 0. Ativação automática: false.**

O primeiro retrato tinha 89 cartões e 26 candidatos (41 Vendas/48 Operações; dois candidatos por file inativa). Um alerta mudou entretanto na origem; a fila refletiu essa alteração. Os dados reais continuam a mudar, por isso não se deve tratar estas contagens como um total fixo.

O índice inicial guardou 89 ligações de origem: 14 AI, 37 alertas e 38 tarefas elegíveis. Tarefas sem file ou sem prazo não entram; o ledger antigo e os drafts de aprendizagem não entram. Não foi eliminada nenhuma linha pelo lote.

## 3. Regras e segurança verificadas

- Simulação identifica candidatos sem modificar o estado das origens.
- Hoje não é passado; a data de fim prevalece sobre o início, incluindo o campo antigo de fim em Dados Gerais.
- Pagamentos solicitados não contam como recebidos; os dois espelhos de pagamentos não são somados entre si; reembolsos reduzem a cobertura.
- FSE exige correspondência exata de operação ou de todas as linhas, não uma suposição por fornecedor.
- Tarefas órfãs/sem data são excluídas; tarefas iguais apontam para um cartão único.
- Revisão humana atualiza as origens com atribuição e respeita os seus guardas existentes; agentes não podem decidir.
- Fecho automático altera apenas o índice, nunca aprova, envia emails, cria links ou executa finanças.
- Reabrir preserva o cartão durante 24 horas antes de voltar a aplicar a condição automática.
- A página Aprovações AI continua a existir e a consultar as mesmas origens.

## 4. Testes executados

- **43 testes** de decisões, CRM e âmbito/regras do Cockpit passaram.
- Teste transacional completo passou: simulação, datas, perda, pagamentos, reembolsos, FSE, exclusões, deduplicação, adiamento, atribuição humana, ativação/reabertura e preservação. Tudo revertido no fim.
- Teste adicional da data de fim antiga passou; a viagem em curso não foi candidata e a viagem terminada foi.
- Teste autenticado: adiar uma tarefa, recarregar, confirmar persistência e retomar. A tarefa original manteve `completed=false` e o seu estado original. Apenas ficaram os eventos auditáveis de adiamento/retoma.
- Duas abas: a segunda recebeu o adiamento e a primeira recebeu a retoma, sem recarregar.
- 390×844, 360×780 e 1440px: sem transbordo horizontal; controlos e confirmações inspecionados.
- Aprovar/rejeitar/ativar: confirmações abertas e canceladas; **nenhum email enviado, link criado ou fecho real ativado** durante os testes.
- Admin → Aprendizagem confirmou as 10 propostas.
- Último sinal de compilação disponível: `build OK`.

## 5. O que falta ou não pôde ser comprovado

1. **Fecho por resposta dos alertas antigos:** a origem não guarda a thread exata nem a fotografia anterior de quem tinha a bola. A regra existe para cartões com essas referências, mas não é seguro inferi-las nos antigos. Ficam pendentes até fornecer ligação/histórico comprovados; esta parte não está operacional para os alertas sem referência.
2. **Emails antigos incompletos:** há pedidos FSE sem destinatário. São mostrados como incompletos e não podem ser enviados antes de editar o destinatário; não foram inventados endereços.
3. **Última corrida do Orquestrador:** não foram encontrados registos identificados como Orquestrador nas duas origens indicadas. A interface mostra “não registada”, em vez de atribuir essa execução a outro agente.
4. **Finanças:** não existe lote pendente real para verificar a validação completa pela interface; acesso/guardas existentes foram preservados.
5. **Execução externa:** envio/criação de pagamento não foi exercitado num cliente real. Foi reutilizado o executor da página Aprovações AI sem alterar a sua lógica.
6. O texto “verificado” refere-se a dados do **TCC**. Não foram realizadas novas consultas diretas ao Calendar ou ao NetHunt; não se apresenta uma verificação remota que não ocorreu.

## 6. Créditos

A consulta de consumo registado deste projeto no intervalo **24/11/2026, 09:00–11:00 UTC** devolveu **14,8556 créditos**:

- Construção: cerca de **14,70**.
- Cloud compute: **0,1548**.
- Funções/transferências: cerca de **0,0008**.

Este é o consumo registado na janela consultada, não uma medição exclusiva e definitiva deste pedido: inclui atividade Cloud simultânea e pode não incluir ainda o débito final da resposta. Não se publica nem se ativa a limpeza automaticamente.
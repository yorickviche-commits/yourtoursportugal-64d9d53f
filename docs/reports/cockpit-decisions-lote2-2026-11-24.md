# Precisa de ti — Lote 2

## Resultado

Parte A implementada; B e C adiadas para respeitar o orçamento. Não publicado, sem alterações nos Custos nem eliminação de linhas. Apenas a função `execute-decision` foi disponibilizada no Cloud; mudanças na base de dados são partilhadas com a aplicação publicada.

- Execução imediata FSE pela caixa configurada de Operações, validada contra o perfil Gmail; pagamentos usam o endpoint WeTravel existente.
- Emails de clientes aprovados ficam para o dia seguinte às 08:00 Europe/Lisbon; envio imediato exige clique humano explícito. Cancelamento só antes da reserva de execução.
- Edição conserva o payload original e guarda `payload_approved`; o executor envia essa versão.
- Reserva transacional por cartão/origem impede dupla execução por dois separadores. Entrega incerta não é automaticamente repetida: exige verificar Enviados/WeTravel. O botão de repetição só consegue executar quando a reserva permite uma tentativa segura.
- Tarefas/alertas aprovados passam a tratados/concluídos com cartão executado. Resultados/falhas, hora, ligação e atribuição registados em `workbench_auto_log` e `decision_events`.
- Emails agendados e resultados recentes ficam visíveis; falhas aparecem antes das files abertas.
- Duas verificações diárias (07:00 e 08:00 UTC); só a correspondente às 08:00 de Lisboa despacha os emails vencidos, até 500 por corrida. Sem verificação por minuto; há custo recorrente mínimo de duas consultas diárias. A entrega depende da disponibilidade do serviço, sem garantia de segundo exato ou repetição automática após falha da chamada agendada.

## Ponto 0

- **Carter:** `decided_by=7f1618c9-9083-4706-bbcc-387c553471e4`, perfil Yorick Viche; aprovação às 10:34:42 UTC. Task de origem `67ffb4b3-9a42-43ed-a5d0-84670f56d8a5`: `completed=true`, `status=done`. Não alterada.
- **YT5124:** cartão `eaff41f1-85ce-496c-a9bb-2117af3b3ecd`, alerta `5cfe34af-019e-4644-b8e0-c2cf86803a77`, `handled_at=10:27:12.890 UTC`, sem `handled_by`, sem `decided_by` e sem evento humano. Os registos disponíveis não permitem provar se foi um teste anterior; não foi reposto por suposição. Esta atribuição fica por confirmar.

## Testes de facto

- 6 testes unitários passaram.
- Testes transacionais, revertidos: inverno/verão/mudança de hora, preservação do original e versão editada, agendamento, bloqueio de envio antecipado, aprovação repetida, reserva repetida, cancelamento bloqueado após reserva, resultado/auditoria, conclusão de task e acesso sem sessão.
- Playwright autenticado como Yorick: email fictício numa file técnica isolada, editar assunto/corpo, aprovar, observar `25/11/26, 08:00`, cancelar e recarregar. Read-back confirmou origem `approved` com execução `cancelled`, cartão `rejected`, agendamento nulo e `executed_at` nulo. File técnica arquivada; registos preservados; nenhum email enviado. Desktop sem overflow nem erros de execução.
- Tentativas a 390px foram interrompidas pela apresentação inicial e sobreposições; não se afirma validação completa móvel.
- Último sinal de compilação: `build OK`. Deploy de `execute-decision` confirmado.
- Não testados: envio real Gmail, criação real de link WeTravel, disparo real às 08:00, lote misto real e concorrência externa no fornecedor. Reserva duplicada foi testada transacionalmente, não por dois envios reais.

## B e C fora deste lote

Nenhuma ferramenta MCP nova foi criada ou alterada; nenhum manifest ou servidor MCP foi atualizado. Pendentes: `list_decisions`, `propose_decision`, `touch_decision`, `list_decision_updates`, `apply_human_decision`, respetivos parâmetros, permissões e relay seguro. Ferramentas antigas preservadas.

### Ajuste confirmado pelo Yorick — só aprovação humana (24/11)

- `client_email`, `payment_link` e `finance_item` estão protegidos no servidor, não apenas na interface. `is_cockpit_human()` exige sessão autenticada interna, não associada a chave de agente, sem claims de cliente OAuth `client_id` ou `azp`. Uma sessão MCP do próprio Yorick também é recusada.
- `decision_action`, a sua função interna e `claim_decision_execution` verificam esta restrição, com erro «Este cartão só pode ser aprovado por um humano no Cockpit» e ligação `/cockpit#decision-<id>`.
- Triggers em `decisions`, `ai_action_queue` e `finance_batch_items` bloqueiam aprovação/execução por agentes/MCP, incluindo alterações diretas, mudança de tipo para contornar a restrição, itens já aprovados e alteração da versão aprovada. Políticas restritivas de escrita em AI/Finanças complementam os guards; os agentes continuam a propor itens pendentes.
- O executor interno mantém a execução de emails previamente aprovados por humanos. Antes de reservar uma execução protegida, confirma o autor/data da aprovação; uma reserva sem aprovação humana é recusada. Agendamento para amanhã às 08:00 de Lisboa, «Enviar já» e «Cancelar envio» permanecem.
- Os cartões destes três tipos mostram «só aprovação humana».
- **Efeito deliberado nas ferramentas antigas:** `mark_finance_item_executed` deixa de poder marcar itens executados quando chamada por agente/MCP, mesmo após aprovação humana; a nova regra do Yorick prevalece sobre essa permissão anterior. O executor interno autorizado continua permitido.
- **MCP B continua pendente:** `apply_human_decision` não existe neste lote e não foi criada neste ajuste. Quando for implementada, o relay será exclusivamente para `fse_email`, `alert` e `task`; jamais clientes/dinheiro, mesmo com citação humana. Nenhum servidor MCP/manifest foi alterado ou publicado.

**Testes efetivamente executados:** transação revertida com os três kinds, identidade real de agente existente e identidade do Yorick com claims MCP `client_id`/`azp`; tentativas via RPC, função interna, escrita direta nos cartões/origens e execução pós-aprovação foram recusadas. Aprovação humana nos três kinds passou. Políticas verificadas sob o papel `authenticated`: nenhuma linha aprovada ficou alterável pelo MCP. Teste adicional confirmou recusa de reserva sem revisão humana e aceitação de reserva/resultado pelo executor interno após aprovação, sem chamada ao Gmail/WeTravel. Zero leads `AUTH-ROLLBACK-*` permaneceram. Os testes ficam em `src/lib/decisionAuthorization.test.sql` para execução pela ligação privilegiada (não pela ligação restrita do terminal).

Playwright autenticado como Yorick a 390×844 e 1440×1000 confirmou cinco cartões protegidos com a etiqueta, botões disponíveis para o humano, sem overflow ou erros de execução; não se clicou em aprovações reais. Os seis testes unitários existentes da fila passaram. Não testados neste ajuste: chave secreta real via endpoint MCP, chamada real à ferramenta ainda inexistente `apply_human_decision`, envio real e disparo do cron às 08:00. A verificação de autorização exercita diretamente os claims/identidades que chegam ao servidor, sem inventar ou expor tokens.

Ficheiros adicionais: migrations `0055_cockpit_only_client_money_authorization.sql` e `0056_protected_execution_requires_human_review.sql`, teste de autorização, etiqueta na fila, regras de arquitetura e roadmap; tipos/journal/snapshots gerados pelas migrations. Não se apagaram linhas nem se alteraram Custos. As proteções na base de dados são partilhadas com a aplicação publicada, mas a interface continua apenas em preview.

Pendentes em C: cartão do auto-log agrupado e revisão móvel dedicada. Admin → Aprendizagem já existia desde Lote 1, sem alteração neste lote.

## Ficheiros

Migrations `0052_decision_execution_claim_schedule.sql`, `0053_decision_scheduler_and_approved_snapshot.sql`, `0054_decision_execution_alias_sync_fix.sql`; `execute-decision/index.ts`, `_shared/decision-email.ts`, `src/lib/decisionExecution.ts`, `src/lib/decisionExecution.test.sql`, fila, hook e lista de Aprovações AI; tipos gerados, roadmap e regra de arquitetura.

## Consumo

Consumo registado na janela deste projeto **10:53–11:05 UTC: 8,90 créditos**, antes do débito final da resposta. Não é uma medição definitiva/exclusiva; pode ter atraso de contabilização. B e C foram interrompidas antes de começar para não exceder deliberadamente o teto de 10.
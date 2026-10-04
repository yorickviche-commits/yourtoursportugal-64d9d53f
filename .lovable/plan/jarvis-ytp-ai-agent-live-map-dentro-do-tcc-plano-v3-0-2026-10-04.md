# JARVIS — YTP AI Agent Live Map dentro do TCC (Plano v3.0)

## Análise rápida do documento
- Estrutura boa: Departamento → Agente → Tarefa → Ferramenta → Skill, com escada N0–N3 e tetos por tipo de ação.
- Já temos no TCC: fila "Aprovações AI", chaves `ytp_agent_`, modo proposta (versões "Proposta AI"), MCP com ~33 ferramentas. Falta o registo e o mapa.
- Otimizações propostas:
  1. Um só registo (cartões) alimenta Spark, contadores e escalonamento — nada escrito à mão no ecrã.
  2. Teto por tipo de ação aplicado na base de dados: nenhum agente ultrapassa o teto, mesmo que o cartão diga o contrário.
  3. Subida de nível só com evidência (nº execuções sem correção) e aprovação do Yorick, nunca automática.
  4. Silêncio nunca aprova: prazo → substituto → aviso a A0.
  5. Primeiro resultado já útil: "Verificação de amanhã" (serviços D+1 vs guia, transporte, FSE, pax) gera tarefas com dono.
  6. Pendentes do documento (titulares, alçadas, gate 8.000 €) ficam como campos editáveis, não codificados.

## Fase 1 — Registo e mapa (esta entrega)
- Tabelas: departamentos, agentes (IA/humano, pai, titular, substituto), tarefas-cartão (código T#.#, estado, nível, teto, skill, cadência, SOP), ligação tarefa↔ferramenta, execuções (agent_runs).
- Carregar as 48 tarefas, 8 agentes e titulares propostos do PDF.
- Página Spark (`/agents/dashboard`) substituída pelo **JARVIS Live Map**:
  - Centro: mapa vivo clicável com estado por nó (a correr, à espera, falhou, parado, feito hoje) e contadores.
  - Filtros: departamento, estado, "só o que precisa de mim".
  - Painel lateral: cartão da tarefa, itens YT#### em curso, histórico; editar nível/titular (só admin).
  - Fila de aprovações: reutiliza "Aprovações AI", ordenada por serviços nas próximas 48 h e por titular; aprovação em lote.
- Mobile: lista em cartões por agente em vez do mapa.

## Fase 2 — Escada viva (a seguir)
- Passos por stage (ex.: Deposit Received) ligados: aprovar cria o passo seguinte.
- "Devolver com nota" ao bot; prazo e escalonamento ao substituto.
- Verificação diária D+1 como primeira rotina.

## Fase 3 — Interativo (JARVIS conversa)
- O assistente lateral passa a ler o registo: "o que precisa de mim hoje?", "porque falhou T3.2?", aprovar por comando com confirmação.

## Fora de âmbito
Quinta da Roda, YT Ibiza, envios automáticos, WhatsApp, ativação de integrações novas.

## Detalhes técnicos
- Migração com RLS + GRANTs (authenticated, service_role); escrita de cartões só admin; `agent_runs` escrita por service_role/agentes.
- Trigger que impede `nivel_atual > teto`.
- Gateway `mcp-agent` regista cada chamada em `agent_runs` (tarefa, lead, resultado).
- Estado em tempo real via Realtime nas execuções e fila.
- Mapa com SVG/flex em árvore leve, sem bibliotecas pesadas.

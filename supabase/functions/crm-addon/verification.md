# Validação — 24 novembro 2026

## Âmbito

- Apenas código de `crm-addon`, helper exclusivo `details.ts` e testes; nenhuma função partilhada, frontend ou sincronização alterada.
- Migration `0058_crm_addon_event_details_search_cache.sql`: sete colunas autorizadas em `calendar_events`, três em `calendar_event_links`, três índices trigram em `leads`.
- Campos anteriores mantidos. Candidatos/pesquisa são leves, com `lightweight=true`; dados caros não carregados aparecem como null/listas vazias e são obtidos pela ação `lead`.
- `timeline_url` igual a `tcc_url`, sem inventar uma vista inexistente.

## Testes

`deno test --node-modules-dir=auto --allow-env --allow-net supabase/functions/crm-addon/index_test.ts supabase/functions/crm-addon/details_test.ts`

16 testes passaram, incluindo o teste autenticado existente YT5057. Cobertura nova: classificação exata de emails CLIENTE/FSE/interno/other, destinatário FSE prioritário, truncagem a 1500, eventos com detalhes/ISO/HTML removido, abertura de mensagem já ligada sem rede/escritas, upsert de uma mensagem sem Gmail e proteção de unlink manual, consultas diretas por YT/Bókun/email/domínio, pesquisa exata leve, cache fresco e recuperação em falha Calendar.

## Leituras reais YT5148

- `info@ogotours.com` existe em `suppliers.contact_email`: OgoTours Madrid.
- Quatro emails nas páginas consultadas têm `party=fse` e `party_name=OgoTours Madrid`, incluindo recebidos e enviados. Não estavam na primeira página de 25 itens; foram encontrados na paginação.
- Nove eventos devolvem título Google real, início/fim ISO, local, descrição (532–1424 caracteres) e ligação Google Calendar.
- Eventos são all-day: início à meia-noite e fim exclusivo, sem inventar horário de serviço.
- Zero gravações, tentativas de gravação e chamadas Gmail durante a verificação real. Leituras Calendar apenas; gravação de cache explicitamente desativada nesse teste.

## Tempos antes/depois

Milissegundos, três execuções por caminho com os mesmos dados reais e sessão TCC; código anterior guardado antes das alterações e executado em modo read-only. Cada abertura usa um objeto de pedido independente, incluindo o mapa de fornecedores por pedido. São medições dos handlers, não do cliente Apps Script nem de autenticação Google. Add-on novo com isolate aquecido após a leitura inicial de eventos.

| Caminho | Antes (3 medições) | Depois (3 medições) | Mediana antes → depois |
|---|---|---|---|
| Email já ligado | 263 / 212 / 182 | 185 / 190 / 218 | 212 → 190 ms |
| Email sem ligação (email real, sem referência automática) | 338 / 414 / 300 | 116 / 124 / 140 | 338 → 124 ms |
| Search YT5148 | 138 / 145 / 148 | 66 / 47 / 44 | 145 → 47 ms |

Neste ensaio final, o caminho ligado melhorou ~10%, sem ligação ~63% e pesquisa ~68%. Uma medição anterior do caminho ligado variou de 207 para 234ms; não há garantia de melhoria constante nesse caminho, que agora entrega também detalhes Calendar e classificação. Uma abertura fria exige leituras dos eventos; com cache persistido/fresco ou memória do isolate evita-as.

## Limitações verificadas

- Só `calendar_events` recebeu `details_synced_at`, conforme as colunas autorizadas. `calendar_event_links` guarda os detalhes na base mas a idade de seis horas é mantida na memória do isolate: após reinício pode repetir o GET. Garantir TTL persistente também nestas ligações exigiria autorizar uma coluna adicional; não foi adicionada.
- Não havia token Google emitido pelo Apps Script para testar uma abertura real dentro do Gmail; a validação autenticada usou os handlers com a sessão autorizada do Yorick. Validação de assinatura, audiência Google, domínio e utilizadores manteve-se no endpoint.
- Deploy executado apenas para `crm-addon`; aplicação não publicada.
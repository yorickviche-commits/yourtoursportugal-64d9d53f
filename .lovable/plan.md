# JARVIS no TCC — Passo 1: /jarvis idêntico + GET /jarvis/live em leitura real

Âmbito: apenas ecrã + leitura. Sem outbox, assistant, run nem cycle (os botões ficam visíveis, mas respondem "ainda não disponível" em vez de simularem). Nada é enviado nem muda no NetHunt.

## 1. Onde vivem os ficheiros e como /jarvis fica protegido

- `public/jarvis/index.html` = `jarvis-orchestrator.dc.html` com só estas remoções: modo DEMO 45 s, "copiar outbox para o chat", `SEEDD`, emails em `SEM`, `buildDeals`, fallback `./data/jarvis-live.json`. Sem snapshot inline. Markup, CSS e comportamento restantes ficam iguais.
- `public/jarvis/jarvis-support.js` tal e qual (já não contém dados de clientes).
- `public/jarvis/assets/spark-portugal-robot.png` (caminho relativo que o HTML espera).
- `public/` não tem dados nenhuns: o HTML sozinho, sem token, só mostra o estado de erro "Sem ligação ao TCC".
- Página React `src/pages/JarvisPage.tsx` em `/jarvis`, dentro de `ProtectedRoute` (utilizador interno) e fora do `AppLayout` (ecrã inteiro, sem sidebar). Contém um iframe 100vw/100vh para `/jarvis/index.html` e um botão discreto "← TCC".
- Nova chave de página `jarvis` na matriz de permissões (admins sempre; outros papéis conforme Admin › Permissões).
- Simulação desligada: se `/jarvis/live` falhar, toast + estado de erro; nunca números inventados. Abrir `/jarvis/index.html` diretamente sem sessão = ecrã vazio com erro.
- `/agents/dashboard` (Live Map atual) mantém-se até validarmos; link da sidebar "JARVIS" passa a apontar para `/jarvis`.

## 2. Token da sessão para o tweak apiKey

- A página React lê a sessão (`useAuth`) e envia ao iframe por `postMessage` (origem fixa, a mesma da app): `{ type: 'jarvis:config', apiBase: <URL backend>/functions/v1, apiKey: access_token, tccOrigin }`.
- Reenvia em cada `TOKEN_REFRESHED`/`SIGNED_IN`; em `SIGNED_OUT` envia token vazio e o iframe fica em erro.
- No HTML: pequeno ouvinte (única adição) que valida `event.origin` e grava os valores nos tweaks `apiBase`/`apiKey` em memória — nunca em localStorage nem no ficheiro. O ecrã só arranca o primeiro fetch depois de receber a config.
- O ecrã já envia `Authorization: Bearer <apiKey>`; a função valida com `requireInternalUser`.

## 3. Edge function `jarvis` — GET /jarvis/live

Uma função com router por caminho (`/live` agora; restantes devolvem 501). Leitura com o JWT do utilizador (RLS normal). Archive (idx 3 e 10) excluído da contagem de ativas mas devolvido.

### Mapeamento campo a campo

| Campo | Fonte TCC | Falta |
|---|---|---|
| `meta.syncedAt` | `max(leads.nethunt_synced_at)` | — |
| `meta.folderId` / `stageField` | constantes `67bf55d488a689554e6a1c22` / `2` | — |
| `meta.nethuntRecordUrl` | template `…/folder/{folder}/record/{recordId}` | — |
| `meta.gmailSearchUrl` / `calendarSearchUrl` | templates fixos (pesquisa por YT####) | — |
| `meta.tccUrl` | `https://yourtoursportugal.lovable.app/open/{ref}` | rota `/open/:ref` (secção 5) |
| `meta.stages[11]` | `nethunt_stage_codes` (ordem) | confirmar que os 11 presets exatos lá estão; senão constante |
| `deals[].recordId` | `leads.nethunt_record_id` | leads sem record NetHunt: omitir ou mostrar? (pergunta) |
| `deals[].ref` | `leads.yt_id` → fallback `lead_code` | — |
| `deals[].name` | `leads.client_name` (+ destino) | — |
| `deals[].stageIdx` | `leads.nethunt_stage` → índice 0–10 por label | normalizar espaços duplos |
| `tripStartMs` / `tripFinishMs` | `leads.trip_start` / `trip_finish` (fallback `travel_dates`/`travel_end_date`) | — |
| `valueEUR` | `leads.estimated_value` (fallback `pvp_override`) | confirmar campo `84` está a ser espelhado |
| `lastInMs` | último `nethunt_timeline` tipo email recebido | NetHunt campo `41` não espelhado — usar timeline |
| `lastOutMs` | max(timeline email enviado, `booking_emails_log.sent_at`) | idem campo `43` |
| `daysOnStage` | hoje − `lead_stage_history.entered_at` mais recente | — |
| `emails{ref}` | `leads.email` | — |
| `threads{ref}` | `nethunt_timeline` último email (subject, snippet, creator) | **sem Gmail thread id/message id** → `id`/`lastMsgId` null; reply/forward no passo 2 |
| `calendar{ref}` | `calendar_events` (+ `calendar_event_snapshots.summary`) por `lead_id` | só eventos criados pelo TCC; os manuais com "Ref. Interna" não estão cá |
| `actions[]` | `ai_action_queue` com `status='pending'` + novas colunas | colunas abaixo |
| feed | `agent_runs` últimos 50 (Realtime no passo 4) | incluído em `/live` como `feed` opcional |

### Colunas a acrescentar à `ai_action_queue` (todas nullable, sem mexer nas existentes)

`sev text` (URGENTE/MÉDIA/BAIXA), `deadline_label text`, `rec text`, `from_addr text`, `to_addr text`, `cc text`, `subject text`, `html text`, `reply_thread_id text`, `reply_message_id text`, `forward_message_id text`, `follow_days int`, `after_stage_idx int`, `stage_idx int`, `step_idx int`, `record_id text`, `gmail_message_id text`, `decided_at timestamptz`. `title` já existe. Novo `type` aceite: `jarvis_email`. `/agents/approvals` continua a ler a mesma tabela.

### Única tabela nova (+ definição dos itens)

- `jarvis_checklist_items` (definição, editável por admin): `stage_idx`, `step_idx`, `label`, `kind` ('AI'|'APROV'), `active`, ordem. Seed com os itens do HANDOFF §5 (10 fases, 38 itens; Archive sem ações).
- `jarvis_checklist` (estado): `id`, `lead_id`, `record_id`, `stage_idx`, `step_idx`, `done bool`, `done_by` ('AI'|'human'), `done_at`, `evidence`, único por (lead, stage, step).
- Ambas com RLS (leitura interna; escrita admin na definição; escrita estado por service_role/humanos internos), grants a `authenticated` e `service_role`, sem `anon`.
- `/live` usa-as para a saúde de cada file (vermelho/amarelo/verde). Sem campo no NetHunt.

## 4. Fluxo

```text
/jarvis (React, protegido) --postMessage(token)--> iframe /jarvis/index.html
iframe --GET Bearer token--> functions/v1/jarvis/live --RLS--> leads, timeline, calendar, ai_action_queue, checklist, agent_runs
```

## 5. Rota /open/:ref

- `/open/:ref` protegida; procura `leads` por `yt_id` ou `lead_code` (normaliza "YT4946"/"YT-2026-…"), redireciona para `/leads/<uuid>`; se não existir, mensagem "File não encontrada" com pesquisa.
- Funciona após login (preserva o destino no redirect para `/login`).

## 6. Validação

- Lado a lado com o protótipo/screenshot: cérebro radial, zoom/pan, popover, lista, filtros, editor, CLAUD.IO, toasts.
- Contagem de files ativas ≈ 106 vs NetHunt; amostra de 10 files (fase, datas, valor, último email).
- Sem sessão: `/jarvis/index.html` mostra só erro; nenhum dado de cliente em `public/`.

## Riscos

- O protótipo `.dc.html` (143 KB, conteúdo codificado) pode ter o runtime de tweaks embebido; se não aceitar config externa sem tocar no runtime, a adição do ouvinte é a única alteração — se nem isso for possível, Opção B (precisarei dos `template.html`/`logic.js`).
- Iframe e cabeçalhos: confirmar que o hosting não bloqueia iframe da mesma origem.
- `lastIn/lastOut` e threads dependem do que a timeline NetHunt já capturou; files sem emails registados aparecem "sem dados" (vermelho).
- Calendário só cobre eventos geridos pelo TCC.
- Rotas `/jarvis/*` em `public/` e `/jarvis` em React: o iframe usa `/jarvis/index.html` explícito para não colidir.

## Perguntas antes de implementar

1. Leads sem record NetHunt (só no TCC): aparecem no Jarvis ou ficam de fora?
2. Quem tem acesso a `/jarvis`: todos os internos ou só admin/ops/sales?
3. `/agents/dashboard` (Live Map atual): manter, ou substituir por redireção para `/jarvis` depois de validado?
4. Valor da file: usar o valor do NetHunt (`estimated_value`) ou o PVP da versão LIVE do TCC quando existir?
5. Ações já pendentes na fila (emails cliente/FSE, links) devem aparecer no Centro de Ações do Jarvis, ou só as novas `jarvis_email`?
6. Os botões outbox/assistant/run/cycle neste passo: visíveis com aviso "disponível no passo 2–4", ou escondidos?

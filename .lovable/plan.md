
# Integração Google Calendar — Operações YT

## Decisões fixadas
- **Calendário destino:** calendário partilhado único (ID configurável no Admin, ex.: `ops@yourtours.pt`).
- **Trigger:** publica ao passar a estado `Ganho`; cada alteração operacional propaga em segundos.
- **Sentido:** Lovable → Google Calendar (Lovable é fonte de verdade; sem webhook inverso).
- **Granularidade:** **um evento por lead por dia** — bloco all-day (ou intervalo do 1º ao último FSE do dia). Multi-dias = N eventos, um por dia da viagem. 1-dia = 1 evento.

## Estrutura do evento (baseada nas imagens)

### Título — codifica estado num relance
Padrão: `[prefixo] *NomeTour (Família Cliente) - EstadoResumo - Agente`

| Prefixo | Cor Google | Significado |
|---|---|---|
| `OK -` | Verde (Sage/Basil) | Todos os FSEs do dia confirmados + pagos + fatura ok |
| `*` | Azul (Blueberry) | Reservado / confirmado, aguarda pagamento ou fatura |
| `**` | Cinza (Graphite) | Parcial: alguns FSEs por confirmar |
| `CANCELADO` | Vermelho (Tomato) | Dia cancelado (todos os itens cancelados) |
| `(sem prefixo)` | Amarelo (Banana) | Rascunho / ainda por pedir |

Exemplos: `*Douro TM (Keltz Family) - Confirmado - Miguel Sepúlveda` · `OK - Sintra FD (Keltz Family)` · `CANCELADO *Douro (YT Customizable)`

### Corpo do evento (description, formatada com quebras + emojis simples)

**Bloco 1 — Resumo da lead**
```
NOTAS PARA BACKOFFICE:
{lead.notes_operacoes ou notas do dia}

────────────────────────
Tour: {product_name}
Data: {YYYY-MM-DD}
Pick-up: {schedule_time do 1º item} - {pickup_location}
Idioma: {lead.language}
Nome: {client_name}
Nº pax: {pax_total} pessoas ({adults} adultos + {children} jovens)
Contacto: {phone} | {email}
Origem da reserva: {source}
Nº Reserva: {external_booking_id}
Ref. Interna: {lead_code}
Estado: {status}
```

**Bloco 2 — Detalhes do serviço (FSEs do dia)**
```
DETALHES DO SERVIÇO:

• {schedule_time_start} | {schedule_time_end} - {supplier_name} | {service_type} - {Reservado/Cancelado}
    ◦ {item.description linha 1}
    ◦ {item.description linha 2}
    ◦ email enviado {DD/MM}       ← se booking_email_log existe
    ◦ Pago pelo BackOffice        ← se payment_status = paid
    ◦ Fatura recebida             ← se invoice_status ≥ invoice_received
```
Repete-se para cada item de custo desse dia, ordenado por `schedule_time`.

### Localização (event.location)
Pick-up location do primeiro item do dia (para abrir no Google Maps direto).

### Guests / attendees
Agentes atribuídos (`assigned_agents`) entram como attendees informativos → aparecem no calendário deles via convite automático, sem alterar a fonte partilhada.

---

## Arquitetura técnica

### 1. Connector
- Usar o standard connector **Google Calendar** (gateway Lovable). Autenticação OAuth já gerida pelo gateway — sem tokens manuais.
- Um único connect no workspace autentica a conta Google que "possui" o calendário partilhado.

### 2. Configuração (Admin Settings)
Nova secção em `AdminIntegrationsPage` — "Google Calendar":
- `calendar_id` (texto): ID do calendário destino (ex.: `c_abc123@group.calendar.google.com`).
- `enabled` (toggle): mestre on/off.
- Botão "Testar ligação" (cria evento fantasma e apaga).
- Guardado em `integration_settings` (linha `google_calendar`).

### 3. Base de dados
Nova tabela `calendar_events` para mapear lead↔dia↔evento Google:

```
calendar_events
├─ id uuid pk
├─ lead_id uuid → leads.id (cascade)
├─ day_date date                    -- dia da viagem
├─ google_event_id text             -- id devolvido pela API
├─ last_synced_at timestamptz
├─ last_payload_hash text           -- md5 do payload; skip sync se igual
├─ status text                      -- resumo do estado do dia
├─ created_at, updated_at
UNIQUE (lead_id, day_date)
```

+ GRANTs habituais + RLS: leitura para users autenticados, escrita apenas via service_role (edge function).

### 4. Edge function `calendar-sync`

Uma única função, invocada com `{ lead_id, mode }` onde mode ∈ `create | update | delete | full_resync`.

Pipeline:
1. Carrega `lead` + `lead_operations` + `cost_items` + `booking_emails_log` + `assigned_agents`.
2. Verifica `integration_settings.google_calendar.enabled` — se off, return.
3. Se `lead.status !== 'won'`, elimina todos os `calendar_events` da lead (revert de estado).
4. Agrupa cost_items por `day_date` (do itinerário).
5. Para cada dia:
   - Compõe payload (título + corpo + cor + attendees + start/end).
   - Calcula `hash(payload)`.
   - Se existe `calendar_events` para (lead, day) e hash igual → skip.
   - Caso contrário: `PATCH events/{id}` ou `POST events` via gateway `google_calendar/calendar/v3/calendars/{id}/events`.
   - Persistir `google_event_id`, hash, status.
6. Elimina eventos de dias que já não existem no itinerário.

### 5. Triggers de sync (client-side, via `supabase.functions.invoke`)

Debounced (2s) para evitar spam quando o utilizador escreve vários campos seguidos:

| Evento no app | Ação |
|---|---|
| Lead status → `won` | `invoke(mode: 'create')` |
| Lead status ≠ `won` (após ter sido won) | `invoke(mode: 'delete')` |
| Alteração em `lead_operations` (booking/payment/invoice/schedule) | `invoke(mode: 'update')` |
| Alteração em `cost_items` (add/remove/edit FSE do plano confirmado) | `invoke(mode: 'update')` |
| Alteração em `assigned_agents` | `invoke(mode: 'update')` |
| Alteração em `lead` (client_name, pax, phone, email, notes ops) | `invoke(mode: 'update')` |
| Botão manual "Ressincronizar calendário" na header da lead | `invoke(mode: 'full_resync')` |

Wrapper `useCalendarSync(leadId)` centraliza o debounce.

### 6. UI mínima
- **Página da lead (header)**: badge pequeno "📅 Sincronizado" (verde) / "⏳ A sincronizar" / "⚠ Erro". Tooltip mostra `last_synced_at` + link direto "Abrir no Calendar".
- **Aba Operações**: por dia, ícone 📅 que abre o evento Google numa nova tab.
- **Dashboard**: card opcional "Estado da sincronização Calendar" (contagem de leads sincronizadas / com erro nas últimas 24h).

### 7. Cores Google (colorId)
Mapa fixo no código (`src/lib/calendarColors.ts`): `OK`→`10` (Basil), `*`→`9` (Blueberry), `**`→`8` (Graphite), `CANCELADO`→`11` (Tomato), rascunho→`5` (Banana).

---

## Fluxo de dados

```text
Agente muda booking_status → confirmed
   ↓
useCalendarSync debounce(2s)
   ↓
edge function calendar-sync (mode: update)
   ↓
gateway google_calendar → PATCH /calendars/{id}/events/{eventId}
   ↓
calendar_events.last_synced_at atualizado
   ↓
UI badge "Sincronizado" verde
```

---

## Ordem de execução
1. **Config + connector** — ligar Google Calendar via `standard_connectors--connect`; secção Admin com `calendar_id` + toggle; testar ligação.
2. **Migration** — tabela `calendar_events` (+ GRANTs, RLS, índice em `lead_id`).
3. **Edge function `calendar-sync`** — compositor de payload, hash-diff, CRUD via gateway.
4. **Hook `useCalendarSync`** — debounce + invoke, expõe `status` reativo.
5. **Wiring nos pontos de mudança** — status da lead, tabela de operações, atribuição de agentes, edição de cost_items, alterações à lead.
6. **UI de estado** — badge no header da lead, ícone por dia nas operações.
7. **Botão "Ressincronizar"** + card de saúde no Dashboard.
8. **Testes end-to-end**: criar lead won com 3 dias / editar FSE / cancelar item / voltar a "novo" (limpa eventos).

## Fora do âmbito (agora)
- Sincronização inversa Calendar → Lovable (webhooks Google push).
- Convites automáticos ao cliente final (só equipa interna como attendees).
- Múltiplos calendários (por destino, por agente) — só um partilhado nesta iteração.
- Bloqueio de disponibilidade tipo "Casa do Poço unavailable" da imagem — isso é evento manual da equipa, não gerado pelo sistema.

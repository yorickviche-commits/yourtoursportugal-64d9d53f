## Objetivo

Enriquecer o contexto que alimenta o Travel Planner com dois anexos opcionais no cartão do lead (secção "Preferências / Notas"):

1. **Rota de referência** — imagem/print do Google Maps (PNG/JPG) com a rota desenhada.
2. **Exact Itinerary PDF** — quando existe esqueleto/day-by-day já trabalhado, o motor deve seguir **exatamente** essa estrutura.

Ambos passam a fazer parte do prompt multimodal enviado ao Gemini quando se clica em "Gerar Travel Plan".

---

## UX (YT lean style)

Na caixa "Preferências / Notas" (`LeadDetailPage.tsx` linha ~1267), abaixo do textarea, adicionar uma linha compacta com dois slots drag-and-drop:

```text
[ 🗺️  Rota Google Maps (opcional) ]   [ 📄  Exact Itinerary PDF (opcional) ]
```

- Cada slot: ícone + label + botão "Anexar" / "Substituir" / "Remover".
- Quando preenchido: mostra thumbnail (imagem) ou nome do ficheiro (PDF) + tamanho.
- Se um PDF "exact itinerary" está anexado, aparece badge amarelo **"Modo Exact — o planner vai seguir este PDF literalmente"**.
- Sem modal — inline, denso, mobile-friendly.

---

## Backend

### Storage
- Novo bucket privado `lead-context` (RLS: leitura/escrita apenas para internos).
- Paths: `{lead_id}/route-map.{ext}` e `{lead_id}/exact-itinerary.pdf`.

### Schema
Duas colunas novas em `leads`:
```
route_map_path text
exact_itinerary_pdf_path text
```
(Sem tabela nova — 1:1 com o lead, sempre 0 ou 1 ficheiro por tipo.)

### Edge function `generate-travel-plan`
- Aceitar no payload `routeMapPath` e `exactItineraryPdfPath`.
- Se existem, criar signed URLs (1h) e baixar como base64.
- Construir mensagem multimodal para `google/gemini-3-flash-preview` via `/v1/chat/completions`:
  - `text` block com o prompt atual.
  - `image_url` block se houver mapa (data URL base64).
  - `file` block (PDF) se houver exact itinerary.
- **Modo Exact**: quando existe PDF, injetar bloco no system prompt:
  > "An EXACT ITINERARY PDF is attached. You MUST follow its day-by-day structure, destinations, order and overnight cities literally. Only rewrite bullets in YTP premium style — do not invent new days, do not reorder, do not add/remove stops. If a day is unclear in the PDF, keep it minimal rather than inventing."
- **Modo Rota**: quando existe mapa, injetar:
  > "A Google Maps route screenshot is attached showing the intended geographic flow. Respect this sequence of stops/regions when structuring the days."

---

## Fluxo

```text
Utilizador anexa mapa + PDF no lead
        │
        ▼
Upload → bucket lead-context (paths guardados em leads)
        │
        ▼
"Gerar Travel Plan" → edge function busca ficheiros
        │
        ▼
Prompt multimodal (texto + imagem + PDF) → Gemini
        │
        ▼
JSON estruturado (segue PDF literalmente se presente)
```

---

## Ficheiros a tocar

- **Migration**: bucket `lead-context` + 2 colunas em `leads` + RLS storage.objects.
- **Novo componente**: `src/components/leads/LeadContextAttachments.tsx` (2 slots upload).
- **`src/pages/LeadDetailPage.tsx`**: montar `<LeadContextAttachments />` abaixo do textarea "Preferências / Notas"; passar os paths no payload de gerar plano.
- **`supabase/functions/generate-travel-plan/index.ts`**: aceitar novos campos, download → base64, mensagem multimodal, ramos "Modo Exact" / "Modo Rota" no system prompt.
- **`src/integrations/supabase/types.ts`**: auto-regenerada.

---

## Fora de scope (agora)

- OCR do mapa (o Gemini já lê a imagem nativamente).
- Parse estruturado do PDF para editor (o PDF é lido pelo modelo; se quisermos importar para o editor visual mais tarde, fica para uma fase 2).
- Múltiplos anexos por tipo — 1 mapa + 1 PDF por lead chega.

Confirmas para eu implementar?
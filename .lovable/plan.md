# Fix Geração de Imagem AI no Travel Planner

## Problema
O botão "Gerar Imagem AI" no `ProposalImagePicker` chama a edge function `search-destination-images` com `mode: 'generate'`, que hoje só tenta o **Lovable AI Gateway** (`gemini-3.1-flash-image-preview`). Quando esse gateway falha (sem créditos, rate-limit, modelo indisponível) → erro silencioso e nenhuma imagem.

## Solução
Substituir `generateWithAI()` por uma cadeia de fallback robusta usando as nossas próprias chaves já configuradas como secrets:

```
1º — Google Gemini direto (GEMINI_API_KEY)
       modelo: gemini-2.5-flash-image-preview
2º — OpenAI direto (OPENAI_API_KEY)
       modelo: gpt-image-1 (b64_json)
3º — (manter) Lovable AI Gateway como último recurso
```

Em qualquer caso → devolver `data:image/png;base64,...` para o frontend mostrar imediatamente, sem dependência de storage.

## Alterações

### 1. `supabase/functions/search-destination-images/index.ts`
Reescrever a função `generateWithAI(query)`:

- **Tentar Gemini primeiro** via REST:
  - `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${GEMINI_API_KEY}`
  - Body: `{ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"] } }`
  - Extrair `candidates[0].content.parts[].inlineData.data` (base64) + `mimeType`
  - Construir `data:${mimeType};base64,${data}`

- **Se Gemini falhar/não tiver imagem** → OpenAI:
  - `POST https://api.openai.com/v1/images/generations` com `Authorization: Bearer ${OPENAI_API_KEY}`
  - Body: `{ model: "gpt-image-1", prompt, size: "1536x1024", n: 1 }` (landscape)
  - Extrair `data[0].b64_json` → construir data URL

- **Se OpenAI falhar** → manter chamada atual ao Lovable Gateway como último fallback.

- Cada tentativa envolvida em `try/catch` com `console.error` detalhado (status + body) para futuro debug via Edge Function Logs.

- Retornar sempre `{ url, caption: query, photo_id: 'ai-<timestamp>-<random>' }` — formato já consumido pelo `ProposalImagePicker` e pelo registo `used_photos`.

### 2. Tratamento de erros visível no frontend
Em `ProposalImagePicker.tsx`, o `handleAIGenerate` já apanha erros via toast. Adicionar mensagem mais clara quando a edge function devolve `{ images: [] }` (atualmente diz "Não foi possível gerar imagem" — manter mas com hint sobre verificar logs).

## Detalhes Técnicos

**Por que data URLs e não storage?**
- Imagens AI usadas nas propostas já são editáveis (o utilizador pode substituir). Persistir num bucket adicionava complexidade sem ganho — o frontend guarda o URL no `plan.cover_image.url` ou `day.images[].url` e quando o plano é gravado, fica no payload da proposta.
- Se mais tarde quisermos persistir, fazemos upload diferido para `supplier-files` ou novo bucket.

**Limites:**
- Gemini `gemini-2.5-flash-image-preview` devolve PNG ~1MB tipicamente.
- OpenAI `gpt-image-1` a 1536x1024 ~2MB base64. Aceitável para data URL inline.

**Secrets já configurados** (verificado): `GEMINI_API_KEY`, `OPENAI_API_KEY`, `LOVABLE_API_KEY` ✅ — nada a adicionar.

## Verificação após implementação
1. Deploy edge function.
2. No frontend, abrir Travel Planner → Editor de Imagem → tab "AI Generate" → clicar "Gerar Imagem AI".
3. Confirmar que imagem aparece em < 10s.
4. Verificar Edge Function logs para confirmar qual provider serviu o pedido.

## Fora de scope
- Não toco em `autoFetchImages` (que usa Unsplash + dedup já implementado).
- Não toco no resto da pipeline de propostas, planner ou outras edge functions.
- Não persisto fotos AI em storage — fica para iteração futura se necessário.

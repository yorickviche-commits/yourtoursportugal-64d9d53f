# Guardar no Travel Planner — voltar a ser rápido e sem erros

## Causa confirmada

As imagens geradas por AI (capa e imagens de dia) são devolvidas como base64 (`data:image/png;base64,...`) e ficam guardadas dentro dos registos da base de dados.

Verificação feita na base de dados: o último plano gravado tem **12,8 MB** só no campo de metadata da capa (outros têm 1–2,6 MB), e os dias chegam a ~1 MB. Antes da funcionalidade de geração de imagem AI as imagens eram links Unsplash (algumas centenas de bytes).

Ou seja: cada "Guardar" envia dezenas de MB (travel_plans + proposals, capa + imagens dos dias), o que explica a lentidão e os timeouts.

## Correção

1. **Imagens AI passam a ficheiro, não base64**
   - Ao gerar uma imagem AI, o ficheiro é enviado para um bucket público de storage e passa a guardar-se apenas o URL curto.
   - Aplica-se à capa e às imagens de dia geradas por AI.

2. **Limpeza automática no gravar (segurança)**
   - Antes de gravar, qualquer imagem que ainda venha em base64 (planos antigos já abertos) é convertida para ficheiro em storage e substituída pelo URL.
   - Assim, planos antigos "pesados" ficam leves na próxima gravação, sem perder imagens.

3. **Gravação mais simples e atómica**
   - Substituir o atual `delete` + `insert` em `travel_plans` por um único `upsert` por `lead_id` (evita janela em que o plano não existe se falhar a segunda parte).
   - Tirar do caminho crítico o bloco WeTravel: hoje há duas queries aguardadas depois do toast de sucesso; passam a correr depois, sem bloquear o gravar.

4. **Nada mais muda**
   - Sem alterações ao layout do PDF, ao itinerário digital, ao nome do ficheiro, nem à lógica de propostas/pagamentos.

## Detalhes técnicos

- Novo bucket público `proposal-images` (se não existir) com política de leitura pública e escrita para utilizadores autenticados.
- Helper novo `src/lib/uploadDataUrlImage.ts`: recebe `data:` URL → `Blob` → `supabase.storage.from('proposal-images').upload(...)` → devolve `getPublicUrl`.
- `src/components/trip/ProposalImagePicker.tsx`: após receber imagem da edge function, se `url` começar por `data:`, faz upload e usa o URL público.
- `src/components/trip/TravelPlanProposal.tsx` (`handleSave`):
  - passo prévio de "normalizar imagens" (capa + `days[].images`) convertendo `data:` → URL de storage;
  - `travel_plans` gravado com `upsert(..., { onConflict: 'lead_id' })` em vez de `delete` + `insert`;
  - bloco WeTravel movido para depois do `setSaving(false)` / sem `await` no caminho de gravação.
- Alternativa considerada e rejeitada: guardar base64 mas comprimir — continuaria a inflar as linhas da base de dados e o payload das propostas públicas.

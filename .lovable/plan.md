# Mapa Google por Dia — Travel Planner → Proposta Online

## Viabilidade
Totalmente viável e simples. O Google Maps permite embed via iframe sem chave (`https://www.google.com/maps/embed?...`) ou via link partilhado (`maps.app.goo.gl/...` / `google.com/maps/dir/...`). Guardamos o URL colado pelo agente e renderizamos como iframe no builder e na proposta pública. Sem custos de API, sem geocoding, sem manutenção — o UI/UX é o próprio Google Maps (zoom, pins, rota, "abrir no Maps").

Não vamos re-desenhar o mapa nem re-marcar pontos automaticamente (isso exigiria Places API + geocoding por dia). O agente cola o link partilhado do Maps que já contém a rota/pins desejados — igual à lógica que já usas para o "exact itinerary".

## Modelo de dados
Adicionar campo `mapUrl?: string` em cada `day` do objeto `plan.days[]` em `travel_plans` (JSONB — não precisa de migração de schema, só update no tipo TS).

Para programas de 1 dia funciona naturalmente (só há 1 dia, 1 mapa). Multi-dia: cada dia tem o seu campo próprio.

## UI — Travel Planner (`TravelPlanProposal.tsx`)
Em cada card de dia (Day-by-Day), acima ou abaixo do bloco de imagens, adicionar:
- Input compacto "🗺️ Google Maps link (opcional)" com placeholder `https://maps.app.goo.gl/... ou google.com/maps/...`
- Botão "Pré-visualizar" que abre o iframe inline abaixo (colapsável).
- Botão "×" para limpar.
- Estado guardado via `useUndoable` (já integrado).

Validação leve: aceitar apenas hosts `google.com/maps`, `maps.google.com`, `maps.app.goo.gl`, `www.google.com/maps/embed`. Converter automaticamente:
- Se já for `/maps/embed?pb=...` → usar tal como está.
- Se for link normal (`/maps/dir/...`, `/maps/place/...`, `maps.app.goo.gl/...`) → embrulhar em `https://www.google.com/maps?output=embed&q=<encoded>` (funciona para a maioria dos links partilhados; o iframe do Maps aceita `?output=embed` no URL completo).

## UI — Proposta pública (`PublicProposalPage.tsx`)
Dentro de cada dia do itinerário, se `day.mapUrl` existir, renderizar um iframe responsivo (16:9, `loading="lazy"`, `referrerpolicy="no-referrer-when-downgrade"`, `allowfullscreen`) com título "Rota do Dia X" e um link discreto "Abrir no Google Maps →" que aponta ao URL original.

Se nenhum dia tiver mapUrl, nada aparece — sem placeholder vazio.

## PDF
Por agora **não incluímos no PDF** — iframe não renderiza em html2canvas/jsPDF e um screenshot estático do Maps exige a Static Maps API (paga, com key restrita). Podemos adicionar mais tarde como opção "gerar screenshot" via edge function se quiseres. A proposta online continua a ser o local rico.

## Ficheiros a alterar
- `src/components/trip/TravelPlanProposal.tsx` — input + preview por dia, integra no state `plan.days[i].mapUrl`, undo-aware.
- `src/pages/PublicProposalPage.tsx` — render iframe por dia quando existe URL.
- `src/lib/proposalShare.ts` / tipo do plan (se tiver interface tipada) — adicionar `mapUrl?: string`.

Nenhuma migração de BD, nenhuma edge function nova, nenhuma dependência nova.

## Fluxo do agente
1. No Travel Planner, em cada dia, cola o link do Google Maps (do "share" ou da barra do browser).
2. Clica "Pré-visualizar" para confirmar que abre bem.
3. Guarda o plano.
4. Cliente abre o link da proposta → vê o mapa embed em cada dia, com o UX nativo do Google Maps.

Confirmas para eu implementar assim?
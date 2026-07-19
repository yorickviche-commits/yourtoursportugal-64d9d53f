Perfeito — com esse formato conseguimos fazer funcionar de forma fiável em todos os lados sem precisar de API key.

## Diagnóstico

Links Google Maps do tipo `/maps/dir/A/B/C/@lat,lng/data=...` **não são embebíveis** apenas ao acrescentar `output=embed` — o Google devolve a página `consent.google.pt` e o iframe fica em branco. É esta a causa dos 3 sintomas:

- erro no Travel Planner (consent recusado)
- link público muito lento / não abre
- PDF sem mapa

## Solução

### 1. Novo helper `toMapEmbedSrc(url)`

Reescrever o helper em `src/components/trip/TravelPlanProposal.tsx` (e reutilizar na página pública):

- Detetar links `/maps/dir/...`: extrair os waypoints (segmentos entre `/dir/` e `/@` ou `/data`), decodificar (`decodeURIComponent`) e converter para o embed clássico:  
  `https://maps.google.com/maps?saddr=<A>&daddr=<B>+to:<C>+to:<D>&output=embed`  
  Este endpoint clássico **não passa pelo consent.google** e aceita múltiplos `+to:` — ideal para rotas multi-stop como a que enviaste.
- Detetar links `/maps/place/...` ou com `@lat,lng`: usar `https://maps.google.com/maps?q=<place ou lat,lng>&z=<zoom>&output=embed`.
- Detetar links curtos (`maps.app.goo.gl`, `goo.gl/maps`): não são embebíveis diretamente → mostrar fallback com botão “Abrir no Google Maps” + pedir ao agente para colar o link completo (aviso inline no input).
- Se já for um `/maps/embed?pb=...` ou já contiver `output=embed`, usar tal e qual.

### 2. Travel Planner (back office)

- Preview do iframe usa `toMapEmbedSrc` corrigido.
- Debounce ao escrever (600ms) para não recarregar o iframe a cada tecla.
- Se o helper devolver `null` (link não suportado), mostrar aviso amarelo em vez do iframe: “Link não embebível — cola o link completo do google.com/maps”.

### 3. Proposta pública

- `PublicProposalPage.tsx`: usar o mesmo helper (importado).
- `loading="lazy"` já existe — adicionar `sandbox="allow-scripts allow-same-origin allow-popups"` para performance e mostrar título + link “Abrir no Google Maps” por cima do iframe, para nunca ficar “preso” à espera.
- Encolher a proporção em mobile para carregamento mais leve.

### 4. PDF (estático)

Como PDF não renderiza iframe:

- Por cada dia com `map_url`, adicionar uma caixa estática no PDF:
  - título “Route map — Day N”
  - lista de paragens extraídas da URL (nomes decodificados dos waypoints)
  - botão/link clicável “Open route in Google Maps →” usando `doc.textWithLink` com a URL original.
- Não vamos gerar imagem estática do mapa (requereria Static Maps API paga) — o link clicável dá acesso imediato à rota real.

### 5. Verificação

- Colar o link do Douro que enviaste no Travel Planner → ver iframe com rota Porto → Casa do Poço → Cozinha da Clara → Daurum → Miradouro → Porto.
- Abrir link público da proposta → mapa carrega rápido.
- Gerar PDF → aparece caixa com as paragens e link clicável.

## Ficheiros a alterar

- `src/components/trip/TravelPlanProposal.tsx` — helper `toMapEmbedSrc` + UI de aviso + debounce.
- `src/pages/PublicProposalPage.tsx` — passar a usar o helper partilhado.
- `src/lib/proposalPdf.ts` — bloco estático por dia com waypoints + link.
- (opcional) mover o helper para `src/lib/proposalShare.ts` para partilhar entre planner, público e PDF.
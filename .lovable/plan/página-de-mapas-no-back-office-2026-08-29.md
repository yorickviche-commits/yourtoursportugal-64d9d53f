# Página de Mapas no Back Office

Os ficheiros chegaram consolidados (`core.ts`, `hooks.ts`, `components.tsx`, `mapas.css`, `MapasPage.tsx`, edge function), e é exatamente essa a estrutura que o `MapasPage.tsx` importa (`@/features/mapas/core`, `/hooks`, `/components`). Vão ser copiados verbatim, sem reescrita, sem reformatação e sem conversão de cores hex para tokens.

## 1. Dependência

Instalar apenas `@vis.gl/react-google-maps@^1.5.0`. O `leaflet` e o `react-leaflet` ficam intactos (usados pelo `ProposalMap` e `ItineraryMap`).

## 2. Ficheiros novos (conteúdo verbatim)

```text
src/features/mapas/core.ts          (tipos, constantes, taxonomias, tokens T, utils)
src/features/mapas/hooks.ts         (filtros, queries às views, rotas, mock data)
src/features/mapas/components.tsx   (todos os componentes de UI)
src/features/mapas/mapas.css
src/pages/MapasPage.tsx
supabase/functions/geocode-map-locations/index.ts
```

## 3. Ligação à app (três edições mínimas)

- `src/App.tsx` — import de `MapasPage` e rota `/mapas` dentro de `ProtectedRoute`, junto às de `/catalog` e `/products`, antes do wildcard.
- `src/lib/pagePermissions.ts` — `'mapas'` na união `PageKey` e a entrada `{ key: 'mapas', label: 'Mapas', path: '/mapas', group: 'Comercial' }` entre `products` e `partners`.
- `src/components/AppSidebar.tsx` — `MapPin` nos imports do lucide-react e `{ to: '/mapas', icon: MapPin, label: 'Mapas', pageKey: 'mapas' }` no array `comercialItems`, logo após "Catálogo de Produtos". Uma só alteração — os dois menus leem o mesmo array.

Nada mais é alterado nestes ficheiros.

## 4. Base de dados

Zero migrações. As views (`v_map_fses`, `v_map_experiencias`, `v_map_produtos`, `v_map_pending_geocode`, `v_map_produto_stops`) e a tabela `map_locations` já existem e não são tocadas.

## 5. Secrets e chaves

- `GOOGLE_MAPS_SERVER_KEY` (Geocoding API, restrita por IP) — pedida no fim através do formulário seguro, para a edge function.
- `VITE_GOOGLE_MAPS_API_KEY` (browser key, Maps JavaScript + Directions, restrita por referrer) e, opcionalmente, `VITE_GOOGLE_MAPS_MAP_ID` — tens de as criar no Google Cloud e colocar nas variáveis do projeto. Sem a browser key a página mostra o aviso "VITE_GOOGLE_MAPS_API_KEY não está definida"; sem Map ID o mapa funciona com o estilo padrão.

## Notas técnicas

- Os pins usam `AdvancedMarker`, por isso o `<Map>` mantém `mapId` — sem estilos inline.
- Os `memo()` no `MapPin` e no `ResultCard` mantêm-se; o estado de hover fica onde está.
- Enquanto as views vierem vazias, os hooks caem para os dados de amostra (comportamento já previsto no código).
- Depois do deploy, o geocoder corre com `{"limit": 300}` três vezes (773 registos pendentes).

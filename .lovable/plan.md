# Corrigir marcas de água nos mapas de rota

## Alterações
- Substituir os tiles CARTO em `staticRouteMap` por OpenStreetMap como fonte principal.
- Manter o canvas a 2x, os tiles desenhados a 256 px, a rota azul, os marcadores numerados e o fallback visual cinzento quando um tile falhar.
- Atualizar o comentário e a atribuição para `© OpenStreetMap contributors · Google routes`, ajustando a respetiva caixa.
- Confirmar em `src/` e `supabase/functions/` que não resta qualquer referência CARTO.

## Verificação
- Validar a compilação e os erros do preview.
- Abrir uma impressão/PDF com rota e confirmar visualmente o mapa OpenStreetMap sem marca de água, com rota e pontos à frente.
- Não alterar o versionamento, o link para Google Maps nem o caminho preferencial da imagem Google Static Map.

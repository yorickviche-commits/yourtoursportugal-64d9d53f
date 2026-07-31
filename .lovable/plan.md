# Travel Plan manual + importação de produtos do catálogo

A geração AI mantém-se exactamente como está. Adiciona-se um caminho alternativo, manual, com importação de produtos já validados no catálogo YT.

## 1. Ecrã inicial do Travel Planner (sem plano)

Hoje existe apenas o botão "Gerar Plano de Viagem". Passa a haver dois botões lado a lado:

- **Gerar Plano de Viagem (AI)** — inalterado.
- **Criar Manualmente** — cria um plano vazio (título = destino, 0 dias) e entra directamente em modo Edição.

## 2. Adicionar dia (novo, hoje não existe botão de dia)

No fim da lista de dias, em modo Edição, aparece:

```text
[ + Dia manual ]   [ + Dia a partir de produto ]
```

- **Dia manual**: cria um dia vazio com título/subtítulo editáveis, sem itens, pronto para adicionar itens um a um (já suportado) e imagens (já suportado).
- **Dia a partir de produto**: abre um selector de produtos do catálogo.

Cada dia existente ganha também, na barra do dia, uma acção **Importar produto** que acrescenta os itens/imagens do produto ao dia actual (sem apagar o que lá está), para dias com mais do que uma experiência.

## 3. Selector de produtos

Modal com pesquisa por nome/localização/categoria, listando produtos do catálogo importado e mostrando miniatura, nome, localização e duração. Só aparecem os produtos **prontos para uso comercial** (visíveis e com estado de workflow aprovado); o título/resumo editorial interno tem prioridade sobre o do Magpie.

Ao escolher um produto, o dia é auto-preenchido:

- **Título do dia**: título editorial ou nome do produto
- **Subtítulo**: resumo editorial ou sumário do produto
- **Itens**: destaques do produto e, quando não existem destaques, os itens incluídos — cada um como item do dia, com a duração do produto no primeiro item
- **Imagens**: até 2 imagens da galeria do produto
- **Data**: calculada automaticamente a partir da data de início da lead, como já acontece

Tudo fica imediatamente editável (bold, drag & drop, undo com Ctrl+Z) porque reutiliza a estrutura de dias existente. A importação é uma cópia pontual: alterações posteriores no Magpie não mexem no plano já criado.

## 4. Fora de âmbito

- Nenhuma alteração à função de geração AI, aos prompts ou às edge functions.
- Nenhuma escrita para o Magpie.
- Preços dos produtos não entram no Travel Plan (custos continuam a ser tratados no separador Custos).

## Detalhes técnicos

- `src/components/trip/TravelPlanProposal.tsx`: botão "Criar Manualmente" no estado vazio; `addDay('manual' | 'product')`; acção de importar produto por dia; renumeração de `day_number` e recálculo de datas ao adicionar/remover dias.
- Novo `src/components/trip/ProductPickerDialog.tsx`: modal de selecção, alimentado por `useImportedProducts()` de `src/hooks/useMagpie.ts`, filtrando por `product_local.is_visible` e `workflow_status`.
- Novo helper `productToProposalDay()` que mapeia `magpie_products` (highlights, included, images, duration_text) para `ProposalDay`, usando `firstImage`/`local()` já existentes.
- Sem migrações de base de dados e sem novas edge functions.

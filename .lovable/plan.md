# Espanha + Regiões dinâmicas

## O que existe hoje
- Já há uma tabela `regions` (código, nome, ordem, ativa) com 9 linhas: Porto, Douro, Minho, Lisboa & Sintra, Centro, Alentejo, Algarve, Açores e uma genérica "Espanha". Sem país, sem slug, sem imagem. Madeira não está lá.
- `lead_regions` liga leads a regiões (213 ligações) — só é usada no painel de classificação da lead.
- O resto da app não lê esta tabela:
  - FSEs (`fseDatabase.ts`, modal FSE, extração AI) usam uma lista fixa de 7 regiões oficiais com distritos.
  - Mapas (`features/mapas/hooks.ts`) têm a sua própria lista fixa.
  - `leads.destination` é texto livre (84 valores diferentes).
  - `suppliers` não tem país nem região — os destinos ficam escritos nas notas.
  - O gerador AI de travel plans e o "Preencher Imagens" não recebem nenhuma lista de regiões.

## O que vai ser feito
1. **Tabela de regiões alargada** (sem apagar nada): novos campos país (PT/ES), slug, imagem hero e região-mãe. As 9 regiões atuais ficam como PT e mantêm o mesmo id, por isso as 213 ligações de leads continuam iguais. Junto Madeira (PT). A linha genérica "Espanha" é desativada, não apagada.
2. **Sub-destinos**: nova tabela `region_destinations` (cidades por região).
3. **Seed de Espanha (ES)** com as 10 regiões e as cidades pedidas.
4. **Novo ecrã Admin "Regiões"**: criar, editar, desativar, reordenar (setas), escolher o país e gerir as cidades.
5. **Uma única fonte**: um hook `useRegions()` usado em classificação da lead, Dados Gerais (sugestões de destino), modal FSE, "Adicionar FSE" rápido, filtros da FSE Database, mapas, filtros de leads e relatórios. Ao criar uma região no Admin, ela aparece logo em todo o lado.
6. **FSEs**: o fornecedor ganha País e Regiões (multi-seleção, tabela `supplier_regions`), filtráveis. O "Adicionar FSE" rápido também pede a região. Continua a gravar pelo `createOrFindFSE` (que já corrigiu o bug de permissões e os duplicados).
7. **Travel plan / AI**: o gerador e o "Preencher Imagens" recebem a lista de regiões e cidades ativas (PT+ES). Cada dia pode guardar país/região, o que permite programas multi-país. Mantêm-se as regras atuais: negritos, mapa Google por dia, versões independentes, sem nome de parceiro nem preço net nos materiais do cliente. As pesquisas de imagens passam a incluir "Spain" nos destinos ES.
8. **MCP**: nova ferramenta só de leitura `list_regions`; `generate_travel_plan` passa a usar a mesma lista.

## Fica igual
Valores de custos, texto livre de `leads.destination` (só ganha sugestões), estrutura das pastas do Drive dos FSE.

## Como testar
- Admin → Regiões: criar "Astúrias" (ES) e confirmar que aparece na classificação da lead, no modal FSE e nos filtros.
- Criar um FSE na linha de custos com a região Andaluzia e confirmar na lista de FSEs, filtrando por ES.
- Gerar um travel plan para "Lisboa + Madrid + Sevilha" e confirmar que os dias mostram a região/país e as imagens de Espanha.

## Detalhes técnicos
- Migration: `ALTER TABLE regions ADD country text NOT NULL DEFAULT 'PT', slug text, hero_image_url text`; índice único em slug; tabelas `region_destinations(id, region_id fk, name, sort_order, is_active)` e `supplier_regions(supplier_id, region_id)`, e o campo `suppliers.country text`; tudo com grants, RLS (leitura para utilizadores internos, escrita para admin via `has_role`/`is_admin`). O seed é DML separado (run_sql).
- Os dias do plano ganham `country`/`region` opcionais dentro do JSON do plano, por isso não há alteração de schema.
- O `FSE_REGIONS` fixo fica só como fallback.

# FSE Database — árvore Região > Distrito > Categoria > Fornecedor

## Nota importante sobre os dados (verificado agora)

Verifiquei a tabela `fse_drive_index` antes de escrever o plano e o estado real é diferente do descrito:

- Tem **340 registos**, não 97.
- A coluna `district` existe mas está **100% vazia** (0 registos preenchidos).
- Os `path` gravados ainda seguem a estrutura **antiga** (`1 - Alojamento / Alentejo / Horta da Coutada / ...`), ou seja, vêm da pasta antiga `2 - FSE's`.
- Só existem 9 categorias e 29 "regiões" (muitas delas nomes de subpastas antigas).

Em paralelo confirmei via Drive que a nova pasta está acessível e tem exatamente a estrutura pedida:

```text
Nova pasta comercial claudio yt 2026 2027
 └─ 1. PORTO E NORTE            (região)
     └─ 1.1 Porto               (distrito)
         └─ Barcos              (categoria)
             └─ <fornecedor>    (pasta) → ficheiros
```

7 regiões confirmadas: Porto e Norte, Centro, Lisboa, Alentejo, Algarve, Madeira, Açores.

Conclusão: não há dados novos para preservar — o índice tem de ser **reconstruído pela sincronização** a partir da nova raiz. Nada é apagado à mão; a própria sincronização substitui o índice (é o comportamento que já existe hoje).

## O que vai ser feito

### 1. Sincronização (`index-drive-fses`)

- Nova raiz: `1qHOJ1-przDPoSHyYTJ3ZsvzbUBhpG8fK`.
- Nova leitura de profundidade: depth 0 = Região, depth 1 = Distrito, depth 2 = Categoria, depth >= 3 = Fornecedor e ficheiros.
- Passa a gravar `region`, `district`, `category`, `supplier_name`, `path` completo, `web_view_link` e `depth`.
- Nomes das pastas são limpos do prefixo de ordenação (`1. PORTO E NORTE` → `Porto e Norte`, `1.1 Porto` → `Porto`) para ficarem legíveis nos filtros, mantendo o nome original no `path`.
- Aumenta a profundidade máxima de varrimento para acomodar fornecedores com subpastas.
- Mantém a lógica atual de substituir o índice e inserir em blocos.

### 2. Árvore no ecrã (`FSEDriveBrowser`)

- `DriveNode` passa a incluir `district`.
- Agrupamento passa a **Região > Distrito > Categoria > Fornecedor > Ficheiros** (4 níveis colapsáveis em vez de 3), mantendo badges de contagem, expand/collapse, abertura automática quando há pesquisa e a pré-visualização em iframe tal como está.
- Novo filtro **Distrito**, ao lado de Categoria e Região; as opções de distrito dependem da região selecionada (e limpam-se quando a região muda).
- A pesquisa passa a considerar também o distrito.
- `inferRegion` fica apenas como fallback para registos sem `region`/`district`.

### 3. Regiões e distritos como fonte de verdade (`fseDatabase.ts`, `FSECreateModal`)

- `fseDatabase.ts` passa a expor as **7 regiões oficiais** com os respetivos distritos, e um helper para ler regiões/distritos reais do índice (`fse_drive_index`) para que a lista cresça sozinha à medida que o Drive cresce.
- Labels das categorias renomeadas para casar com o Drive (Monumentos & Museus, Barcos, Transportadoras, …) mantendo os ids internos (`mon`, `mar`, `terr`, …).
- No `FSECreateModal`, o seletor de destinos passa a dois níveis: primeiro Região, depois Distrito (opcional), mantendo multi-seleção e o badge "Multi-Destino".
- `FSEDatabasePage` continua a construir os cartões/tabela a partir do índice, agora agrupando por região oficial em vez de inferência por texto.

### Mantém-se intacto

Smart Import por IA (`extract-supplier-data`), entrada manual, scoring de fornecedores, botão "Sincronizar do Drive", pré-visualização em iframe, pesquisa e filtros.

## Validação final

Depois das alterações: correr a sincronização, confirmar em base de dados que `region`, `district` e `category` ficam preenchidos, e comparar a árvore no ecrã com a estrutura do Drive (7 regiões, distritos por região, categorias por distrito, fornecedores com os respetivos ficheiros).

## Detalhes técnicos

- `supabase/functions/index-drive-fses/index.ts`: `ROOT_FSE_FOLDER` novo; `Node` ganha `district`; `walk()` atribui região/distrito/categoria por `depth` (0/1/2) e fornecedor a partir de depth 3; `maxDepth` sobe para 6; helper `cleanName()` remove prefixos `^\d+(\.\d+)?[.\s-]*`.
- `src/components/commercial/FSEDriveBrowser.tsx`: `district` no tipo; `tree` passa a `Record<region, Record<district, Record<category, Record<supplier, DriveNode[]>>>>`; novo `districtFilter` derivado de `nodes` filtrados pela região; chaves de expand/collapse passam a incluir o distrito.
- `src/data/fseDatabase.ts`: novo `FSE_REGIONS: { name, districts[] }[]`, `FSE_CATEGORY_DEFS` com labels atualizados (ids inalterados), e `useFseRegions()`/`fetchRegionsFromIndex()` para ler `region`/`district` distintos de `fse_drive_index`; `FSE_DESTINATIONS` mantém-se exportado (derivado das regiões) para não quebrar `FSEDatabasePage`.
- `src/components/commercial/FSECreateModal.tsx`: estado `destinations` continua `string[]`; UI passa a chips de região + chips de distrito da região ativa; ao gravar mantém o formato atual.
- Sem migrações de base de dados — `district` já existe.

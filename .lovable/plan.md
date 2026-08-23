# FSE Database: espelho fiel do Drive + sync incremental rápido

## O que verifiquei agora

- A pasta raiz é a correta (foi apenas renomeada para "Nova Pasta FSES - claudio yt 2026 2027", mesmo ID).
- O índice foi sincronizado hoje às 18:13 e tem 1672 registos: 7 regiões, 8 categorias por distrito, e todos os ficheiros dos fornecedores.
- O que **não** espelha: **Madeira** e **Açores** não têm nível de distrito no Drive (as categorias estão logo dentro da região). O código assume sempre Região → Distrito → Categoria, por isso nessas duas regiões as *categorias* (Alojamento, Barcos, Restauração, …) aparecem como se fossem distritos e ficam sem categoria — daí a árvore parecer errada.
- O sync é sempre completo (apaga tudo e reinsere), percorrendo centenas de pastas — é o que o torna lento e propenso a timeout.

## O que vai ser feito

### 1. Corrigir o espelho (Madeira / Açores e casos futuros sem distrito)
Ao descer da região, se o nome da pasta corresponder a uma das categorias conhecidas (Alojamento, Barcos, Animação Turística, Guias Externos, Monumentos & Museus, Quintas & Caves, Restauração, Transportadoras, …), essa pasta é tratada como **categoria** e o distrito passa a ser a própria região (ex.: Madeira → Madeira → Alojamento → Fornecedor). Assim a árvore, o browser do Drive e a tabela resumo mostram Madeira e Açores como todas as outras regiões.

### 2. Sync incremental (rápido)
- Nova tabela de estado do sync (`fse_sync_state`) que guarda o token de alterações do Drive e a data do último sync.
- **Primeira vez / resync completo**: percorre tudo (como hoje, em paralelo) e guarda o token.
- **Sync normal**: pede ao Drive apenas as **alterações desde o último token** (ficheiros/pastas novos, renomeados, movidos ou apagados). Só esses registos são atualizados/removidos no índice — nada de reler centenas de pastas. Passa de minutos para poucos segundos.
- Um item novo é ligado à árvore pelo seu pai; se o pai ainda não existir no índice (pasta nova em cadeia), só esse ramo é percorrido.
- Itens apagados ou movidos para o lixo são removidos do índice.

### 3. UI da página FSE Database
- O botão passa a ser **"Sincronizar"** (rápido, incremental) com indicação do último sync ("Atualizado há X").
- Opção secundária **"Resync completo"** para reconstruir o índice do zero quando necessário.
- Resultado em toast: quantos itens adicionados / atualizados / removidos.
- Depois do sync, a árvore recarrega automaticamente (sem refresh manual).

## Notas técnicas

- Edge function `index-drive-fses`: refactor para dois modos (`mode: "full" | "incremental"`), usando `drive/v3/changes` com `pageToken` e `restrictToMyDrive=false`, resolvendo ancestrais até à raiz FSE para calcular região/distrito/categoria/fornecedor.
- Escrita passa a `upsert` por `drive_id` (em vez de wipe + insert), com `DELETE` só nos ids removidos — evita janelas em que a página aparece vazia.
- `region`/`district`/`category`/`supplier_name` continuam a ser derivados no servidor; o frontend (`FSEDatabasePage`, `FSEDriveBrowser`, `FSECreateModal`) não muda de contrato — só ganha o novo botão e o carimbo de última sincronização.
- Migração pequena: tabela `fse_sync_state` (1 linha) com GRANTs e RLS (leitura a autenticados, escrita a service_role).

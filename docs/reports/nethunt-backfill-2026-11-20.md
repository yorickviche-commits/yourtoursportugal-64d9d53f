# NetHunt — relatório de backfill e lacunas

**Data:** 20/11/2026 · **Estado: cópia da API concluída; desligamento ainda não validado.**

## 1. Resultado confirmado

- **23.866 objetos brutos** arquivados, incluindo registos sem file correspondente, comentários, alterações e definições de campos.
- **24 origens verificadas:** contagem e assinatura SHA-256 coincidem entre a resposta da API e o conteúdo relido do arquivo.
- **4 origens de email indisponíveis (HTTP 404)**, explicitamente registadas; zero falhas técnicas por resolver nos restantes lotes.
- **742 tarefas concluídas recuperadas** no TCC (676 Sales, 66 Operações); as tarefas anteriores não foram substituídas.
- **27 comentários + 186 eventos de alteração** em falta acrescentados à timeline das files correspondentes.
- **13/13 ficheiros do Google Drive copiados** para armazenamento privado e relidos com tamanho/assinatura idênticos: 16.836.587 bytes (~16,1 MiB).

## 2. Contagens por pasta

| Pasta | Registos | Comentários | Alterações | Ficheiros | Chamadas | Definições de campos |
|---|---:|---:|---:|---:|---:|---:|
| Files & Leads DR | 913 | 963 | 6376 | 13 | 0 | 11 |
| Contacts | 3411 | 6 | 3668 | 0 | 0 | 13 |
| Tasks | 1556 | 1 | 5846 | 0 | 0 | 9 |
| Companies | 535 | 0 | 532 | 0 | 0 | 13 |

Estas contagens comprovam a cópia do que a conta/API devolveu, **não uma reconciliação independente com os totais da interface NetHunt**. O acesso foi confirmado às quatro pastas listadas. A documentação oficial indica ausência de limite quando o parâmetro `limit` é omitido; esta captura usa esse caminho desde 1970 e não o cursor crescente do importador antigo.

Fonte técnica: https://nethunt.com/integration-api

## 3. Lacunas antes de desligar

| Lacuna | Evidência / estado | Passo necessário |
|---|---|---|
| Files sem associação nativa | 250 dos 913 registos associam-se de forma única; **663 permanecem só no arquivo bruto**. Nenhuma file operacional foi criada automaticamente. | Classificar arquivo histórico vs files a tornar consultáveis no CRM; resolver duplicados sem disparar etapas/calendário. |
| Contactos e empresas | 3.411 contactos e 535 empresas preservados integralmente em bruto, não convertidos para as tabelas operacionais de contactos/parceiros. | Validar totais e decidir a importação/deduplicação local necessária. |
| Ligações das tarefas | 1.556/1.556 tarefas devolvidas pela API têm uma tarefa local; **491 ligadas a uma file e 1.065 sem file única**. Os links originais são preservados. | Rever ligações órfãs/ambíguas. Há ainda 57 tarefas locais NetHunt fora desta lista atual: preservar e investigar, não apagar. |
| Emails históricos e anexos Gmail | As quatro origens NetHunt de email devolvem 404. A cópia anterior tem metadados Gmail na timeline; este lote não comprova corpos, anexos, todas as caixas ou todo o histórico. | Auditoria/backfill Gmail por caixa e por período; confirmar que mensagens/anexos relevantes continuam acessíveis sem NetHunt. |
| WhatsApp | Sem exportação confirmada nesta API; não foi construída inbox WhatsApp neste lote. Uma imagem WhatsApp no Drive foi copiada, mas isso não comprova cópia dos chats. | Se existirem chats guardados apenas no NetHunt, obter exportação antes de cancelar. |
| Utilizadores, atribuições e automações | Campos e responsáveis expostos nos registos/tarefas foram preservados; diretório de utilizadores, permissões e automações não foram exportados. | Rever/exportar configuração e relacionar responsáveis com utilizadores do TCC. |
| Chamadas e dados fora das pastas acessíveis | A API devolveu zero chamadas; não comprova inexistência de chamadas noutras fontes ou pastas sem acesso. | Comparar com o NetHunt e confirmar cobertura da conta. |
| Alterações posteriores | O NetHunt continua em utilização/sincronização. | Repetir a captura e a reconciliação imediatamente antes do corte definitivo. |

## 4. Segurança e verificações

- Arquivo apenas consultável por administradores; sem acesso anónimo. Ficheiros em bucket privado.
- Nenhuma alteração de stage, dados operacionais das leads, custos, versões, calendários ou cursores da sincronização por esta rotina.
- Só foram acrescentadas tarefas/timeline em falta; as tarefas recuperadas são todas concluídas. A chave de equipa foi ajustada apenas nas tarefas novas para coincidir com a vista Operações existente.
- Push/pull continuam como estavam. Nenhum cron criado ou desligado; nenhuma escrita externa no NetHunt, Gmail ou Drive; frontend não publicado.
- Repetição real da origem de tarefas: **1.556 registos, zero novas tarefas**, todas as 1.556 tarefas preservadas.
- Históricos que reutilizam um ID com conteúdos diferentes foram preservados como variantes distintas; nenhum conteúdo foi descartado por colisão.
- **8 testes de segurança passaram**. Pedido sem sessão válida recusado.
- Leitura autenticada confirmada: tarefa recuperada encontrada no conteúdo da vista Operações e descarga privada de um ficheiro com tamanho correto.
- Comentários relidos na base de dados. A confirmação visual ficou limitada pelo tutorial de boas-vindas existente; não foi alterado o tutorial nem a file para contornar isso.

## 5. Ordem recomendada

1. Rever as lacunas acima e obter as exportações que a API não fornece.
2. Reconciliar totais por pasta e associações locais; aceitar explicitamente quaisquer exceções.
3. Validar a independência operacional (incluindo Gmail e automações) e só depois executar o corte faseado já planeado.
4. No dia do corte, fazer captura final/delta e guardar novo relatório antes de terminar a subscrição.

**Este relatório não autoriza desligar o NetHunt nem certifica perda zero em categorias que a API não expõe.**

## Anexo técnico

- Execução: `7e22d8eb-30c3-412b-8f43-6583aa806f93`.
- Tabelas: `nethunt_archive_runs`, `nethunt_archive_sources`, `nethunt_archive_items`.
- Ficheiros: bucket privado `nethunt-final-archive`.
- Rotina publicada isoladamente: `nethunt-final-backfill` (ações autenticadas `start`, `next`, `report`, `retry`, `media`).
- Retomar origens falhadas/abandonadas através de `retry`; uma nova captura integral usa um novo `start`. Falhas de ficheiros ficam registadas para revisão; não há tarefas em segundo plano após este pedido.
- Migrations: `0043_nethunt_final_archive.sql`, `0044_nethunt_archive_no_anon.sql`, `0045_nethunt_archive_private_files.sql`.
- Código: `supabase/functions/nethunt-final-backfill/{index.ts,archive.ts,media.ts,archive.test.ts}`; notas em `AGENTS.md` e `roadmap.md`.

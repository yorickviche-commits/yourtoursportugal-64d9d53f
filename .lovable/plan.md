# Link comercial no Calendar e ajuste do “Book Now”

## Objetivo
Fazer duas alterações pequenas, mantendo toda a estrutura atual:

1. Todos os eventos automáticos do Google Calendar passam a começar com o link do programa comercial do cliente.
2. O botão “Book Now” fica mais abaixo e visualmente separado do resumo, com texto mais simples no itinerário digital e no PDF.

## Alterações

### 1. Programa comercial em todos os eventos Calendar
- Na sincronização do Calendar, procurar a proposta correspondente à versão LIVE da lead (`active_version`).
- Se essa versão não tiver proposta, usar como fallback a proposta de versão mais recente disponível para a lead.
- Acrescentar como primeira linha da descrição de cada evento:
  - `Programa comercial cliente: <link do itinerário digital/proposta>`
- Usar o link público direto da proposta publicada.
- Manter integralmente a lógica existente de um evento por dia em serviços multidia: o mesmo link comercial estará no início de cada evento diário.
- Quando o Calendar voltar a sincronizar, atualizar também o link caso a versão LIVE tenha mudado.
- Se ainda não existir proposta, criar/atualizar os eventos normalmente, sem uma linha vazia ou link inválido.

### 2. Botão “Book Now” no itinerário digital
- Retirar o botão da coluna lateral junto ao texto de resumo.
- Colocá-lo numa linha própria, abaixo da descrição, para libertar espaço e melhorar o alinhamento do cabeçalho.
- Dentro do botão apresentar apenas `Book Now`.
- Abaixo do botão apresentar apenas:
  - `Refundable Deposit if plans change*`
  - link `see terms and conditions`
- Aplicar o mesmo texto simplificado ao botão fixo de telemóvel, sem montante nem percentagem de depósito.
- Manter o destino WeTravel e o comportamento atual de abrir num novo separador.

### 3. Botão no PDF
- Manter o botão na secção de preço, abaixo do programa, em vez de ocupar espaço junto do resumo.
- Garantir que o botão contém apenas `BOOK NOW` e acrescentar por baixo a nota `Refundable Deposit if plans change*` com link clicável para os termos e condições.
- Preservar o link WeTravel clicável e o restante layout/conteúdo do PDF.

## Validação
- Confirmar uma lead `won` com proposta na versão LIVE e verificar que todos os eventos diários começam pelo mesmo link comercial correto.
- Confirmar o fallback numa lead cuja versão ativa ainda não tenha proposta.
- Verificar o itinerário digital em desktop e mobile: resumo livre, CTA abaixo, texto sem “Reserve Your Spot” nem “50% deposit”.
- Gerar o PDF e confirmar posicionamento, texto e links clicáveis.

## Detalhes técnicos
- Alterações limitadas à função de sincronização do Calendar, às traduções do CTA e às renderizações da proposta digital/PDF.
- Sem alterações à base de dados, permissões, estrutura das propostas ou lógica multidia.

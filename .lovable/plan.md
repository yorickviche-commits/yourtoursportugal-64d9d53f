# Links de clientes em propostas.yourtoursportugal.com

O site principal yourtoursportugal.com não é tocado: nenhuma alteração ao registo `@`, ao `www` nem ao e-mail.

## 1. Ligar só o subendereço (você, na GoDaddy)
- Recuperar primeiro o site principal (registo A `@` de volta ao valor antigo) e desligar yourtoursportugal.com nas Definições → Domínios.
- Ligar **propostas.yourtoursportugal.com**. O cartão de ligação mostra 2 registos, que só criam entradas novas: A `propostas` e TXT `_lovable.propostas`.
- **Não** o marcar como Principal: a app da equipa continua no endereço atual.

## 2. Nome do link igual ao PDF
- Propostas novas e novas versões passam a ter um link legível com o mesmo nome do PDF, por exemplo:
  `propostas.yourtoursportugal.com/proposal/yt5171-smith-douro-wine-12-15-may-2027-v1`
- Os links já enviados continuam a abrir.
- Se o nome já existir, junta-se um sufixo curto.

## 3. Caixinha do WhatsApp (foto + título do programa + resumo)
- O link copiado passa pelo nosso servidor de pré-visualização, que mostra ao WhatsApp a foto, o título e o resumo. A pessoa é depois levada para a proposta no novo endereço.
- **Limitação:** para a caixinha funcionar, o link copiado continua a mostrar o endereço técnico. O endereço da marca aparece quando o cliente abre a proposta.
- Para ter as duas coisas no mesmo link, o subendereço tem de passar pela Cloudflare (gratuito). Preparo esse passo à parte se quiser, também sem tocar no site.

## Detalhes técnicos
- `PUBLIC_APP_URL` = `https://propostas.yourtoursportugal.com`, ativado só depois de o domínio estar Ativo (confirmado com a verificação de domínio). Antes disso fica o `.lovable.app`, para os links nunca ficarem partidos.
- `proposal-preview` passa a redirecionar para `PUBLIC_APP_URL`. O MCP `draft-client-email` usa a mesma origem.
- Nova função `buildProposalSlug(lead_code, client, program, dates, version)`, partilhada com `buildPdfFilename`. Usada ao gerar `public_token` para propostas e versões novas; os tokens existentes não mudam.
- Testes: formato do link, sufixo quando o nome se repete e que nunca é gerado `yourtoursportugal.com` sem o subendereço.

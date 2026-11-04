# Endereço próprio yourtoursportugal.com nos links de clientes

## 1. Ligar o domínio (feito por si, sem código)
- No cartão de ligação: adicionar no fornecedor do domínio os registos indicados (A para `@` e `www`, TXT `_lovable`).
- Esperar propagação (até 72 h); o certificado https é automático.
- Definir `yourtoursportugal.com` como domínio Principal: o endereço antigo `.lovable.app` passa a redirecionar para ele, por isso links já enviados continuam a funcionar.
- Nota: se o e-mail usa este domínio, não apagar os registos MX existentes.

## 2. Links enviados aos clientes passam a usar sempre o domínio próprio
Hoje os links de proposta usam o endereço de onde a equipa está a trabalhar (ex.: preview Lovable), e os e-mails gerados pelo Claude usam fixo `yourtoursportugal.lovable.app`.
- Criar um único "endereço público" configurável (por defeito `https://yourtoursportugal.com`).
- Usá-lo em: links de proposta/itinerário digital, pré-visualização de itinerário, e e-mails redigidos por AI/MCP.
- Links internos (relatórios, convites da equipa) ficam como estão.

## Detalhes técnicos
- Nova constante `PUBLIC_APP_URL` em `src/lib/publicUrl.ts` (relativa para MCP); usada em `src/lib/proposalShare.ts`, `ItineraryEditor.tsx` (`/preview/`) e `src/lib/mcp/tools/draft-client-email.ts`.
- Teste: link de proposta gerado começa por `https://yourtoursportugal.com/proposal/`.
- Republicar a app e `mcp-agent-core` após a alteração.
- O endereço técnico do backend não aparece aos clientes; não é alterado.

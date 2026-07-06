## Diagnóstico

O link que aparece no WhatsApp na imagem é:

`https://yourtoursportugal.lovable.app/proposal/ytp-yt-2026-4237`

Esse é o link direto da app. WhatsApp não executa JavaScript, por isso só lê os metadados genéricos do `index.html` e mostra o título geral da Your Tours Portugal.

A função de preview já consegue gerar os dados certos para esta proposta:

- título do programa correto
- resumo correto
- imagem hero `https://...`

O problema principal é que o link partilhado continua a ser o URL direto `/proposal/...`, não um URL público que devolva HTML com os metadados específicos antes de abrir a proposta.

## Plano de correção

1. **Fazer o URL público da proposta funcionar diretamente em `/proposal/:token`**
   - Ajustar o fluxo para que links como `yourtoursportugal.lovable.app/proposal/ytp-...` possam devolver metadados específicos de WhatsApp/Facebook/LinkedIn.
   - Evitar depender de links técnicos da função backend na interface do utilizador.

2. **Manter a experiência normal para clientes**
   - Quando uma pessoa abre o link no browser, continua a ver a página pública da proposta normalmente.
   - Quando WhatsApp/crawlers leem o link, recebem `og:title`, `og:description` e `og:image` da proposta.

3. **Garantir os dados usados no preview**
   - Título: título real do programa, com ID/código visível quando existir.
   - Descrição: resumo do programa + datas quando disponíveis.
   - Imagem: hero image da proposta; se não for URL `https`, usar a primeira imagem válida do programa.

4. **Atualizar os botões/links visíveis na app**
   - O botão “Copiar link” deve copiar o link público limpo: `https://yourtoursportugal.lovable.app/proposal/...`.
   - Não mostrar/copiar links técnicos de backend na listagem.

5. **Validar**
   - Testar o HTML devolvido para o link `ytp-yt-2026-4237` e confirmar que contém os metadados esperados.
   - Confirmar que o link direto continua a abrir a proposta para utilizadores normais.

## Nota importante

Depois da correção e publicação, o WhatsApp pode continuar a mostrar o preview antigo durante algum tempo por cache. Para testar imediatamente, deve ser usado um URL ainda não partilhado antes ou uma versão com parâmetro novo, por exemplo `?v=3`.
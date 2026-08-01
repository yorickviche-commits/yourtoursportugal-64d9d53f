# Corrigir definitivamente o PDF e remover WhatsApp

## Objetivo
- Garantir que todo PDF do Travel Plan seja descarregado como:
  `YT4726 - Nome Cliente - Nome Programa - Datas Programa.pdf`
- Usar o idioma e os dados efetivamente guardados no Travel Plan.
- Remover toda a funcionalidade e apresentação de WhatsApp no frontend e backend.

## Diagnóstico confirmado
- O botão PDF interno usa `window.print()` e tenta influenciar o nome através de `document.title`. O nome final fica dependente do Chrome/sistema operativo e não é garantido.
- A página pública da proposta não aplica essa lógica e conserva o título genérico da aplicação, explicando `Your Travel 2.0 _ Lovable.pdf`.
- O registo YT4726 tem os dados necessários: cliente, título do programa, datas e idioma. O título guardado termina em `- YT4726`, que deve ser removido do nome do programa para não duplicar o ID no ficheiro.
- Existem botões WhatsApp no Travel Plan e na proposta pública, um contacto na secção “About Us”, textos auxiliares e deteção específica de crawler no backend. Não existe integração externa/API de WhatsApp nem tabelas dedicadas.

## Implementação

### 1. Nome de ficheiro único e reutilizável
- Criar uma função central para formar e sanitizar o nome nesta ordem exata: ID YT, cliente, programa e intervalo de datas.
- Priorizar `yt_id` em vez do ID interno.
- Remover do título do programa um ID YT repetido no início/fim.
- Formatar as datas com o locale do idioma do Travel Plan, mantendo o texto do programa e cliente no idioma em que foram gerados/guardados.
- Aplicar a mesma função ao PDF do Travel Planner e ao PDF anexado/enviado por email.

### 2. Download com nome garantido
- Deixar de depender de `window.print()` como mecanismo principal do botão PDF.
- Gerar o ficheiro e iniciar um download explícito com atributo `download="nome-exato.pdf"`; assim Chrome, WhatsApp e o sistema operativo recebem o nome definido pela aplicação.
- Manter o conteúdo atual do PDF, incluindo imagens, preço, Book Now e links clicáveis.
- Na proposta pública, definir também o título correto da página para que uma impressão manual do browser tenha o melhor nome possível, sem depender disso para o download oficial.
- Adicionar estado de geração ao botão para impedir cliques duplicados e mostrar erro claro se faltar algum dado obrigatório.

### 3. Remoção total de WhatsApp
- Remover os dois botões flutuantes e o contacto WhatsApp da proposta pública.
- Remover o botão flutuante do Travel Planner.
- Remover constantes, ícones e imports que fiquem sem uso.
- Retirar referências WhatsApp dos formulários, placeholders e contexto de IA, deixando apenas contacto por email/telefone quando aplicável.
- Retirar a deteção e comentários específicos de WhatsApp no backend de pré-visualização, preservando os restantes crawlers sociais.

## Validação
- Testar com YT4726 e confirmar o download com a estrutura exata e sem ID duplicado no título do programa.
- Confirmar a localização das datas em inglês para este Travel Plan e testar pelo menos outro idioma suportado.
- Abrir o PDF e verificar todas as páginas, imagens, Book Now e links.
- Pesquisar novamente todo o projeto para confirmar ausência de `WhatsApp`, `wa.me` e dos números associados.
- Confirmar que frontend e backend continuam sem erros após a remoção.

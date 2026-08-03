# Corrigir definitivamente o login e registo com Google

## Objetivo
Ter um único fluxo Google simples e estável para utilizadores existentes e novas contas, entrando sempre em **Leads** (ou regressando à página protegida originalmente pedida) sem ciclos para `/login`.

## Diagnóstico confirmado
- O fornecedor Google está a concluir a autenticação: os registos mostram trocas de token com estado `200`.
- As contas testadas existem, estão ativas e o respetivo `last_sign_in_at` é atualizado; Yorick mantém os papéis de administração e Reservas mantém `sales_agent`.
- O ciclo ocorre no frontend: a rota protegida avalia `user` antes de a sessão devolvida pelo fluxo Google estar confirmada/hidratada no cliente.
- O perfil e os papéis já são criados automaticamente para novas contas Google, portanto não é necessária alteração às tabelas nem às permissões.

## Implementação
1. **Reconfigurar o Google no modo gerido atual**
   - Reaplicar a configuração oficial de Google Sign-In para garantir fornecedor, URLs autorizadas e integração gerada consistentes.
   - Manter email/password ativo; não alterar contas, perfis, papéis ou permissões existentes.

2. **Criar uma conclusão de autenticação pública e determinística**
   - Adicionar uma rota pública de callback dedicada ao retorno do Google.
   - No callback, aguardar e validar a sessão real antes de navegar para uma área protegida.
   - Se a sessão não for estabelecida, mostrar um erro recuperável em vez de provocar um ciclo silencioso para o login.

3. **Unificar login e criação de conta Google**
   - Usar exatamente o mesmo fluxo oficial nos botões “Continuar com Google” e “Registar com Google”.
   - O Google cria automaticamente a conta quando é a primeira entrada e inicia sessão quando ela já existe.
   - Preservar apenas destinos internos seguros; por defeito, encaminhar para `/leads`.

4. **Tornar o estado global de autenticação resistente a corridas**
   - Inicializar explicitamente a sessão guardada e validar o utilizador antes de terminar o estado de carregamento.
   - Manter o listener de alterações para login, renovação e logout sem limpar uma sessão nova durante o retorno do Google.
   - Fazer a rota protegida esperar pela conclusão desta verificação antes de decidir redirecionar.

5. **Validar o fluxo completo**
   - Testar acesso direto a uma página protegida, retorno ao login, Google e regresso ao destino.
   - Testar utilizador Google existente e primeira entrada/criação de conta.
   - Confirmar sessão persistente após refresh e nova abertura da aplicação.
   - Confirmar que login por email/password e logout continuam intactos.

## Limites da alteração
- Apenas autenticação, callback e proteção de rotas.
- Sem mudanças no restante backend, dados, permissões, menus ou páginas operacionais.
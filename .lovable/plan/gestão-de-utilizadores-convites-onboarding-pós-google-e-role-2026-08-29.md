# Gestão de Utilizadores: convites, onboarding pós-Google e roles editáveis

## 1. Convidar utilizadores (página Utilizadores)

- Botão **Adicionar utilizador** no topo da página, abre modal com: email + role (Super Admin, Admin, Sales, Operations, Finance, B2B, Viewer, e quaisquer roles criados pelo admin).
- Ao confirmar: cria convite pendente (email, role, quem convidou, token, validade 14 dias) e envia email de convite pela infraestrutura de email já existente (conector Gmail, tal como os emails FSE), com botão "Entrar na plataforma" que aponta para o login com Google.
- A lista de utilizadores passa a mostrar, além dos utilizadores reais, os **convites pendentes** com badge `Pendente` e ações **Reenviar** e **Cancelar**. Utilizadores já registados continuam com `Ativo` / `Inativo`.
- O admin pode alterar o role de qualquer utilizador da lista (troca de role, não só adicionar/remover).

## 2. Página de onboarding depois do login Google

- Nova rota `/setup-account`.
- Depois do callback Google, se o perfil ainda não estiver concluído, o utilizador é enviado para lá antes de aceder ao backoffice.
- A página pede: nome completo, telefone e definição de **password** (para poder mais tarde entrar por email/password). Mostra o email (não editável).
- Ao submeter: guarda nome/telefone no perfil, define a password na conta, marca o onboarding como concluído e coloca o utilizador como `Ativo`; redirecciona para `/leads`.
- Quem já concluiu nunca volta a ver a página — vai direto para a app. Utilizadores existentes são considerados já concluídos (não são forçados a este passo).

## 3. Role por defeito

- Qualquer conta nova entra como **Viewer**.
- Se existir convite pendente e válido para aquele email, é aplicado o role do convite em vez de Viewer, e o convite passa a `aceite`.
- Para garantir que isto funciona também no login Google (onde o perfil é criado pela base de dados), a atribuição do role acontece do lado do servidor, no momento da criação da conta.

## 4. Roles personalizados e matriz de permissões

- Nova secção na página Utilizadores: **Roles** — criar um role novo (nome visível + código), editar o nome e eliminar roles personalizados. Os 7 roles de sistema não podem ser eliminados.
- Os roles personalizados aparecem automaticamente como coluna na **Matriz de Permissões**, onde se marca que páginas cada role vê.
- Sidebar e rotas continuam a esconder tudo o que não estiver marcado para os roles do utilizador (a lógica atual passa a considerar também os roles personalizados).
- Landing page: `/leads`. Se o role do utilizador não tiver acesso a Leads, cai na primeira página permitida.

## 5. Segurança

- Só Super Admin / Admin podem: criar/reenviar/cancelar convites, criar ou editar roles, alterar roles de utilizadores e editar a matriz de permissões — garantido por políticas na base de dados (via `has_role`), não apenas na interface.
- Cada utilizador pode ler e completar apenas o seu próprio onboarding.
- Os convites não ficam legíveis por utilizadores não-admin; a validação do convite durante o registo é feita no servidor.

## Detalhes técnicos

**Base de dados (migração)**
- `user_invites`: email (único quando pendente), role_code text, invited_by, token, expires_at, status (`pending|accepted|cancelled`), timestamps. RLS: gestão apenas para admins.
- `app_roles`: code (PK, text), label, is_system bool, timestamps — seed com os 7 roles atuais. RLS: leitura para autenticados, escrita só admins.
- `permissions.role` passa de enum `app_role` para `text` (a matriz não é usada em nenhuma policy nem em `has_role`, por isso a mudança é segura) para suportar roles personalizados.
- `user_roles` mantém-se em enum para não tocar em `has_role`/RLS existentes; roles personalizados são guardados numa tabela paralela `user_custom_roles(user_id, role_code)`, lida pela app em conjunto com `user_roles`.
- `profiles`: novas colunas `onboarding_completed_at` (perfis existentes marcados como concluídos) e reutilização de `phone`.
- `handle_new_user()` atualizado: aplica o role do convite pendente (quando existe) em vez de `viewer`, e marca o convite como aceite.

**Edge functions**
- `invite-user`: valida que o chamador é admin (JWT + `has_role`), grava/atualiza o convite e envia o email pelo conector Gmail (mesmo padrão de `send-booking-email`). Suporta reenvio.

**Frontend**
- `src/pages/AdminUsersPage.tsx`: botão + modal de convite, lista de convites pendentes com reenviar/cancelar, alteração de role por utilizador, secção de gestão de roles.
- `src/pages/SetupAccountPage.tsx` (novo) + rota em `src/App.tsx`.
- `src/components/ProtectedRoute.tsx`: redireciona para `/setup-account` enquanto o onboarding não estiver concluído.
- `src/hooks/useAuth.tsx`: expõe `onboardingCompleted` e roles personalizados.
- `src/hooks/usePagePermissions.ts` + `src/pages/AdminPermissionsPage.tsx`: colunas de roles vindas de `app_roles` em vez da lista fixa.

## Verificação

Convidar um email com role Sales, confirmar convite `Pendente` e email recebido; entrar com Google nessa conta, confirmar redireccionamento para `/setup-account`, definir password e dados, aterrar em `/leads` com role Sales; voltar a entrar e confirmar que não repete o onboarding; criar um role novo e confirmar que aparece na matriz e filtra o menu.

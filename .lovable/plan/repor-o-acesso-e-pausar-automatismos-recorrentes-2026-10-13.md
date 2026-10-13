# Repor o acesso e pausar automatismos recorrentes

## Causa do problema de login
A base de dados/autenticação (Lovable Cloud) está **pausada**. Enquanto estiver pausada, ninguém consegue entrar (email ou Google). Não é um erro do código.

## Passos
1. **Reativar o backend** (resume) e confirmar que fica saudável.
2. **Listar todas as tarefas automáticas agendadas** na base de dados (cron jobs: fila de emails, sincronizações NetHunt/Calendar/Drive, rotinas de agentes/JARVIS, heartbeats).
3. **Pausar os recorrentes que consomem** (agentes JARVIS, sincronizações periódicas, chamadas AI agendadas), guardando a lista exata para poder reativar depois. A fila de emails de autenticação (convites/recuperação de password) fica ativa, para não bloquear logins.
4. **Marcar agentes do registo JARVIS como "parado"** para que nada os volte a disparar.
5. **Testar o login** no preview com uma conta real e confirmar entrada em Leads.

## Notas
- As tarefas agendadas no Claude (fora do TCC) não são controladas daqui; terão de ser pausadas no Claude.
- Nada é apagado: só desativado, e reversível.

# Comunicações — AI Email Composer com estilo "casa YT"

Objetivo: enviar da app emails bonitos e personalizados ao cliente, com o mesmo estilo dos exemplos enviados (capa clicável, título + YT####, itinerário dia-a-dia com horas, Total Price, Important Notes, fecho), sem tocar no que já funciona (Gmail reservas, histórico, PDF, links WeTravel, tom de voz, deteção de idioma).

## O que muda para o utilizador

Um único ecrã de Comunicações com duas zonas:

1. **Histórico** — timeline limpa (enviados, drafts AI, notas internas), filtros (Todos / Enviados / Drafts / Internos), pesquisa por palavra, expandir sem sair da página, badge "AI".
2. **AI Email Composer** — sem ecrã de escolha de templates. O utilizador define To / CC / BCC, idioma (detetado, editável), Purpose e clica **Gerar Email**.

Purpose:

- Auto (recomendado)
- Proposta (1ª apresentação)
- Proposta atualizada / nova versão
- Boas-vindas
- Qualificação (falta informação)
- Follow-up
- Booking / Operações
- Custom

Auto decide sozinho pelo estado do lead: sem proposta e sem dados suficientes → Qualificação; sem proposta com dados → Boas-vindas; proposta v1 → Proposta; proposta com nova versão depois do último envio → Proposta atualizada; ganho/pago → Booking/Operações.

Antes de gerar, um painel mostra o contexto que a AI vai usar (perfil do lead, histórico de emails, proposta, itinerário, preferências, pagamentos, idioma, consultor) — apenas informativo, com ✓ / ✗ conforme o dado exista.

## Estilo do email gerado (igual aos exemplos)

Bloco visual fixo, sempre em HTML, no idioma do programa:

```text
Hi Ben,

[abertura contextual — 2 a 4 parágrafos curtos, negrito nos pontos-chave]

- - - - - - - - - - - - - - - - - - - - - - - -
Private Full Day Douro Valley Wine & Engagement Tour
Ben Davenport · 06 Sept 2026 - YT4897   (link para o itinerário digital)
[imagem de capa 21:9 clicável -> itinerário digital]

Day 1 — <título do dia>
ITINERARY & INCLUDED:
 • item .................................. 10:00
 • item .................................. 12:45

Total Price (All-Inclusive): 985,00 EUR

Important Notes:
 • ...

[Book Now — quando existe link WeTravel ativo]
- - - - - - - - - - - - - - - - - - - - - - - -

[Your Next Steps — 3 a 6 passos numerados com ação + responsável + prazo]

[assinatura do consultor + Your Tours Portugal]
```

Blocos editáveis independentes: Assunto, Saudação, Abertura, Conteúdo principal, Programa (auto do Travel Planner), Anexos, Links úteis, Next Steps, Assinatura. Cada bloco pode ser editado à mão, regenerado, encurtado, tornado mais premium/amigável ou traduzido, sem afetar os restantes. Pré-visualização lado a lado exatamente como o cliente vai receber.

Anexos e links são sugeridos automaticamente (PDF da proposta gerado pela app, link do itinerário digital, link de pagamento WeTravel, website, WhatsApp) e podem ser ligados/desligados — o texto do email ajusta-se quando um é removido.  
TEM QUE permitir facilmente editar e logo visivel no back todas as funcoes, seja de bolds, sublinhados, italicos, pontos, tamanhos e cor de letra (a letra assume sempre como standard Trebuchet Ms.

## Emails de Boas-vindas e Qualificação

Quando não há proposta ou faltam dados, a AI gera:

- **Boas-vindas**: agradecimento, o que vamos fazer, prazo de entrega da proposta, próximos passos.
- **Qualificação**: lista numerada só com o que realmente falta no lead (datas, pax/crianças, alojamento, voos, restrições alimentares, mobilidade, ocasião especial, orçamento), nunca a perguntar o que já sabemos.

Nestes dois casos não é incluído bloco de programa nem preço.

## Envio e histórico

O envio continua a passar pela mesma função Gmail já em produção ([reservas@yourtours.pt](mailto:reservas@yourtours.pt)), agora em HTML + versão texto, pelo que os emails continuam a aparecer imediatamente em "Enviados" no Gmail, com anexos. Cada envio, draft e regeneração fica registado no histórico com autor, data e purpose.

Antes de enviar: validação AI em modo aviso (anexos em falta, links inválidos, idioma inconsistente, nome do cliente, assinatura) — o utilizador mantém sempre o controlo.

## Faseamento

**Fase 1 (esta entrega)**
Nova UI de Comunicações (timeline + composer por blocos), motor de Purpose automático, geração AI com contexto completo, template HTML da casa YT, Next Steps obrigatório, anexos/links com toggles, envio Gmail em HTML, registo no histórico.

**Fase 2**
Versões de draft (guardar/comparar/restaurar), auto-save, sincronização inteligente ("itinerário desatualizado → atualizar bloco"), validação final AI mais rica, sincronização de emails recebidos da inbox reservas.

## Detalhe técnico

- `src/lib/emailHtml.ts` (novo): construtor do HTML da casa YT a partir dos blocos + proposta (capa, título linkado com YT####, dias com horas alinhadas, total, notas, Book Now). Inline styles compatíveis com Gmail; reutiliza `getProposalShareUrl` e `parseGoogleMapsUrl` já existentes.
- `src/components/communications/` (novo): `CommunicationsWorkspace.tsx`, `HistoryTimeline.tsx`, `ComposerHeader.tsx`, `ContextPanel.tsx`, `BlockEditor.tsx`, `SuggestionsPanel.tsx`, `EmailPreview.tsx`. `CommunicationsTab.tsx` passa a wrapper para não quebrar `LeadDetailPage`, `TripDetailPage` e `MobilePage`.
- `supabase/functions/generate-email/index.ts`: mantém os templates e o tom atuais e passa a devolver **blocos** (`subject_options`, `greeting`, `opening`, `main`, `next_steps[]`, `attachments_suggested`, `links_suggested`, `signature`) + `purpose_resolved`. Novo modo `blockKey` para regenerar/reescrever um único bloco. Contexto ampliado no servidor com `lead_planner_data`, `proposals` (dias, total, token público, logo), `lead_operations`, `lead_payments`, `payment_links` ativos e últimos `booking_emails_log`. Fallback AI atual (Gemini direto → gateway Lovable) mantido; erros 402/429 mostrados como aviso de créditos.
- `send-booking-email`: sem alterações de contrato — já aceita `html`, `cc`, `bcc`, `attachments` e gera a alternativa em texto.
- `booking_emails_log`: passa a guardar `email_category` = purpose e o HTML no corpo; sem migração de esquema necessária.
- `EmailComposerDialog.tsx` mantém-se disponível até a nova UI estar validada, para não perder nenhum fluxo atual.
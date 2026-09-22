# MCP de escrita e exportação — Your Travel 2.0

Objetivo: os agentes AI passam a preparar ficheiros de venda sem abrir o TCC no Chrome.

## Ferramentas novas (todas com OAuth + RLS do utilizador autenticado)

| Ferramenta | Tipo | O que faz |
|---|---|---|
| `list_lead_stages` | leitura | Devolve os 11 estados válidos (código + label, grupo SALES/OPERATIONS) |
| `update_lead_stage` | escrita | Muda o estado como o dropdown do cabeçalho; sincroniza NetHunt; devolve antes → depois + resultado do sync |
| `assign_lead_agents` | escrita | Atribui até 2 agentes por nome ou email; erro com a lista de utilizadores válidos |
| `update_lead_general_data` | escrita | Só campos permitidos: datas, adultos/jovens/crianças/bebés, idioma, B2C/B2B, telefone, categoria, destino. Reflete na proposta da versão LIVE |
| `get_travel_plan` | leitura | Título, subtítulo, resumo, dia-a-dia, hotéis e link do itinerário digital |
| `export_travel_plan_pdf` | escrita | Gera o PDF do programa, guarda em bucket privado e devolve signed URL de 7 dias + avisos |
| `add_lead_note` | escrita | Nota interna na timeline; replica como comentário no NetHunt quando a lead está ligada |
| `list_leads` (melhorado) | leitura | Novos filtros `stage`, `search`, `agent`, `trip_start_from/to`, `updated_since`; linhas com agentes, totais, depositado, em falta, NetHunt e URL da lead |
| `get_lead` (corrigido) | leitura | Passa a aceitar `YT5130`, `YT-5130`, minúsculas e o código interno `YT-2026-5130` |

Regras aplicadas a todas: identificação por `lead_id` ou `lead_code`; auditoria no histórico com actor "AI agent (MCP)" + utilizador; nunca envia emails, nunca cria links de pagamento, nunca apaga nada; erros com lista de valores válidos; repetir a chamada não duplica nada.

## Como o PDF é gerado (decisão técnica)

O PDF que hoje sai no botão "Imprimir" é produzido no browser: a página pública é rasterizada com html2canvas e paginada com jsPDF. Isso exige um Chrome — não existe no servidor e não há serviço de rendering headless no stack atual.

Opção escolhida: reutilizar o outro gerador que já usamos para clientes — o construtor vetorial jsPDF (`proposalPdf`), portado para uma versão que corre no servidor a partir dos mesmos dados da proposta (capa, dia-a-dia, imagens, mapas estáticos, hotéis, preço, reviews, logótipo B2B, respeitando os toggles de preço/termos/reviews/about).

Consequências, ditas com clareza:
- Conteúdo, ordem, idioma e imagens: iguais ao da UI.
- Tipo de ficheiro: melhor que a impressão — texto vetorial, pesquisável e mais leve, em vez de páginas em imagem.
- Diferenças visuais residuais possíveis em espaçamentos finos face à rasterização do browser. Se preferires fidelidade pixel-a-pixel, isso obriga a contratar um serviço de rendering headless — digo-te o custo/alternativa se quiseres seguir esse caminho.

Ficheiro: `travel-plan-pdfs/<lead_code>/<lead_code> - <cliente> - <título>.pdf`, bucket privado, signed URL 7 dias. Output inclui páginas, tamanho, versão usada e avisos ("Dia 2 sem mapa", "Dia 4 sem imagens").

## Detalhes técnicos

- Novos ficheiros em `src/lib/mcp/tools/` + registo em `src/lib/mcp/index.ts`; `.lovable/mcp/manifest.json` regenerado pelo extractor.
- Helper partilhado `src/lib/mcp/lead.ts`: resolução de lead por uuid/`yt_id`/`lead_code` normalizado, e escrita de auditoria em `activity_logs` + `lead_stage_history`.
- Sync NetHunt via a edge function existente `nethunt-push` (mesma que a UI usa), invocada com o token do utilizador; resposta traduzida para ok / não ligado / erro.
- Agentes: valida contra `profiles`, grava `leads.assigned_agents` e dispara o mesmo sync de calendário da UI.
- Dados gerais: grava na versão LIVE e corre a mesma sincronização para a proposta (`syncGeneralToProposal`) já usada ao gravar na UI.
- PDF: novo módulo Deno-compatível dentro de `supabase/functions/_shared/` reutilizado pela ferramenta MCP; bucket privado criado por migração de storage (sem alterações de schema de tabelas).
- Depois das edições: extração do manifest e republicação da app (o MCP só fica ativo para o Claude após publicar).

## Aceitação a testar

1. `get_lead` com `YT5130`.
2. `update_lead_stage` YT5130 → Final Negotiation (visível na UI + histórico).
3. `assign_lead_agents` YT5130 → Yorick Viche no cabeçalho.
4. `export_travel_plan_pdf` YT5104 → PDF completo com avisos dos dias sem mapa.
5. `get_travel_plan` YT5104 → 7 dias.
6. `list_leads` com `stage=Budgeting & Fine-Tuning`.

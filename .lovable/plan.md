# Ops Wizard — Calendário como centro da página

## 1. Calendário com bloco próprio, no topo

- O calendário deixa de ser um "modo" do bloco Pipeline e passa a ter o seu próprio bloco dedicado, colocado imediatamente **abaixo dos KPIs** (ações críticas, a aguardar FSE, reservas bloqueadas, partidas ≤7 dias) e **acima** de todas as chavetas.
- Bloco sempre aberto por defeito, largura total, células de dia maiores para caber vários eventos legíveis.
- Cada evento (partida) mostra: ref YT, cliente, pax e um ponto de estado — verde READY TO GO (4 pilares OK), âmbar parcial, vermelho em falta/bloqueado.
- Barra do bloco: navegação de mês (‹ hoje ›), contagem de partidas e pax do mês, e filtro rápido TODAS / READY / EM FALTA.
- Legenda curta de cores para leitura imediata.

## 2. Pop-up do evento com ações

Ao clicar num evento abre o cartão de resumo já existente, reforçado com:
- ref YT, cliente, produto, data de partida, pax, idioma, fase e % de prontidão;
- os 4 pilares como chips (Pagamentos, Reservas FSE, Briefing FSE, Briefing cliente) e a lista do que falta;
- botões: **Abrir lead** (navegação interna), **Google Calendar**, **Email (Gmail)** e **CRM/NetHunt** — todos os externos abrem em nova página; **Ver no pipeline** selecciona a fase da reserva na chaveta do pipeline.

## 3. Pipeline operacional numa só linha

- O bloco Pipeline perde o selector PIPELINE/CALENDÁRIO e passa a mostrar as 8 fases como **uma única linha horizontal** de chips (nome curto da fase + contagem + ponto vermelho quando há bloqueios), com scroll horizontal apenas se necessário.
- Clicar num chip filtra a lista de reservas dessa fase, que fica logo abaixo na mesma chaveta (comportamento actual mantido, incluindo expansão da reserva e deep links).
- Filtros TODAS / ≤7 DIAS / BLOQUEADAS ficam no cabeçalho da chaveta.

## 4. Ordem final da página

```text
Header + KPIs
CALENDÁRIO OPS (bloco dedicado, aberto)
▸ Pipeline operacional (1 linha de fases)
▸ Fila de prioridade
▸ Informação em falta
▸ Atividade recente
```

## Notas técnicas

- Só `src/pages/OpsWizardPage.tsx` é alterado: remover o estado `view`, criar bloco `Section` próprio para o calendário, mover a chaveta do pipeline para depois do calendário, converter a lista vertical de fases numa linha de chips e reordenar os `Section`.
- `ReservasCalendar` ganha props de filtro de estado e usa `pillarStatus` / `readinessPercent` de `src/lib/readiness.ts` para a cor do evento; sem alterações a hooks ou dados.
- Deep links do pop-up vêm de `booking.links` (já construídos em `useOpsData`) e abrem com `target="_blank"` + `noopener`.

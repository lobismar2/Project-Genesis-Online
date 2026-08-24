# Auditoria de expansão MMORPG — Project Genesis

**Data da pesquisa:** 22 de agosto de 2026  
**Escopo:** referências públicas do Warspear Online, padrões de MMORPG acessível e estado atual do Project Genesis.  
**Decisão de produto:** usar Warspear como referência de amplitude e loops, nunca como fonte para copiar mapas, textos, nomes, personagens, arte ou código.

## 1. Resumo executivo

O Genesis já tem uma base jogável forte: quatro mapas conectados, oito classes, combate em Canvas, mobs com comportamentos distintos, chefe, missões encadeadas, inventário, equipamentos, moedas, conquistas, minimapa, modo solo offline e cooperação autenticada.

O maior gargalo para alcançar público amplo não é adicionar dezenas de mapas imediatamente. É criar **hubs com serviços compreensíveis**, uma economia pequena e segura, variedade de objetivos, cooperação opcional e um onboarding que explique tudo em poucos minutos. A recomendação é:

1. transformar cada mapa em uma experiência com motivo para voltar;
2. criar uma vila/base neutra com banco, vendedor, comprador, alquimista e ferreiro;
3. introduzir poções e venda/recompra antes de crafting complexo;
4. adicionar uma segunda camada de mapas somente depois de validar a economia e a navegação;
5. construir socialização assíncrona e cooperação sem exigir PvP ou grupo para progredir.

## 2. Fontes públicas e nível de confiança

| Fonte | Evidência observada | Confiança |
|---|---|---|
| [Site oficial do Warspear Online](https://warspear-online.com/en) | Página oficial; metadata identifica o produto como MMORPG para smartphones e a página expõe idiomas e canais oficiais. | Alta para posicionamento |
| [Download oficial](https://warspear-online.com/en/download) | Link de distribuição presente no site oficial. | Alta |
| [Fórum internacional oficial](https://forum.warspear-online.com/index.php/forum/3-international/) | Canal comunitário oficial linkado pelo site. | Alta para existência da comunidade |
| [Notícias oficiais](https://warspear-online.com/en/news) | A página oficial expõe notícias/eventos com links para bônus, temporadas, arena e eventos semanais; os itens são evidência de live-ops, não de detalhes internos. | Alta para calendário público |
| [Warspear Online na Steam](https://store.steampowered.com/app/326360/Warspear_Online/) | Descrição pública: MMORPG 2D, mundo aberto, PvP free-for-all, guildas, guerras de alianças, dungeons e eventos. | Alta para recursos anunciados |
| [Warspear Online no Google Play](https://play.google.com/store/apps/details?id=com.aigrind.warspear) | Descrição pública: MMORPG pixel-art, dungeons, ilhas e “1500+ quest rpg”. A página também expõe classificação e posicionamento mobile. | Alta para posicionamento; média para contagem atual |

### Limitações da pesquisa

O indexador de busca não esteve disponível nesta execução. As páginas acima foram consultadas diretamente por HTTP. Wikis e comentários comunitários não foram tratados como fonte factual quando não puderam ser triangulados. Qualquer detalhe de taxas, tabelas de drop, preços ou regras internas do Warspear deve ser validado antes de virar requisito.

## 3. O que o posicionamento público ensina

### 3.1 Amplitude percebida

O anúncio público combina exploração, combate, dungeons, PvP, guildas, guerras e eventos. Isso cria uma promessa de mundo vivo, não apenas uma campanha linear. Para o Genesis, a lição é oferecer **vários motivos de sessão** sem obrigar o jogador casual a dominar todos:

- campanha principal para quem quer história e progressão;
- caça a mobs e drops para sessões curtas;
- dungeons/eventos para objetivos cooperativos;
- atividades sociais e cosméticas para retorno;
- PvP apenas como camada posterior e opt-in.

### 3.2 Distribuição e descoberta

O site oficial, a Steam e o Google Play indicam alcance para desktop e mobile. O Genesis deve tratar o mobile como produto de primeira classe:

- botões grandes e alvos legíveis;
- HUD adaptável a recortes/notches;
- tutorial sem depender de teclado;
- baixo número de ações simultâneas;
- recuperação de sessão e progresso sem fricção;
- performance previsível em telas menores.

### 3.3 Conteúdo recorrente

As notícias públicas observadas incluem temporadas, arena, bônus e eventos semanais. A implementação equivalente do Genesis não deve começar por uma loja de dinheiro real. Deve começar por **eventos rotativos gratuitos**:

- evento semanal de uma região;
- mob raro com telemetria visual;
- missão diária curta;
- desafio de dungeon com modificador;
- recompensa cosmética ou título.

## 4. Auditoria do estado atual do Genesis

### Pontos fortes já presentes

- Quatro biomas jogáveis: Floresta, Caverna, Geleira e Vulcão.
- Rotas e portais com retorno ao ciclo do mundo.
- Oito classes divididas entre duas facções.
- Mobs melee, ranged, charger, summoner e chefe com fases.
- XP, níveis, mana/energia, habilidades e recargas.
- Armas, armaduras, raridade, coleta, equipamento e bolsa persistente.
- Missões com aceitação, progresso, conclusão e recompensa idempotente.
- Moedas persistentes com migração defensiva.
- Modo solo offline em `localStorage`.
- Sessão autenticada, salas e combate cooperativo.
- Controles touch, joystick, hotbar e minimapa.
- Assets próprios/reutilizáveis e fallback procedural.

### Lacunas prioritárias

| Lacuna | Impacto | Esforço | Risco | Prioridade |
|---|---:|---:|---:|---:|
| Banco e armazenamento seguro | Alto | Médio | Baixo | P0 |
| Vendedor, comprador e recompra | Alto | Médio | Médio | P0 |
| Poções com catálogo, cooldown e leitura clara | Alto | Baixo | Baixo | P0 |
| NPCs com serviços e marcadores | Alto | Médio | Baixo | P0 |
| Mapa com hubs/POIs em vez de só portais | Alto | Médio | Médio | P1 |
| Drop tables por mob e recompensa previsível | Alto | Médio | Médio | P1 |
| Dungeons instanciadas e eventos rotativos | Alto | Alto | Alto | P1 |
| Guilda/lista de amigos/presença | Médio/alto | Alto | Alto | P2 |
| PvP competitivo | Médio | Alto | Alto | P3 |
| Auction house/troca entre jogadores | Médio | Muito alto | Muito alto | P3 |

## 5. Expansão de mapas recomendada

Não adicionar mapas planos apenas para aumentar contagem. Cada região deve ter uma função, uma fantasia visual, três tipos de atividade e um retorno claro ao hub.

### Arco 1 — Reino das Raízes

1. **Vila do Limiar** — hub seguro; banco, vendedor, comprador, alquimista, ferreiro, missões e entrada de grupo.
2. **Bosque Luminescente** — mobs iniciais, coleta de ervas, trilha tutorial e primeiro evento.
3. **Pântano dos Sussurros** — terreno lento, veneno, rotas alternativas e caçador raro.
4. **Ruínas do Observatório** — mini-dungeon com alavancas, salas curtas e chefe.

### Arco 2 — Fronteira Mineral

5. **Cavernas de Cristal** — mineração/coleta, morcegos e espectros, visibilidade reduzida com acessibilidade opcional.
6. **Forja Abandonada** — ferreiro, reparo, materiais e inimigos mecânicos.
7. **Geleira do Silêncio** — gelo como risco de navegação, resgate de NPCs e evento cooperativo.
8. **Caldeira Rubra** — conteúdo de nível alto, ondas e chefe com telegráficos legíveis.

### Arco 3 — Conteúdo de retorno

9. **Ilhas do Vento** — mapa curto com transporte e desafios semanais.
10. **Santuário Invertido** — dungeon modular com três variações de sala.
11. **Campos de Eclipse** — evento temporal, mob raro e recompensas cosméticas.

### Regras de construção

- Todo mapa novo precisa de uma safe zone e uma rota de saída visível.
- Todo mapa precisa de pelo menos um objetivo que não seja matar.
- Mobs devem ter silhueta, cor de telegráfico e som/feedback distintos.
- Dungeons devem durar aproximadamente 8–15 minutos em primeira conclusão.
- O minimapa deve mostrar hub, missão, saída, NPC de serviço e perigo, sem revelar tudo.
- Gerar mapas proceduralmente somente onde a aleatoriedade não prejudicar navegação ou missão.

## 6. Catálogo de mobs

| Função | Exemplo próprio | Comportamento | Drop principal |
|---|---|---|---|
| Tutorial | Roedor de Raiz | Investida curta, telegráfico amplo | moeda, material comum |
| Pressão | Saqueador de Lodo | Persegue e reduz velocidade | moeda, poção fraca |
| Controle | Tecelão de Névoa | Área de lentidão/veneno | reagente |
| Alcance | Sentinela de Cristal | Projétil com aviso | equipamento incomum |
| Tanque | Guardião de Basalto | Ataque lento, frente protegida | material raro |
| Suporte | Parasita Luminoso | Cura ou fortalece outro mob | chance de drop especial |
| Evento | Predador Eclipse | Surge em janela rotativa | ficha cosmética |
| Elite | Vigia da Forja | Dois padrões alternados | equipamento garantido |
| Chefe | identidade inédita por região | fases, adds e telegráficos | item de campanha + título |

Regras de justiça:

- drops devem ensinar sua utilidade antes de exigir o item;
- o jogador deve ver por que morreu;
- elites não podem bloquear a campanha principal;
- recompensa de grupo deve evitar que o último golpe seja a única coisa que importa;
- itens essenciais devem ter proteção contra azar excessivo.

## 7. NPCs de serviços

### Banco — “Guardião do Cofre”

- Abre armazenamento persistente por personagem.
- Segunda aba opcional compartilhada por conta somente quando a autenticação estiver confirmada.
- Depósito/retirada em lote.
- Busca por nome, filtro por tipo e filtro por raridade.
- Nunca perde item em falha de rede: operação com idempotency key e confirmação visual.
- Offline: banco local por personagem; sincronização explícita quando autenticado.

### Vendedor — “Armeiro do Limiar”

- Vende equipamento básico, frascos e materiais de entrada.
- Preços estáveis e visíveis antes da compra.
- Limite de estoque apenas se houver motivo de design; não usar escassez artificial no onboarding.
- Confirmação para compra acima de um limite.

### Comprador — “Coletora de Relíquias”

- Compra drops por preço menor que o vendedor.
- Mostra valor de venda em cada item.
- Recompra os últimos 10 itens vendidos por uma janela curta.
- Marca itens de missão, equipados e raros como “não vender” por padrão.
- Venda em lote com resumo e desfazer imediato.

### Alquimista

- Poção de vida: restaura uma fração limitada, cooldown compartilhado.
- Poção de mana: restaura mana, cooldown separado ou custo de oportunidade claro.
- Antídoto: remove veneno, não deve ser obrigatório em todo combate.
- Tônico de evento: buff curto, sem aumentar dano a ponto de virar pay-to-win.
- O jogador pode usar frasco pela hotbar e pela bolsa.

### Ferreiro

- Equipar, comparar, reparar e futuramente melhorar.
- Reparos devem ser um sink suave, nunca bloquear jogador sem moedas.
- Comparação precisa mostrar “equipado / novo / diferença”.

### Outros NPCs

- Guia de missão: objetivo, recompensa, próximo passo.
- Mestre de transporte: viagem desbloqueada entre hubs.
- Organizador de grupo: entrada de dungeon e convite.
- Cronista: eventos, conquistas, tutorial e histórico.
- Curandeiro: recuperação em safe zone para reduzir fricção.

## 8. Economia recomendada

### Moedas e fontes

Manter inicialmente uma única moeda macia, **moedas**, para compreensão. Fontes:

- mobs: recompensa pequena por nível;
- missão: recompensa garantida;
- evento/dungeon: recompensa por conclusão;
- venda: conversão de drops não desejados.

### Sinks

- reparo;
- transporte depois que o mapa for desbloqueado;
- expansão de slots do banco/bolsa;
- crafting básico;
- cosméticos e títulos;
- taxa pequena de serviço, nunca taxa surpresa.

### Faixa inicial proposta

Esses números são ponto de partida para playtest, não fatos do Warspear:

- mob comum: 1–4 moedas;
- elite: 8–20 moedas;
- missão curta: 25–60 moedas;
- dungeon: 70–150 moedas;
- poção básica: 8–15 moedas;
- reparo de equipamento comum: 5–20 moedas;
- expansão inicial de banco: 250 moedas.

O objetivo é o jogador comprar uma poção nos primeiros minutos, obter a primeira expansão do banco em uma sessão curta e ainda guardar dinheiro para uma decisão posterior.

### Proteções

- limites server-side para quantidade, preço e frequência;
- ledger de recompensa para missões, eventos e dungeons;
- nenhuma moeda confiável vinda do cliente sem validação;
- revisão de transações em coop por sequência e idempotência;
- log de compra/venda/recompra;
- moeda não deve ser perdida em timeout; transação precisa ser confirmada ou revertida.

### O que não fazer agora

- auction house;
- troca livre de itens sem escopo de conta/personagem;
- duas ou mais moedas premium;
- loot box;
- venda de poder;
- inflação por recompensa ilimitada em mobs.

## 9. UX e acessibilidade para público amplo

### Primeiro minuto

1. escolher facção e classe com papel, vida, alcance e dificuldade explícitos;
2. mover-se até o marcador de missão;
3. atacar um mob com telegráfico legível;
4. coletar um item e equipá-lo;
5. usar uma poção;
6. voltar ao NPC e ver a recompensa;
7. abrir o banco somente depois que o conceito de inventário estiver entendido.

### Requisitos

- escala de UI pequena/média/grande;
- modo de alto contraste;
- opção de reduzir flashes e tremor;
- feedback de dano por cor + forma/texto, não apenas cor;
- áreas de toque mínimas de 44 px;
- controle teclado, toque e mouse;
- pausa segura no modo solo;
- mensagens de erro acionáveis;
- tradução preparada para português, espanhol e inglês;
- textos curtos, com glossário contextual;
- não exigir PvP, voz ou cooperação para completar campanha.

## 10. Roadmap priorizado

### Fase P0 — Serviços e economia básica

- banco local/remoto com slots e operações idempotentes;
- vendedor, comprador, recompra e proteção de itens;
- poções de vida/mana/antídoto;
- markers de NPC e painel de preços;
- testes de economia, migração e falha de rede.

**Aceite:** jogador consegue guardar, comprar, vender, recomprar e usar poções sem perder item/moeda offline ou autenticado.

### Fase P1 — Mundo com motivo para retornar

- Vila do Limiar como hub;
- POIs, transporte e rotas alternativas;
- famílias novas de mobs;
- mini-dungeon de 8–15 minutos;
- evento semanal gratuito;
- drops por função e telegráficos.

**Aceite:** cada mapa tem objetivo de exploração, combate e serviço; o jogador sabe para onde ir sem tutorial externo.

### Fase P2 — Social casual

- lista de amigos e presença simples;
- convite de grupo;
- dungeon cooperativa opcional;
- contribuição de dano compartilhada;
- placar de eventos sem ranking predatório;
- recompensas cosméticas e títulos.

**Aceite:** dois jogadores concluem uma atividade curta com progresso consistente e sem sobrescrita de save.

### Fase P3 — Endgame responsável

- variações de dungeon;
- temporadas de conteúdo com calendário;
- guildas pequenas;
- PvP opt-in separado da progressão PvE;
- troca/mercado somente após telemetria e controles anti-abuso.

**Aceite:** conteúdo de retorno não cria obrigação diária, inflação descontrolada ou vantagem paga.

## 11. Métricas para validar alcance

Não medir apenas tempo total jogado. Acompanhar:

- conclusão do onboarding;
- primeiro item equipado;
- primeiro uso de poção;
- primeira visita ao banco;
- primeira compra e primeira venda;
- conclusão da primeira missão;
- abandono por tela/etapa;
- tempo até entender o próximo objetivo;
- taxa de retorno após 1 e 7 dias;
- sessões mobile sem erro ou toque bloqueado;
- conclusão de dungeon solo e coop;
- perdas de progresso e conflitos de revisão;
- inflação média de moedas por personagem;
- porcentagem de drops vendidos versus equipados.

## 12. Decisão final

O Genesis deve buscar a **clareza e a amplitude percebida** de um MMORPG, não a quantidade bruta de sistemas. A sequência mais segura é banco + comércio básico + poções, depois hubs e dungeons, depois socialização. O crescimento de mapas sem serviços e sem economia compreensível aumentaria manutenção sem aumentar retenção.

Todas as propostas acima são designs originais. Os nomes sugeridos são placeholders do Genesis, e qualquer asset final deve ser criado ou licenciado para o projeto.

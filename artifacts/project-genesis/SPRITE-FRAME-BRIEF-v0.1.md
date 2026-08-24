# Project Genesis — Brief de frames de sprites v0.1

Documento para completar o anexo `project-genesis-sprites-v0.1.zip`.

> O anexo atual contém 8 portraits + 8 ícones de personagens, 4 portraits de NPCs, `manifest.json`, `README.md` e `LICENSE.txt`. As pastas de animação, inimigos, habilidades, itens, tiles, objetos, efeitos e HUD estão preparadas, mas ainda sem arquivos.

## Padrão técnico

- PNG RGBA transparente.
- Pixel art nítido, sem blur, anti-aliasing ou suavização.
- Manter a aparência dos portraits existentes.
- Direções: `south`, `east`, `north`, `west`.
- Pés alinhados em todos os frames.
- Mesmo tamanho dentro de cada conjunto.
- Entregar `manifest.json` com tamanho dos frames, colunas, linhas, estados, direções e FPS.
- Todo ataque deve indicar claramente o frame ativo de impacto.
- Todo asset deve ter fallback.

## 1. Personagens jogáveis

Para cada ID criar `idle`, `walk`, `attack`, `hurt` e `dead`, além do portrait/icon já existente.

### Sequência padrão

**Idle — 4 frames por direção**

1. Pose neutra.
2. Respiração/pequeno movimento.
3. Movimento de tecido, folhas ou energia.
4. Retorno à pose inicial.

**Walk — 8 frames por direção**

1. Pé levantando.
2. Primeiro passo.
3. Corpo passando pelo centro.
4. Segundo pé avançando.
5. Pernas mais abertas.
6. Pé tocando o chão.
7. Corpo passando pelo centro.
8. Retorno ao início.

**Attack — 6 frames por direção**

1. Preparação.
2. Recuo/armamento.
3. Início do golpe.
4. **Impacto ativo e aplicação de dano.**
5. Recuperação.
6. Retorno à pose de combate.

**Hurt — 3 frames**

1. Impacto.
2. Reação máxima com brilho curto.
3. Recuperação.

**Dead — 6 frames**

1. Perde equilíbrio.
2. Começa a cair.
3. Queda principal.
4. Corpo no chão.
5. Poeira/energia.
6. Pose final.

### Classes

| ID | Visual | Ataque básico | Efeitos próprios |
|---|---|---|---|
| `moss` | Gigante vegetal, casca, musgo e raízes | Golpe pesado de braço/raiz; impacto no frame 4 | `root` raízes, `slam` impacto, `bark` escudo, `forest` cura |
| `thorn` | Caçador vegetal e espinhos rosa | Disparo; mostrar tensão e saída do projétil | `volley`, `snare`, `venom`, `bramble` |
| `spore` | Criatura fúngica, brilho roxo | Projétil de esporo no frame 4 | `sporebolt`, `cloud`, `mend`, `bloom` |
| `mother` | Guardião ancestral, raízes e seiva | Chicote de vinha estendido | `vine`, `ward`, `pulse`, `grove` |
| `tungsten` | Tanque industrial, armadura ciano | Golpe pesado com faísca metálica | `bash`, `guard`, `magnet`, `fortress` |
| `neon` | Duelista ágil, lâminas verde-neon | Corte veloz com rastro luminoso | `dash`, `parry`, `flurry`, `afterimage` |
| `hex` | Atirador tecnológico, energia laranja | Disparo com recuo e projétil visível | `shot`, `mine`, `overclock`, `barrage` |
| `bio` | Artífice biocibernético e drone | Pulso de dispositivo turquesa | `drone`, `patch`, `shock`, `singularity` |

## 2. Inimigos

Criar para cada inimigo: `idle` 4 frames, `walk` 6 frames, `attack` 5 frames, `hurt` 2 frames, `dead` 5 frames, portrait e icon. Humanoides devem ter quatro direções; criaturas podem usar espelhamento apenas se não perderem identidade.

Ataque comum: frame 1 prepara, frame 2 avança, frame 3 é o **frame ativo**, frame 4 recupera e frame 5 retorna ao idle.

| ID | Nome | O que os frames devem representar |
|---|---|---|
| `rat` | Rato-pardo | Corrida baixa, mordida/investida no frame 3, queda de lado |
| `crab` | Caranguejo | Movimento lateral, pinça fechando no frame 3, casco virando na morte |
| `bat` | Morcego | Asas batendo, voo oscilante, pulso/projétil no frame 3, queda |
| `goblin` | Goblin | Corrida inclinada, golpe de arma no frame 3, queda para trás |
| `skeleton` | Esqueleto | Caminhada irregular, projétil ósseo/mágico no frame 3, ossos desmontando |
| `snake` | Serpente | Ondulação, bote com cabeça avançada no frame 3, corpo enrolando |
| `ogre` | Ogro | Passos pesados, golpe de grande alcance, queda com poeira |
| `spectre` | Espectro | Flutuação, deslizamento, onda espectral no frame 3, dissolução |
| `deathknight` | Cavaleiro da Morte | Passos de armadura, golpe pesado no frame 3, queda ajoelhada |

## 3. Rei Esqueleto

Criar pastas `phase1`, `phase2` e `phase3`. Para cada fase:

- `idle`: 6 frames.
- `walk`: 8 frames.
- `attack_melee`: 8 frames.
- `attack_ranged`: 8 frames.
- `summon`: 10 frames.
- `hurt`: 3 frames.
- `phase_change`: 12 frames.
- `intro`: 12 frames.
- `dead`: 10 frames na fase final.
- Portrait e icon.

### Fases

- **Fase 1:** coroa, aura dourada discreta, golpes básicos e invocação.
- **Fase 2:** armadura/energia alterada, investida, aura dourada e vermelha.
- **Fase 3:** aura forte dourada/vermelha/preta, ataques múltiplos, queda da coroa e explosão final.

Em todos os ataques: preparação, formação, deslocamento, **impacto no frame ativo**, recuperação e dissipação. O chefe deve ser próprio, não um esqueleto ampliado.

## 4. NPCs

Para cada NPC criar idle com 4 frames por direção, portrait, icon, `quest_available` e `quest_ready`.

| ID | Nome | Gesto de idle |
|---|---|---|
| `guide` | Guardião da Árvore-Mãe | Cajado/mão levantada e folhas se movendo |
| `elder` | Ancião da Floresta | Apoia-se no cajado ou consulta um tomo |
| `smith` | Ferreiro do Consórcio | Martelo, ferramenta e faísca |
| `sentry` | Sentinela Neon | Verifica a arma ou faz saudação |

## 5. Habilidades

Criar um ícone 32×32 ou 48×48 e um efeito de 6–12 frames para cada:

`root`, `slam`, `bark`, `forest`, `volley`, `snare`, `venom`, `bramble`, `sporebolt`, `cloud`, `mend`, `bloom`, `vine`, `ward`, `pulse`, `grove`, `bash`, `guard`, `magnet`, `fortress`, `dash`, `parry`, `flurry`, `afterimage`, `shot`, `mine`, `overclock`, `barrage`, `drone`, `patch`, `shock`, `singularity`.

Ordem do efeito:

1. Surgimento/preparação.
2. Formação/deslocamento.
3. **Impacto e efeito ativo.**
4. Dissipação.

Tipos: `strike` corte/projétil; `burst` explosão; `heal` cura/halo; `dash` rastro; `control` raízes, armadilha, ímã, EMP ou stun.

## 6. Equipamentos

Ícone estático 32×32 ou 48×48 para:

- Armas: `sword1`, `sword2`, `axe`, `morningstar`, `bluesword`, `redsword`, `goldensword`.
- Armaduras: `clotharmor`, `leatherarmor`, `mailarmor`, `platearmor`, `redarmor`, `goldenarmor`, `chainarmor`.
- Consumíveis: `flask`, `firepotion`.
- Estados: loot genérico, novo, equipado, bloqueado.
- Brilhos: comum, incomum, raro, épico e lendário.

## 7. Tiles, objetos e decoração

Tiles 32×32: `grass`, `grass2`, `dark`, `dead`, `path`, `water`, `sand`, `mountain`, `lava`, `safeA`, `safeC`, `cave`.

Criar centro, bordas, cantos, transições e variações.

Objetos:

- `tree`: 3–5 variações.
- `rock`: 3–5 formas/tamanhos.
- `grave`: 3–4 lápides.
- `portal`: 6–8 frames de pulsação e 8–12 de abertura.
- `cave`: entrada rochosa escura.
- `firepotion`: 6 frames de flutuação e 4 de coleta.

Decoração: raízes/arbustos/flores/cogumelos/cristais na floresta; ossos/velas/lápides/névoa no cemitério; estalactites/cristais/runas na caverna; ossos/ruínas/cactos no deserto; pedras/lava/brasas/ruínas industriais nas montanhas; espuma/conchas/pedras na praia.

## 8. Efeitos gerais e HUD

Criar animações de 6–12 frames para ataque melee, cortes, golpe pesado, projétil, impacto, dano, crítico, cura, escudo, invencibilidade, stun, slow, poison, fogo, morte normal, morte do chefe, coleta, nível, desbloqueio, mudança de fase, portal e teleporte.

Criar ícones de vida, mana, XP, nível, ataque, armadura, poção, alvo, jogador, coop, NPC, estados de missão, diário, conquista, mapa, portal, região, raridades, configurações, fechar, voltar, reviver, salvar, online/offline, sala, conexão, sincronização, joystick, ataque mobile, habilidades 1/2/3 e ultimate.

Usar `dusk-icons/all.png` quando houver ícone compatível e `pixel-ui/all.png` para molduras, painéis, slots, barras e botões.

## 9. Ordem de produção

1. 8 classes.
2. `rat`, `bat`, `skeleton`, `snake`, `deathknight`.
3. Rei Esqueleto nas 3 fases.
4. Ataques, projéteis, dano, cura e morte.
5. 4 NPCs.
6. Equipamentos, consumíveis e loot.
7. Tiles, objetos e portais.
8. `crab`, `goblin`, `ogre`, `spectre`.
9. 32 ícones e efeitos.
10. Decoração, HUD, cooperação e missões.

## 10. Critérios de aceite

- 8 classes com idle/walk/attack/hurt/dead e 4 direções.
- 9 inimigos comuns com cinco estados.
- Rei Esqueleto com três fases visualmente distintas.
- 4 NPCs com idle, portrait e estados de missão.
- Frame ativo de cada ataque documentado no manifest.
- Sem fundo indevido, pés alinhados e loops sem saltos.
- Sprites legíveis no celular.
- IDs compatíveis com o `manifest.json`.
- Previews e licença incluídos.
- Fallback do jogo preservado.
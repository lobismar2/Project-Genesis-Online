# Project Genesis — especificação completa de sprites

Documento para enviar a outra IA/artista técnico. Produzir os assets sem alterar o combate, o balanceamento, o modo offline ou a cooperação.

## 1. Regras gerais

- Estilo: pixel art dark-fantasy/sci-fi, com floresta, ruínas, cemitério, deserto vulcânico e tecnologia neon.
- Todos os personagens, inimigos, NPCs, itens e efeitos devem ser PNG RGBA com fundo transparente.
- Não usar blur, anti-aliasing, suavização ou escalonamento fracionado.
- Manter pixels inteiros, bordas nítidas e escala visual consistente.
- Usar nomes de arquivos sem espaços ou acentos.
- Todo asset precisa de fallback: frame estático ou desenho procedural.
- Entregar previews, IDs estáveis e autorização/licença de uso comercial.
- Não presumir a grade dos sheets existentes sem inspecionar a imagem.

Convenção recomendada:

```text
assets/
  characters/<id>/{idle,walk,attack,hurt,dead,portrait}.png
  enemies/<id>/{idle,walk,attack,hurt,dead,portrait}.png
  npcs/<id>/{idle,portrait}.png
  items/<id>.png
  effects/<id>.png
  world/{tileset,objects}.png
  ui/icons.png
```

Se usar sheets, entregar `manifest.json` com `frameWidth`, `frameHeight`, `columns`, `rows`, ordem de estados, ordem de direções e FPS.

## 2. Personagens jogáveis — prioridade máxima

Existem 8 classes. Cada classe precisa de:

- `idle`: 2–4 frames.
- `walk`: 6–8 frames por direção.
- `attack`: 4–6 frames por direção.
- `hurt`: 2–3 frames.
- `dead`: 4–6 frames.
- Direções: `south`, `east`, `north`, `west`.
- Portrait de seleção, ícone pequeno de HUD e efeito próprio da ultimate.

| ID | Nome | Papel | Fação | Direção artística | Habilidades |
|---|---|---|---|---|---|
| `moss` | Colosso de Musgo | Vanguarda | Despertos | Gigante vegetal, casca, musgo e raízes | `root`, `slam`, `bark`, `forest` |
| `thorn` | Espreitador de Espinhos | Atirador | Despertos | Caçador/arqueiro vegetal e espinhos rosa | `volley`, `snare`, `venom`, `bramble` |
| `spore` | Tecelão de Esporos | Controlador | Despertos | Criatura fúngica, cogumelos e partículas | `sporebolt`, `cloud`, `mend`, `bloom` |
| `mother` | Guardião Raiz | Suporte | Despertos | Guardião ancestral, raízes e seiva | `vine`, `ward`, `pulse`, `grove` |
| `tungsten` | Vanguarda de Tungstênio | Tanque | Consórcio | Armadura industrial pesada e metal ciano | `bash`, `guard`, `magnet`, `fortress` |
| `neon` | Lâmina Neon | Duelista | Consórcio | Guerreiro ágil e lâminas verde-neon | `dash`, `parry`, `flurry`, `afterimage` |
| `hex` | Artilheiro Hex | Atirador | Consórcio | Atirador tecnológico e energia laranja | `shot`, `mine`, `overclock`, `barrage` |
| `bio` | Engenheiro Biossonda | Artífice | Consórcio | Engenheiro biocibernético com drone | `drone`, `patch`, `shock`, `singularity` |

### Sheets já fornecidos

```text
characters/char-01.png até characters/char-18.png
characters/char-01-icon.png até characters/char-18-icon.png
```

Os sheets têm 768×1408 px e os ícones 128×128 px. Usar 8 personagens nas classes; os 10 restantes podem virar variantes, skins, aliados ou personagens futuros. Confirmar colunas, linhas, estados e direções antes do recorte.

## 3. Ícones e efeitos das habilidades

Criar **32 ícones**, idealmente 32×32 ou 48×48, e pelo menos um efeito animado por habilidade:

```text
moss:     root, slam, bark, forest
thorn:    volley, snare, venom, bramble
spore:    sporebolt, cloud, mend, bloom
mother:   vine, ward, pulse, grove
tungsten: bash, guard, magnet, fortress
neon:     dash, parry, flurry, afterimage
hex:      shot, mine, overclock, barrage
bio:      drone, patch, shock, singularity
```

Tipos visuais:

- `strike`: corte ou projétil.
- `burst`: explosão circular/área.
- `heal`: partículas ascendentes e halo.
- `dash`: rastro de movimento.
- `control`: raízes, armadilha, ímã, EMP ou atordoamento.

## 4. Inimigos — 10

Cada inimigo precisa de `idle`, `walk`, `attack`, `hurt`, `dead`, portrait/ícone e efeito de morte. Para humanoides, usar 4 direções quando possível.

| ID | Nome | Comportamento | Visual/local |
|---|---|---|---|
| `rat` | Rato-pardo | Investida | Pequeno, marrom, floresta |
| `crab` | Caranguejo | Corpo a corpo | Casco vermelho, praia |
| `bat` | Morcego | À distância | Asas animadas, caverna |
| `goblin` | Goblin | Investida | Humanoide verde |
| `skeleton` | Esqueleto | À distância | Cemitério, projétil de osso/magia |
| `snake` | Serpente | Investida | Rasteja, deserto |
| `ogre` | Ogro | Corpo a corpo | Grande, lento e resistente |
| `spectre` | Espectro | À distância | Fantasma translúcido |
| `deathknight` | Cavaleiro da Morte | Corpo a corpo | Armadura pesada, montanhas |
| `boss` | Rei Esqueleto | Invocador | Chefe final |

## 5. Rei Esqueleto — conjunto próprio

Não usar apenas o sprite de esqueleto ampliado. Criar:

- idle, caminhada, ataque corpo a corpo, ataque à distância, summon, hurt e dead;
- entrada na arena;
- mudança de fase;
- ícone de chefe;
- morte grande dourada/sombria;
- variantes visuais para as 3 fases.

Fases:

1. **Fase 1:** coroa, ataques básicos e invocação.
2. **Fase 2:** armadura/energia alterada, mais agressivo e com investida.
3. **Fase 3:** aura dourada/vermelha, partículas intensas e forma final.

## 6. NPCs — 4

Cada NPC precisa de sprite parado, preferencialmente em 4 direções, 2–4 frames de idle, portrait e indicadores de missão disponível/pronta.

| ID | Nome | Fação | Visual |
|---|---|---|---|
| `guide` | Guardião da Árvore-Mãe | Despertos | Guia vegetal ligado à árvore |
| `elder` | Ancião da Floresta | Despertos | Sábio com roupas naturais |
| `smith` | Ferreiro do Consórcio | Consórcio | Ferreiro tecnológico |
| `sentry` | Sentinela Neon | Consórcio | Guarda futurista |

## 7. Equipamentos e loot

Criar ícone individual para HUD, inventário, loot, diário e recompensas.

### Armas

```text
sword1       Adaga Prática       comum
sword2       Espada de Aço       incomum
axe          Machado             incomum
morningstar  Maça Estrela        raro
bluesword    Lâmina Azul         raro
redsword     Lâmina Rubra        épico
goldensword  Relíquia Solar      lendário
```

### Armaduras

```text
clotharmor   Traje de Pano       comum
leatherarmor Couraça de Couro    incomum
mailarmor    Cota de Malha       incomum
platearmor   Armadura de Placas  raro
redarmor     Armadura Rubra      raro
goldenarmor  Armadura Solar      lendário
```

Também verificar o ID `chainarmor`, referenciado por uma missão.

### Consumíveis e estados

- `flask`: Frasco de Vida.
- `firepotion`: Poção especial de fogo antigo.
- Loot genérico.
- Item bloqueado, equipado e novo.
- Halo/brilho para comum, incomum, raro, épico e lendário.

## 8. Tiles e mundo

O mapa usa tiles de 32×32. Criar tilesheet modular para:

```text
grass, grass2, dark, dead, path, water,
sand, mountain, lava, safeA, safeC, cave
```

Também criar bordas, cantos, transições e variações para água, lava, grama, areia, pedra e caminho.

### Objetos existentes

- `tree`: 3–5 copas/troncos.
- `rock`: 3–5 tamanhos e formatos.
- `grave`: 3–4 lápides, inclusive quebradas.
- `portal`: parado, pulsando, abrindo e fechando.
- `cave`: entrada rochosa escura.
- `firepotion`: brilho, flutuação e coleta.

### Decoração recomendada por bioma

- Floresta: raízes, arbustos, flores, cogumelos, troncos e cristais verdes.
- Cemitério: ossos, velas, lápides quebradas, árvores secas e névoa.
- Caverna: estalactites, cristais, pedras, runas e poças.
- Deserto: ossos grandes, pedras secas, ruínas, cactos e cinzas.
- Montanhas: pedras negras, lava, brasas, ruínas industriais e sinais do Consórcio.
- Praia: areia, água, espuma, conchas e pedras costeiras.

## 9. Efeitos de combate

Criar animações curtas e legíveis no celular:

- ataque corpo a corpo;
- corte horizontal, corte vertical e golpe pesado;
- projétil e impacto;
- dano, dano crítico e cura;
- escudo/barreira e invencibilidade;
- atordoamento, lentidão, veneno e fogo;
- morte normal e morte do chefe;
- coleta de item;
- subida de nível;
- desbloqueio de habilidade;
- mudança de fase;
- portal e teleporte.

Cores de referência:

- Despertos: verde, rosa, roxo, seiva e esporos.
- Consórcio: ciano, verde-neon, laranja e azul elétrico.
- Dano: vermelho/laranja.
- Cura: verde-claro/ciano.
- Veneno: verde-amarelado.
- Controle: roxo/azul.
- Chefe: dourado, vermelho e preto.

## 10. HUD e interface

Criar ou selecionar do atlas ícones para:

vida, mana/energia, XP, nível, ataque, armadura, poção, alvo, jogador, jogador coop, NPC, missão disponível, missão pronta, missão bloqueada, missão concluída, diário, conquista, mapa, portal, região, raridades, configurações, fechar, voltar, reviver, salvar, online, offline, sala coop, jogador conectado, sincronização, joystick, ataque mobile, habilidades 1/2/3 e ultimate.

Usar `dusk-icons/all.png` para ícones compatíveis e `pixel-ui/all.png` para molduras, painéis, slots, barras e botões.

## 11. Animação e entrega

Para cada sheet informar:

- tamanho total;
- largura/altura do frame;
- colunas/linhas;
- ordem dos estados e direções;
- FPS;
- ponto de ancoragem dos pés;
- hitbox visual;
- se usa espelhamento.

Critérios:

- pés alinhados em todos os frames;
- ataque mostra o instante do impacto;
- morte permanece legível;
- chefe é maior sem bloquear a tela;
- sprites continuam identificáveis em viewport mobile.

Entregar:

1. PNGs individuais ou sheets.
2. Portraits e ícones.
3. `manifest.json`.
4. Folha de referência com todas as animações.
5. Lista de IDs.
6. Licença de uso comercial.
7. Preview em fundo quadriculado e fundo escuro.

## 12. Ordem de produção

1. 8 classes jogáveis.
2. `rat`, `bat`, `skeleton`, `snake`, `deathknight`.
3. Rei Esqueleto nas 3 fases.
4. Ataque, dano, morte, cura e projéteis.
5. 4 NPCs.
6. Equipamentos, consumíveis, tiles e objetos.
7. `crab`, `goblin`, `ogre` e `spectre`.
8. 32 ícones e efeitos de habilidades.
9. Decoração, variações e ícones de cooperação/missões.

## 13. Critérios de aceite

- 8 classes com 5 estados e 4 direções.
- 10 inimigos com 5 estados.
- Chefe com 3 fases distintas.
- 4 NPCs com sprites, portraits e indicadores.
- Todos os equipamentos, consumíveis, tiles, objetos e efeitos cobertos.
- Assets legíveis em mobile.
- Transparência correta.
- Manifest, previews e licença incluídos.
- Fallback preservado.

## 14. Resumo

- 8 personagens jogáveis.
- 10 inimigos.
- 1 chefe com 3 fases.
- 4 NPCs.
- 32 habilidades.
- 13 equipamentos.
- 2 consumíveis principais.
- 12 tiles.
- 6 objetos principais.
- 20+ efeitos.
- 30+ ícones de HUD/sistema.
# Project Genesis

Release candidate web reproduzível. O pacote web é jogável localmente em modo
solo; autenticação, progresso remoto e cooperação precisam da API em execução.

## Requisitos

- Node.js 24.x e pnpm 10.x (o workspace fixa as versões das dependências no
  `pnpm-lock.yaml`).
- Navegador moderno com Canvas 2D e `localStorage`.
- Para a API: `SESSION_SECRET` definido como segredo do ambiente e, em
  produção, `CORS_ORIGIN` com as origens permitidas.

## Execução local

RPG de exploração e combate em Canvas 2D, com progressão por classes, equipamentos, missões, mapas conectados e cooperação opcional.

## Tecnologias

- React + TypeScript
- Vite
- Canvas 2D
- Playwright
- API Express/TypeScript para autenticação, progresso e cooperação
- pnpm em workspace monorepo

## Executar localmente

Na raiz do workspace:

```bash
pnpm install --frozen-lockfile
pnpm --filter @workspace/project-genesis run dev
```

O frontend usa a porta definida pelo workflow/artifact. Para executar a API em paralelo:

```bash
pnpm --filter @workspace/api-server run dev
```

Para servir o build de produção:

```bash
pnpm --filter @workspace/project-genesis run build
pnpm --filter @workspace/project-genesis run serve
```

O servidor de desenvolvimento e o preview escutam `PORT` (com um default
seguro para builds estáticos). `BASE_PATH` pode ser usado quando o frontend é
montado sob um prefixo; use `/` para execução local.

## Arquitetura

- `src/App.tsx` contém o loop Canvas, regras de combate, HUD e telas.
- `src/lib/coop.ts` concentra sessão, serialização, saves locais/remotos e
  cooperação.
- `src/*.test.ts` cobre determinismo, transições, minimapa, assets, corrupção
  de save e expiração de sessão.
- `e2e/` cobre o fluxo de interação mobile em um navegador real.
- `../api-server/` expõe autenticação, progresso e salas cooperativas; os
  dados JSON de desenvolvimento ficam em `COOP_DATA_DIR`.

O modo solo não depende da API. Saves são normalizados campo a campo, chaves
desconhecidas são descartadas e recompensas usam um ledger idempotente. A
identidade do progresso remoto vem apenas da sessão assinada pelo servidor.

## Sistemas implementados

- Seleção de facção e classe.
- Movimento por toque, mouse e teclado.
- Combate com inimigos variados e Rei Esqueleto.
- Habilidades com energia, recarga e desbloqueio por nível.
- XP, níveis, equipamentos, raridades e coleta.
- Bolsa persistente e equipamento manual.
- Cofre persistente com depósitos/retiradas individuais e em lote, busca,
  proteção de equipamentos ativos e sincronização idempotente.
- Moedas persistentes em saves novos, com migração segura de saves antigos.
- Missões com aceitação, progresso, conclusão e recompensa idempotente.
- Diário, conquistas, minimapa e quatro biomas jogáveis.
- Vila do Limiar como hub seguro, com portais para os quatro biomas, serviços,
  objetivos de exploração e a mini-dungeon Cripta do Sino.
- Evento semanal gratuito Eclipse, com telegráficos de combate, drops
  cosméticos e título persistente sem bloquear a campanha.
- Modo solo com `localStorage`.
- Autenticação opcional e sincronização cooperativa.
- Salva remoto serializado para evitar colisões de revisão.
- Interface mobile inspirada em RPG pixelado, com hotbar, menu e slots compactos.

## Testes

```bash
pnpm --filter @workspace/project-genesis run typecheck
pnpm --filter @workspace/project-genesis run test
pnpm --filter @workspace/project-genesis run test:e2e
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/api-server run test
```

O healthcheck cooperativo pode ser executado com:

```bash
pnpm --filter @workspace/api-server run healthcheck
```

Validação completa recomendada antes de publicar:

```bash
pnpm run typecheck
pnpm --filter @workspace/project-genesis run test
pnpm --filter @workspace/api-server run test:ci
pnpm --filter @workspace/project-genesis run test:e2e
pnpm run release:project-genesis
```

O projeto E2E Chromium é o gate obrigatório. WebKit mobile é uma verificação
separada e obrigatória no CI, executada em um runner Ubuntu 24.04 com as
dependências nativas instaladas. Falhas nessa execução são reportadas como
falhas do job, e não como aprovação de compatibilidade.

## Configuração e segurança

- `SESSION_SECRET` deve ser fornecido pelo ambiente de execução; nunca grave credenciais no código ou no pacote.
- O modo solo não depende da API.
- O progresso remoto só é aceito para a sessão autenticada pelo servidor.
- Saves locais são normalizados e chaves desconhecidas são descartadas.
- Assets externos do Warspear Online não fazem parte deste projeto; as referências visuais são recriadas com arte e estilos próprios.

## Licenças e assets

O código deste workspace é distribuído sob MIT (consulte o `license` do
manifest raiz). Os assets visuais fornecidos pelo usuário não têm licença
comercial confirmada neste workspace. Antes de publicar ou vender, confirme
por escrito os direitos de uso, redistribuição e publicação de Pixel UI, Dusk
Icons e Raven Fantasy Icons. Não inclua pacotes RAR de origem nem assets
externos do Warspear Online em uma publicação sem essa revisão.

### Gate de licença do release

| Pacote visual | Comercial | Redistribuição | Publicação |
| --- | --- | --- | --- |
| Pixel UI | Pendente | Pendente | Bloqueada |
| Dusk Icons x24 | Pendente | Pendente | Bloqueada |
| Free - Raven Fantasy Icons | Pendente | Pendente | Bloqueada |

Não há confirmação escrita suficiente para liberar qualquer um desses pacotes.
Por isso, o runtime usa somente fallback procedural, tipográfico e de formas
próprias, e `pnpm run release:project-genesis` remove `public/assets` tanto do
pacote web quanto do pacote-fonte. A publicação comercial só pode ser
desbloqueada após arquivar a permissão de cada pacote junto ao inventário.

## Build

```bash
pnpm --filter @workspace/project-genesis run build
```

O artifact de produção serve `dist/public` como SPA e redireciona rotas para `index.html`.

## Pacotes de distribuição

Na raiz, `pnpm run release:project-genesis` recompila o frontend e gera
deterministicamente em `artifacts/project-genesis/downloads/`:

- `Project-Genesis-web.zip`: apenas o build web e os assets necessários;
- `Project-Genesis-source.zip`: fontes, configuração e documentação do
  workspace, sem dependências instaladas, builds ou arquivos gerados;
- `SHA256SUMS`: checksums SHA-256 dos dois pacotes;
- `RELEASE-MANIFEST.json`: nomes, tamanhos e checksums do release.

O script remove os dois pacotes gerados anteriores antes de escrever os novos.
`Project-Genesis-sprite-spec-download.zip` e o PDF da especificação são
entregas separadas e permanecem intocados. Os arquivos antigos na raiz
(`PROJECT-GENESIS-SOURCE_CODE.zip` e `project-genesis-source.zip`) são cópias
legadas fora do fluxo; não use-os para distribuição. O arquivo
`LEGACY-ARCHIVES.md` registra essa decisão.

## Limitações conhecidas

- Licenças comerciais dos pacotes de arte ainda bloqueiam publicação comercial.
- O modo cooperativo requer API, sessão e configuração de CORS em produção.
- WebKit depende das bibliotecas nativas disponíveis no runner.
- A economia ainda não tem loja nem consumo de moedas; o saldo persistente
  existe, mas não representa um sistema comercial completo.

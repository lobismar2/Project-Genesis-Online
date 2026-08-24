# Project Genesis — relatório de release candidate

## Identificação do pacote

O release reproduzível é gerado por `pnpm run release:project-genesis`.
Ele recompila o frontend e grava em `downloads/` os pacotes web e fonte, além
de `SHA256SUMS` e `RELEASE-MANIFEST.json`. A geração usa ordenação estável,
timestamp fixo nos ZIPs e exclusão explícita de dependências/builds.

## Status

Release candidate funcional para preview web e validação mobile. O modo solo está operacional sem servidor; os recursos autenticados e cooperativos dependem da API configurada.

## Implementado

- RPG de ação em Canvas 2D com quatro biomas.
- Seleção de facção e oito classes.
- Movimento por mouse, teclado e toque.
- Combate com inimigos melee, ranged, charger, summoner e chefe com fases.
- Skills, mana/energia, recargas, XP, níveis e progressão.
- Equipamentos com rank, raridade, inventário e autoequipamento.
- Bolsa persistente em grade e painel de equipamento.
- Moedas persistentes com normalização de saves antigos.
- Missões persistentes com ledger de recompensa.
- Diário, conquistas, minimapa, navegação e transições entre mapas.
- HUD mobile com hotbar e menu inspirado em RPG pixelado.
- Login, carregamento/salvamento remoto e salas cooperativas.
- Serialização das gravações remotas no cliente para reduzir colisões de revisão.

## Problemas encontrados e corrigidos

- Previews de estados do laboratório de sprites não encontravam suas referências.
- Botão de menu imperativo podia ficar órfão ao trocar de partida.
- O menu interceptava toques do botão da bolsa.
- A ação de mapa não executava nenhuma navegação.
- Reinício podia falhar em `localStorage` bloqueado.
- Texto de recarga de habilidade podia exibir interpolação literal.
- Moedas eram exibidas como valor fixo e não faziam parte do progresso.
- Saves antigos da API não podem ser alterados apenas por adicionar um campo novo.
- Chamadas de save remoto concorrentes podiam usar a mesma revisão.

## Testes realizados

- TypeScript frontend e API.
- 27 testes unitários frontend.
- 19 testes unitários/integrados da API e coop.
- Cenários E2E mobile Chromium cobrindo portais, joystick, combate e painéis.
- Healthcheck da API cooperativa.
- Verificação de whitespace com `git diff --check`.
- Preview frontend reiniciado e verificado sem erro novo de navegador.
- Build de produção Vite regenerado e conteúdo do pacote web conferido.
- Checksums SHA-256 conferidos contra `RELEASE-MANIFEST.json`.

## Segurança e dados

- Nenhum segredo é incluído nos arquivos de release.
- Progresso remoto usa identidade de sessão autenticada.
- Saves são normalizados por campo.
- Chaves desconhecidas, missões inválidas e itens desconhecidos são descartados.
- Recompensas persistem por ledger e não devem ser concedidas duas vezes.

## Revisão de licenças visuais

Os três pacotes visuais catalogados foram revisados quanto à existência de
permissão escrita para uso comercial, redistribuição e publicação:

| Pacote | Resultado | Ação aplicada |
| --- | --- | --- |
| Pixel UI | Não confirmado | Mantido somente para auditoria |
| Dusk Icons x24 | Não confirmado | Mantido somente para auditoria |
| Free - Raven Fantasy Icons | Não confirmado | Mantido somente para auditoria |

Nenhum desses assets é referenciado pelo runtime. O empacotador exclui
`public/assets` do pacote web e do pacote-fonte, e o fallback procedural próprio
é o único caminho liberado para o release. A publicação comercial permanece
bloqueada até que as três permissões sejam confirmadas e anexadas ao inventário.

## Limitações antes da publicação

- Smoke test publicado: bloqueado porque ainda não existe deployment ativo
  (`isDeployed: false`); URL oficial: não disponível. Reexecutar após o usuário
  publicar o artifact.
- Os assets antigos permanecem apenas no workspace para auditoria e são excluídos dos pacotes de distribuição.
- WebKit foi validado em runner completo com dependências nativas instaladas; a execução local continua opcional.
- Configurar origem CORS de produção e políticas operacionais antes de expor a API publicamente.
- As cópias antigas estão identificadas em `LEGACY-ARCHIVES.md` e não devem ser distribuídas.

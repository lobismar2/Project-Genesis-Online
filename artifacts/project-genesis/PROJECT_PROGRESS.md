# Project Genesis — progresso de desenvolvimento

## Fase atual

Release candidate técnico e visual, com auditoria de estabilidade em andamento.

## Concluído

- Loop de exploração e combate em Canvas 2D.
- Classes, facções, inimigos, chefe, habilidades, XP e níveis.
- Mapas conectados: floresta, caverna, gelo e vulcão.
- Inventário persistente, raridades, coleta e equipamento manual.
- Missões, diário, conquistas e recompensas idempotentes.
- HUD mobile, hotbar, minimapa, menu inferior direito e bolsa pixel-RPG.
- Autenticação e progresso remoto protegido pela sessão.
- Moedas persistidas e migradas com segurança.
- Fila de saves cooperativos para evitar revisões concorrentes.
- Correções do laboratório de sprites, menu entre partidas e coordenadas da hotbar.
- Documentação de execução, arquitetura, configuração, licenças, limitações e operação.
- Empacotamento reproduzível de fonte e web com checksums e manifesto.

## Validação executada

- Typecheck frontend aprovado.
- 27 testes unitários frontend aprovados.
- Cenários E2E mobile Chromium cobrindo portais, joystick, combate e painéis.
- Typecheck API aprovado.
- 19 testes de API/co-op aprovados.
- Healthcheck cooperativo aprovado.
- `git diff --check` aprovado.

## Pendências conhecidas

- O smoke test do build Vite ainda deve ser confirmado no ambiente de publicação.
- WebKit foi validado em runner completo com as dependências nativas disponíveis; a execução local continua opcional.
- Economia possui compra, venda, recompra e poções; o saldo e as concessões persistentes continuam cobertos pelos saves.
- Os assets pixelados foram isolados para auditoria e não entram nos pacotes de distribuição; o runtime usa fallback procedural próprio.

## Próximo passo exato

Executar o smoke test do pacote final no ambiente de publicação e configurar a operação pós-publicação.

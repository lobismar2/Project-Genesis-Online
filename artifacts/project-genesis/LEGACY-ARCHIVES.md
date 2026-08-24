# Cópias legadas de distribuição

Os arquivos abaixo foram gerados por fluxos anteriores e não fazem parte do
release reproduzível atual:

- `PROJECT-GENESIS-SOURCE_CODE.zip` (raiz do workspace)
- `project-genesis-source.zip` (raiz do workspace)
- `Project-Genesis-source.zip` e `Project-Genesis-source.tar.gz` neste diretório
- cópias com os mesmos nomes dentro de `downloads/`

Use apenas os arquivos regenerados por `pnpm run release:project-genesis` em
`downloads/`, acompanhados de `SHA256SUMS` e `RELEASE-MANIFEST.json`. O script
remove os pacotes gerados da pasta `downloads/` antes de criar o release; a
especificação de sprites é mantida como entrega independente.
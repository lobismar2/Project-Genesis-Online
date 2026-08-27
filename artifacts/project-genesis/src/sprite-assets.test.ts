import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const SRC = resolve(process.cwd(), 'src');
const CSS_SOURCE = join(SRC, 'index.css');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|css)$/.test(entry) ? [full] : [];
  });
}

test('mantém o frontend independente de assets visuais não licenciados', () => {
  const css = readFileSync(CSS_SOURCE, 'utf8');
  assert.equal(css.includes('/assets/'), false);
});

test('nenhuma fonte referencia /assets/, que o release remove', () => {
  // O gate de licença apaga `public/assets` do pacote. Uma referência que
  // sobrevive vira imagem quebrada em produção — foi o que aconteceu com
  // `/assets/raven-icons/*.png` no inventário, que aparecia como uma letra
  // solta numa caixa vazia. O teste antigo só olhava o CSS e não pegou.
  const offenders = sourceFiles(SRC)
    .filter((file) => file !== CSS_SOURCE && !file.endsWith('.test.ts'))
    .filter((file) => readFileSync(file, 'utf8').includes('/assets/'))
    .map((file) => file.slice(SRC.length + 1));

  assert.deepEqual(offenders, [], `referenciam /assets/: ${offenders.join(', ')}`);
});

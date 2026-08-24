import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const CSS_SOURCE = resolve(process.cwd(), 'src/index.css');

test('mantém o frontend independente de assets visuais não licenciados', () => {
  const css = readFileSync(CSS_SOURCE, 'utf8');
  assert.equal(css.includes('/assets/'), false);
});
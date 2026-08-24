import { strict as assert } from 'node:assert';
import test from 'node:test';
import { makeMap } from './App';

test('gera o mesmo mapa para o mesmo bioma em clientes cooperativos', () => {
  assert.deepEqual(makeMap('forest'), makeMap('forest'));
  assert.deepEqual(makeMap('cave'), makeMap('cave'));
  assert.notDeepEqual(makeMap('forest'), makeMap('ice'));
});
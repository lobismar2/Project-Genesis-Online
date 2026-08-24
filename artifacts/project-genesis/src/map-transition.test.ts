import test from 'node:test';
import assert from 'node:assert/strict';
import { isMapId, nextMapId } from './App';

test('reconhece apenas mapas jogáveis', () => {
  assert.equal(isMapId('forest'), true);
  assert.equal(isMapId('cave'), true);
  assert.equal(isMapId('ice'), true);
  assert.equal(isMapId('volcano'), true);
  assert.equal(isMapId('desert'), false);
  assert.equal(isMapId(null), false);
});

test('cada saída leva ao próximo bioma e o vulcão fecha o ciclo', () => {
  assert.equal(nextMapId('forest'), 'cave');
  assert.equal(nextMapId('cave'), 'ice');
  assert.equal(nextMapId('ice'), 'volcano');
  assert.equal(nextMapId('volcano'), 'forest');
});
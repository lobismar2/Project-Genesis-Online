import assert from 'node:assert/strict';
import test from 'node:test';
import { missionMapTarget } from './App';

test('prioriza o mapa explícito de uma missão regional', () => {
  assert.equal(missionMapTarget({ region: 'Vila do Limiar', target: 'forest' }), 'forest');
  assert.equal(missionMapTarget({ region: 'Caverna', target: 'ice' }), 'ice');
});

test('mapeia objetivos legados para os biomas jogáveis atuais', () => {
  assert.equal(missionMapTarget({ region: 'Deserto', target: 'wasteland' }), 'volcano');
  assert.equal(missionMapTarget({ region: 'Montanhas', target: 'boss' }), 'volcano');
  assert.equal(missionMapTarget({ region: 'Cemitério', target: 'skeleton' }), 'forest');
});

test('usa a vila como destino para missões do hub sem alvo de mapa', () => {
  assert.equal(missionMapTarget({ region: 'Vila do Limiar' }), 'hub');
});

test('não inventa um destino quando a região não é conhecida', () => {
  assert.equal(missionMapTarget({ region: 'Ruínas desconhecidas', target: 'boss' }), null);
});
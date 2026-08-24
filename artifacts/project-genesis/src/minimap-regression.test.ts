import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clearFocusedRegionAtArrival,
  focusMinimapRegion,
  minimapRegionAtPointer,
  type MinimapPointer,
} from './App';

const rect = { left: 10, top: 20, width: 88, height: 88 };

test('mantém a rota selecionada ao tocar no marcador e no rótulo em telas pequenas', () => {
  const player = { moveTarget: null as { x: number; y: number } | null, target: 'rat-1' };
  const markerTap: MinimapPointer = {
    clientX: rect.left + rect.width * .18,
    clientY: rect.top + rect.height * .14,
  };
  const markerRegion = minimapRegionAtPointer(markerTap, rect);

  assert.equal(markerRegion?.name, 'Cemitério');
  const focusedFromMarker = focusMinimapRegion(player, markerRegion!);
  assert.equal(focusedFromMarker, 'Cemitério');
  assert.deepEqual(player.moveTarget, { x: 518.4, y: 286.72 });
  assert.equal(player.target, 'rat-1');

  const labelTap: MinimapPointer = { clientX: 0, clientY: 0 };
  const labelRegion = { name: 'Deserto', x: .55, y: .72 } as const;
  const focusedFromLabel = focusMinimapRegion(player, labelRegion);
  assert.equal(labelTap.clientX, 0, 'o clique do rótulo não depende das coordenadas do canvas');
  assert.equal(focusedFromLabel, 'Deserto');
  assert.deepEqual(player.moveTarget, { x: 1584.0000000000002, y: 1474.56 });
  assert.equal(player.target, 'rat-1');
});

test('ignora ponteiros fora do raio dos marcadores sem alterar destino ou destaque', () => {
  const player = { moveTarget: { x: 1584.0000000000002, y: 1474.56 }, target: 'rat-1' };
  const focusedRegion = 'Deserto';
  const emptyTap: MinimapPointer = {
    clientX: rect.left + rect.width * .72,
    clientY: rect.top + rect.height * .42,
  };

  const region = minimapRegionAtPointer(emptyTap, rect);

  assert.equal(region, undefined);
  if (region) focusMinimapRegion(player, region);
  assert.deepEqual(player.moveTarget, { x: 1584.0000000000002, y: 1474.56 });
  assert.equal(focusedRegion, 'Deserto');
  assert.equal(player.target, 'rat-1');
});

test('limpa o destaque quando chega, sem limpar o alvo de combate', () => {
  const player = { x: 700, y: 210, moveTarget: { x: 720, y: 224 }, target: 'rat-1' };
  const focused = clearFocusedRegionAtArrival(player, 'Cemitério');
  assert.equal(focused, 'Cemitério');

  player.moveTarget = { x: 0, y: 0 };
  player.x = 0;
  player.y = 0;
  const cleared = clearFocusedRegionAtArrival(player, 'Cemitério');
  assert.equal(cleared, null);
  assert.equal(player.moveTarget, null);
  assert.equal(player.target, 'rat-1');
});
import assert from 'node:assert/strict';
import test from 'node:test';

import { nextMapId, sidePassageMapId } from './App';

type MapId = 'hub' | 'forest' | 'cave' | 'ice' | 'volcano';

const FIELD_MAPS: MapId[] = ['forest', 'cave', 'ice', 'volcano'];

/**
 * Os três portais de um mapa fora da vila, na ordem em que createGame os cria:
 * a saída (r 48), a passagem lateral (r 28) e o retorno à vila (r 28).
 */
function portalTargets(mapId: MapId): MapId[] {
  return [nextMapId(mapId), sidePassageMapId(mapId), 'hub'];
}

test('cada mapa de campo tem três portais com destinos distintos', () => {
  for (const mapId of FIELD_MAPS) {
    const targets = portalTargets(mapId);
    assert.equal(
      new Set(targets).size,
      3,
      `${mapId} tem portais duplicados: ${targets.join(', ')} — um deles não leva a lugar nenhum de novo`
    );
  }
});

test('nenhum portal aponta para o mapa em que já se está', () => {
  // Um portal que aponta para o próprio mapa é recusado por travelTo, e o
  // jogador fica sem retorno visível para aquele destino.
  for (const mapId of FIELD_MAPS) {
    for (const target of portalTargets(mapId)) {
      assert.notEqual(target, mapId, `portal de ${mapId} aponta para ele mesmo`);
    }
  }
});

test('a passagem lateral desfaz a saída do mapa de onde ela vem', () => {
  // A passagem anda para trás na cadeia: se a saída de A leva a B, a passagem
  // de B precisa voltar para A. Sem isso, mapas ficam sem caminho de volta.
  for (const mapId of FIELD_MAPS) {
    const forward = nextMapId(mapId);
    if (forward === 'hub') continue;
    assert.equal(
      sidePassageMapId(forward),
      mapId,
      `a passagem de ${forward} deveria voltar para ${mapId}`
    );
  }
});

test('todo mapa de campo é alcançável a partir da vila', () => {
  const reachable = new Set<MapId>(['hub']);
  const queue: MapId[] = ['hub'];

  while (queue.length > 0) {
    const current = queue.shift() as MapId;
    const targets =
      current === 'hub' ? (['forest', 'cave', 'ice', 'volcano'] as MapId[]) : portalTargets(current);
    for (const target of targets) {
      if (!reachable.has(target)) {
        reachable.add(target);
        queue.push(target);
      }
    }
  }

  for (const mapId of FIELD_MAPS) {
    assert.ok(reachable.has(mapId), `${mapId} ficou inalcançável pelos portais`);
  }
});

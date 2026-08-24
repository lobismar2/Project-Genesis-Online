import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizePersistedProgress } from './App';
import { applyBankOperation } from './lib/coop';
import type { ProgressSnapshot } from './lib/coop';

const defaults: ProgressSnapshot = {
  avatar: 'moss',
  weaponRank: 1,
  armorRank: 1,
  flasks: 2,
  level: 1,
  xp: 0,
  nextXp: 120,
  ach: {},
  kills: {},
  revives: 0,
  dmgTaken: 0,
  missions: {},
  accepted: {},
  completed: {},
  rewarded: {},
  inventory: {},
};

test('normaliza campos ausentes e tipos inválidos sem descartar o restante do save', () => {
  const persisted = {
    version: 2,
    avatar: 'moss',
    xp: '840',
    flasks: 'not-a-number',
    weaponRank: 999,
    armorRank: -4,
    level: 'invalid',
    nextXp: Infinity,
    ach: { warrior: true, broken: 'yes' },
    kills: { rat: '6', skeleton: 'nope' },
    // The other save fields are intentionally absent.
  };

  const loaded = normalizePersistedProgress(persisted, 'moss', defaults);

  assert.ok(loaded);
  assert.equal(loaded.xp, 840);
  assert.equal(loaded.flasks, 2);
  assert.equal(loaded.weaponRank, 7);
  assert.equal(loaded.armorRank, 1);
  assert.equal(loaded.level, 1);
  assert.equal(loaded.nextXp, 120);
  assert.equal(loaded.coins, 0);
  assert.deepEqual(loaded.ach, { warrior: true });
  assert.deepEqual(loaded.kills, { rat: 6, skeleton: 0 });
});

test('migra moeda ausente de saves antigos para saldo zero e limita valores inválidos', () => {
  const oldSave = normalizePersistedProgress({ avatar: 'moss', xp: 20 }, 'moss', defaults);
  assert.ok(oldSave);
  assert.equal(oldSave.coins, 0);

  const invalid = normalizePersistedProgress({ avatar: 'moss', coins: -8 }, 'moss', defaults);
  assert.ok(invalid);
  assert.equal(invalid.coins, 0);
});

test('preserva progresso parcial e trata recompensa registrada como conclusão', () => {
  // This is the exact localStorage shape written by App.tsx: version plus
  // the progress snapshot fields at the top level.
  const persisted = {
    version: 2,
    avatar: 'moss',
    weaponRank: 3,
    armorRank: 2,
    flasks: 7,
    level: 4,
    xp: 55,
    nextXp: 180,
    ach: {},
    kills: { rat: 3 },
    revives: 1,
    dmgTaken: 22,
    missions: { 'forest-rats': 2 },
    accepted: {},
    completed: {},
    rewarded: { 'forest-gear': true },
  };

  const loaded = normalizePersistedProgress(persisted, 'moss', defaults);

  assert.ok(loaded);
  assert.equal(loaded.xp, 55);
  assert.equal(loaded.flasks, 7);
  assert.equal(loaded.weaponRank, 3);
  assert.equal(loaded.armorRank, 2);
  assert.equal(loaded.missions['forest-rats'], 2);
  assert.equal(loaded.accepted['forest-rats'], true);
  assert.equal(loaded.rewarded['forest-gear'], true);
  assert.equal(loaded.completed['forest-gear'], true);
  // A later interaction sees both flags and cannot grant this reward again.
  assert.equal(loaded.rewarded['forest-rats'], undefined);
  assert.equal(loaded.completed['forest-rats'], undefined);
});

test('rejeita um save de outro personagem', () => {
  assert.equal(normalizePersistedProgress({ avatar: 'thorn', xp: 900 }, 'moss', defaults), null);
});

test('migra e normaliza o inventário sem aceitar itens desconhecidos', () => {
  const loaded = normalizePersistedProgress({
    avatar: 'moss',
    inventory: { sword1: '3', flask: -4, unknown: 999 },
    bank: { axe: '4', flask: -2, unknown: 999 },
  }, 'moss', defaults);

  assert.ok(loaded);
  assert.equal(loaded.inventory.sword1, 3);
  assert.equal(loaded.inventory.flask, 0);
  assert.equal(loaded.inventory.unknown, undefined);
  assert.equal(loaded.inventory.clotharmor, 0);
  assert.equal(loaded.bank?.axe, 4);
  assert.equal(loaded.bank?.flask, 0);
  assert.equal(loaded.bank?.unknown, undefined);
});

test('transfere itens em lote sem duplicar ao repetir a mesma operação', () => {
  const initial = { ...defaults, inventory: { sword1: 3, flask: 2 }, bank: {} };
  const operation = { id: 'bank-operation-1', itemId: 'sword1', direction: 'deposit' as const, amount: 2 };
  const deposited = applyBankOperation(initial, operation);
  assert.deepEqual(deposited.inventory, { sword1: 1, flask: 2 });
  assert.deepEqual(deposited.bank, { sword1: 2 });
  assert.deepEqual(applyBankOperation(deposited, operation).bank, { sword1: 2 });
});

test('normaliza o ledger do cofre e descarta operações inválidas', () => {
  const loaded = normalizePersistedProgress({
    avatar: 'moss',
    bankOperations: {
      good: { itemId: 'axe', direction: 'deposit', amount: 1 },
      unknown: { itemId: 'not-an-item', direction: 'withdraw', amount: 1 },
      bad: { itemId: 'axe', direction: 'deposit', amount: 0 },
    },
  }, 'moss', defaults);
  assert.ok(loaded);
  assert.deepEqual(loaded.bankOperations, {
    good: { id: 'good', itemId: 'axe', direction: 'deposit', amount: 1 },
  });
});
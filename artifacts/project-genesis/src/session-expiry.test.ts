import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CoopApiError,
  SESSION_EXPIRED_NOTICE,
  createProgressPersistence,
  type ProgressSnapshot,
} from './lib/coop';

const snapshot: ProgressSnapshot = {
  avatar: 'moss',
  weaponRank: 3,
  armorRank: 2,
  flasks: 4,
  level: 2,
  xp: 80,
  nextXp: 160,
  ach: {},
  kills: { rat: 2 },
  revives: 0,
  dmgTaken: 8,
  missions: {},
  accepted: {},
  completed: {},
  rewarded: {},
  inventory: {},
};

test('expiração na restauração mantém o aviso e a ação de login', () => {
  assert.equal(SESSION_EXPIRED_NOTICE.title, 'Sua sessão expirou');
  assert.equal(SESSION_EXPIRED_NOTICE.action, 'Entrar novamente');
  assert.match(SESSION_EXPIRED_NOTICE.message, /restaurar e salvar/);
});

test('account_required no salvamento não grava localmente nem tenta novamente', async () => {
  const persistence = createProgressPersistence();
  let remoteCalls = 0;
  let localWrites = 0;
  let accountRequiredCalls = 0;
  const request = {
    authenticated: true,
    revision: 7,
    snapshot,
    saveRemote: async () => {
      remoteCalls++;
      throw new CoopApiError('account_required', 401);
    },
    writeLocal: () => { localWrites++; },
    onAccountRequired: () => { accountRequiredCalls++; },
  };

  assert.deepEqual(await persistence.save(request), { kind: 'blocked' });
  assert.deepEqual(await persistence.save(request), { kind: 'blocked' });
  assert.equal(remoteCalls, 1);
  assert.equal(localWrites, 0);
  assert.equal(accountRequiredCalls, 1);
});

test('salvamento volta a funcionar depois que uma nova sessão é autenticada', async () => {
  const persistence = createProgressPersistence();
  let localWrites = 0;
  let revision = 3;
  let shouldExpire = true;
  const request = {
    authenticated: true,
    revision: 2,
    snapshot,
    saveRemote: async () => {
      if (shouldExpire) throw new CoopApiError('account_required', 401);
      return { revision, updatedAt: Date.now(), progress: snapshot };
    },
    writeLocal: () => { localWrites++; },
    onAccountRequired: () => undefined,
  };

  await persistence.save(request);
  shouldExpire = false;
  persistence.reset();

  const result = await persistence.save(request);
  assert.equal(result.kind, 'saved');
  assert.equal(localWrites, 1);
  if (result.kind === 'saved') assert.equal(result.remote.revision, revision);
});

test('captura um snapshot imutável antes de entrar na fila', async () => {
  const persistence = createProgressPersistence();
  const mutable = { ...snapshot, inventory: { sword1: 1 } };
  let received: ProgressSnapshot | undefined;
  const pending = persistence.save({
    authenticated: true,
    revision: 4,
    snapshot: mutable,
    saveRemote: async (_revision, nextSnapshot) => {
      await Promise.resolve();
      received = nextSnapshot;
      return { revision: 5, updatedAt: Date.now(), progress: nextSnapshot };
    },
    writeLocal: () => undefined,
    onAccountRequired: () => undefined,
  });
  mutable.inventory.sword1 = 99;
  await pending;
  assert.equal(received?.inventory.sword1, 1);
});

test('avança a revisão entre gravações autenticadas serializadas', async () => {
  const persistence = createProgressPersistence();
  const revisions: number[] = [];
  const saveRemote = async (revision: number, nextSnapshot: ProgressSnapshot) => {
    revisions.push(revision);
    return { revision: revision + 1, updatedAt: Date.now(), progress: nextSnapshot };
  };
  await Promise.all([
    persistence.save({ authenticated: true, revision: 8, snapshot, saveRemote, writeLocal: () => undefined, onAccountRequired: () => undefined }),
    persistence.save({ authenticated: true, revision: 8, snapshot: { ...snapshot, xp: 81 }, saveRemote, writeLocal: () => undefined, onAccountRequired: () => undefined }),
  ]);
  assert.deepEqual(revisions, [8, 9]);
});

test('recupera uma revisão conflitante sem perder fatos monotônicos', async () => {
  const persistence = createProgressPersistence();
  const revisions: number[] = [];
  let attempts = 0;
  const remoteProgress = { ...snapshot, level: 4, kills: { rat: 7 }, completed: { 'forest-rats': true } };
  const saveRemote = async (revision: number, nextSnapshot: ProgressSnapshot) => {
    attempts++;
    revisions.push(revision);
    if (attempts === 1) {
      throw new CoopApiError('stale_progress', 409, {
        current: { revision: 12, updatedAt: Date.now(), progress: remoteProgress },
      });
    }
    assert.equal(nextSnapshot.level, 4);
    assert.equal(nextSnapshot.kills.rat, 7);
    assert.equal(nextSnapshot.completed['forest-rats'], true);
    return { revision: 13, updatedAt: Date.now(), progress: nextSnapshot };
  };

  const result = await persistence.save({
    authenticated: true,
    revision: 11,
    snapshot: { ...snapshot, level: 3, kills: { rat: 3 } },
    saveRemote,
    writeLocal: () => undefined,
    onAccountRequired: () => undefined,
  });
  assert.equal(result.kind, 'saved');
  assert.deepEqual(revisions, [11, 12]);
});

test('mescla recompensas concorrentes de combate, coleta e equipamento', async () => {
  const persistence = createProgressPersistence();
  const revisions: number[] = [];
  let attempts = 0;
  const first = { ...snapshot, coins: 3, flasks: 6, weaponRank: 3, kills: { rat: 4 }, inventory: { sword1: 2 } };
  const second = { ...snapshot, coins: 8, flasks: 5, weaponRank: 4, kills: { rat: 2, bat: 1 }, inventory: { axe: 1 } };
  const saveRemote = async (revision: number, nextSnapshot: ProgressSnapshot) => {
    attempts++;
    revisions.push(revision);
    if (attempts === 1) {
      throw new CoopApiError('stale_progress', 409, {
        current: { revision: 20, updatedAt: Date.now(), progress: first },
      });
    }
    assert.equal(nextSnapshot.coins, 8);
    assert.equal(nextSnapshot.flasks, 6);
    assert.equal(nextSnapshot.weaponRank, 4);
    assert.deepEqual(nextSnapshot.kills, { rat: 4, bat: 1 });
    assert.deepEqual(nextSnapshot.inventory, { sword1: 2, axe: 1 });
    return { revision: 21, updatedAt: Date.now(), progress: nextSnapshot };
  };
  const result = await persistence.save({
    authenticated: true, revision: 19, snapshot: second, saveRemote,
    writeLocal: () => undefined, onAccountRequired: () => undefined,
  });
  assert.equal(result.kind, 'saved');
  assert.deepEqual(revisions, [19, 20]);
});

test('não ressuscita retirada do cofre ao resolver conflito de revisão', async () => {
  const persistence = createProgressPersistence();
  let attempt = 0;
  const local = { ...snapshot, inventory: { sword1: 2 }, bank: {}, bankOperations: { withdrawal: { id: 'withdrawal', itemId: 'sword1', direction: 'withdraw' as const, amount: 1 } } };
  const remote = { ...snapshot, inventory: {}, bank: { sword1: 1 } };
  const result = await persistence.save({
    authenticated: true, revision: 3, snapshot: local,
    saveRemote: async (_revision, nextSnapshot) => {
      attempt++;
      if (attempt === 1) throw new CoopApiError('stale_progress', 409, { current: { revision: 4, updatedAt: 1, progress: remote } });
      assert.deepEqual(nextSnapshot.bank, {});
      return { revision: 5, updatedAt: 2, progress: nextSnapshot };
    },
    writeLocal: () => undefined,
    onAccountRequired: () => undefined,
  });
  assert.equal(result.kind, 'saved');
});
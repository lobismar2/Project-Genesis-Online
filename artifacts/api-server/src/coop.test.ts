import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import test, { after, beforeEach } from "node:test";
import { createServer, type AddressInfo } from "node:net";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import app from "./app";
import { createSession } from "./lib/session";
import {
  persistRoomsForTests,
  reloadProgressForTests,
  reloadRoomsForTests,
  setPersistenceDirectoryForTests,
} from "./routes/coop";

const versionedDataDir = path.resolve(import.meta.dirname, "data");
const versionedSnapshots = new Map(
  ["coop-progress.json", "coop-rooms.json"].map((file) => [
    file,
    readFileSync(path.join(versionedDataDir, file), "utf8"),
  ]),
);
const testDataDir = mkdtempSync(path.join(os.tmpdir(), "coop-suite-"));

beforeEach(() => {
  setPersistenceDirectoryForTests(testDataDir);
  reloadRoomsForTests();
  reloadProgressForTests();
});

after(() => {
  for (const [file, expected] of versionedSnapshots) {
    assert.equal(
      readFileSync(path.join(versionedDataDir, file), "utf8"),
      expected,
      `${file} versionado foi alterado pela suíte`,
    );
  }
  rmSync(testDataDir, { recursive: true, force: true });
});

type JsonResponse = {
  status: number;
  body: any;
};

async function request(baseUrl: string, path: string, init?: RequestInit): Promise<JsonResponse> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  return { status: response.status, body: await response.json() };
}

function playerSnapshot(combatEnemies?: unknown[]) {
  return {
    avatar: "moss",
    x: 100,
    y: 100,
    hp: 100,
    maxHp: 100,
    level: 3,
    weaponRank: 2,
    armorRank: 1,
    action: "idle",
    ...(combatEnemies ? { combatEnemies } : {}),
  };
}

async function startServer(dataDir: string) {
  const portServer = createServer();
  await new Promise<void>((resolve, reject) => {
    portServer.once("error", reject);
    portServer.listen(0, "127.0.0.1", () => resolve());
  });
  const port = (portServer.address() as AddressInfo).port;
  await new Promise<void>((resolve) => portServer.close(() => resolve()));

  const child = spawn(process.execPath, ["--import", "tsx/esm", "src/index.ts"], {
    cwd: path.resolve(import.meta.dirname, ".."),
    env: { ...process.env, COOP_DATA_DIR: dataDir, NODE_ENV: "development", PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output: Buffer[] = [];
  child.stdout?.on("data", (chunk: Buffer) => output.push(chunk));
  child.stderr?.on("data", (chunk: Buffer) => output.push(chunk));
  const baseUrl = `http://127.0.0.1:${port}/api/coop`;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) {
      throw new Error(`coop server exited before listening: ${Buffer.concat(output).toString("utf8")}`);
    }
    try {
      const response = await fetch(`${baseUrl}/rooms`);
      await response.body?.cancel();
      return { child, baseUrl };
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  await stopServer(child);
  throw new Error(`coop server did not start: ${Buffer.concat(output).toString("utf8")}`);
}

async function stopServer(child: ChildProcess) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await new Promise<void>((resolve) => child.once("exit", () => resolve()));
}

test("compartilha combate, derrota uma vez e reaparece para os dois jogadores", async (t) => {
  const server = app.listen(0);
  t.after(() => server.close());

  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}/api/coop`;

  const room = await request(baseUrl, "/rooms", { method: "POST", body: "{}" });
  assert.equal(room.status, 201);
  const roomId = room.body.roomId as string;

  const joined = await request(baseUrl, `/rooms/${roomId}/join`, { method: "POST", body: "{}" });
  assert.equal(joined.status, 200);

  const enemy = { id: "shared-rat", type: "rat", hp: 100, maxHp: 100, x: 150, y: 100, state: "idle" };
  const registeredOne = await request(baseUrl, `/rooms/${roomId}/players/player-one`, {
    method: "PUT",
    body: JSON.stringify(playerSnapshot([enemy])),
  });
  assert.equal(registeredOne.status, 200);

  const registeredTwo = await request(baseUrl, `/rooms/${roomId}/players/player-two`, {
    method: "PUT",
    body: JSON.stringify(playerSnapshot([enemy])),
  });
  assert.equal(registeredTwo.status, 200);
  assert.equal(registeredTwo.body.players.length, 1);
  assert.equal(registeredTwo.body.combat.enemies.length, 1);
  assert.equal(registeredTwo.body.combat.enemies[0].hp, 100);

  const firstAttack = await request(baseUrl, `/rooms/${roomId}/combat/actions`, {
    method: "POST",
    body: JSON.stringify({ actorId: "player-one", targetId: "shared-rat", damage: 60 }),
  });
  assert.equal(firstAttack.status, 200);
  assert.equal(firstAttack.body.accepted, true);
  assert.equal(firstAttack.body.combat.enemies[0].hp, 40);
  assert.deepEqual(firstAttack.body.combat.events.map((event: any) => event.kind), ["damage"]);

  const defeatAttack = await request(baseUrl, `/rooms/${roomId}/combat/actions`, {
    method: "POST",
    body: JSON.stringify({ actorId: "player-two", targetId: "shared-rat", damage: 40 }),
  });
  assert.equal(defeatAttack.body.accepted, true);
  assert.equal(defeatAttack.body.combat.enemies[0].state, "dead");
  assert.equal(defeatAttack.body.combat.sequence, 3);
  assert.deepEqual(defeatAttack.body.combat.events.map((event: any) => event.kind), ["damage", "damage", "defeat"]);
  assert.equal(defeatAttack.body.combat.events.at(-1).coins, 3);

  const duplicateAttack = await request(baseUrl, `/rooms/${roomId}/combat/actions`, {
    method: "POST",
    body: JSON.stringify({ actorId: "player-one", targetId: "shared-rat", damage: 40 }),
  });
  assert.equal(duplicateAttack.body.accepted, false);
  assert.equal(duplicateAttack.body.combat.sequence, 3);
  assert.equal(duplicateAttack.body.combat.events.filter((event: any) => event.kind === "defeat").length, 1);
  assert.equal(duplicateAttack.body.combat.enemies[0].hp, 0);

  const originalNow = Date.now;
  Date.now = () => originalNow() + 14_001;
  try {
    const afterRespawn = await request(baseUrl, `/rooms/${roomId}/players/player-two`);
    assert.equal(afterRespawn.status, 200);
    assert.equal(afterRespawn.body.combat.enemies[0].state, "idle");
    assert.equal(afterRespawn.body.combat.enemies[0].hp, 100);
    assert.equal(afterRespawn.body.combat.events.filter((event: any) => event.kind === "defeat").length, 1);
    assert.equal(afterRespawn.body.combat.events.at(-1).kind, "respawn");
  } finally {
    Date.now = originalNow;
  }
});

test("recupera sala e sequência de combate depois de recarregar o servidor", async (t) => {
  const server = app.listen(0);
  t.after(() => server.close());

  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}/api/coop`;

  const room = await request(baseUrl, "/rooms", { method: "POST", body: "{}" });
  assert.equal(room.status, 201);
  const roomId = room.body.roomId as string;
  assert.equal((await request(baseUrl, `/rooms/${roomId}/join`, { method: "POST", body: "{}" })).status, 200);

  const enemy = { id: "restart-rat", type: "rat", hp: 100, maxHp: 100, x: 150, y: 100, state: "idle" };
  assert.equal((await request(baseUrl, `/rooms/${roomId}/players/player-one`, {
    method: "PUT", body: JSON.stringify(playerSnapshot([enemy])),
  })).status, 200);
  assert.equal((await request(baseUrl, `/rooms/${roomId}/players/player-two`, {
    method: "PUT", body: JSON.stringify(playerSnapshot([enemy])),
  })).status, 200);

  const firstAttack = await request(baseUrl, `/rooms/${roomId}/combat/actions`, {
    method: "POST",
    body: JSON.stringify({ actorId: "player-one", targetId: "restart-rat", damage: 35 }),
  });
  assert.equal(firstAttack.body.combat.sequence, 1);
  assert.equal(firstAttack.body.combat.enemies[0].hp, 65);

  // Re-read the durable snapshot to model the in-memory state being lost on restart.
  reloadRoomsForTests();

  const recovered = await request(baseUrl, `/rooms/${roomId}/players/player-two`);
  assert.equal(recovered.status, 200);
  assert.equal(recovered.body.combat.sequence, 1);
  assert.equal(recovered.body.combat.enemies[0].hp, 65);

  const defeat = await request(baseUrl, `/rooms/${roomId}/combat/actions`, {
    method: "POST",
    body: JSON.stringify({ actorId: "player-two", targetId: "restart-rat", damage: 65 }),
  });
  assert.equal(defeat.body.combat.sequence, 3);
  assert.deepEqual(defeat.body.combat.events.map((event: any) => event.kind), ["damage", "damage", "defeat"]);

  const originalNow = Date.now;
  Date.now = () => originalNow() + 14_001;
  try {
    const respawned = await request(baseUrl, `/rooms/${roomId}/players/player-one`);
    assert.equal(respawned.status, 200);
    assert.equal(respawned.body.combat.sequence, 4);
    assert.equal(respawned.body.combat.enemies[0].state, "idle");
    assert.equal(respawned.body.combat.enemies[0].hp, 100);
    assert.equal(respawned.body.combat.events.at(-1).kind, "respawn");
  } finally {
    Date.now = originalNow;
  }
});

test("recupera combate entre dois processos reais e mantém a sequência no reaparecimento", async (t) => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "coop-restart-"));
  let first: ChildProcess | undefined;
  let second: ChildProcess | undefined;
  let firstBaseUrl = "";
  let secondBaseUrl = "";
  try {
    const startedFirst = await startServer(tempDir);
    first = startedFirst.child;
    firstBaseUrl = startedFirst.baseUrl;
    const room = await request(firstBaseUrl, "/rooms", { method: "POST", body: "{}" });
    assert.equal(room.status, 201);
    const roomId = room.body.roomId as string;
    assert.equal((await request(firstBaseUrl, `/rooms/${roomId}/join`, { method: "POST", body: "{}" })).status, 200);

    const enemy = { id: "process-rat", type: "rat", hp: 100, maxHp: 100, x: 150, y: 100, state: "idle" };
    for (const playerId of ["player-one", "player-two"]) {
      const registered = await request(firstBaseUrl, `/rooms/${roomId}/players/${playerId}`, {
        method: "PUT", body: JSON.stringify(playerSnapshot([enemy])),
      });
      assert.equal(registered.status, 200);
    }
    const firstAttack = await request(firstBaseUrl, `/rooms/${roomId}/combat/actions`, {
      method: "POST",
      body: JSON.stringify({ actorId: "player-one", targetId: "process-rat", damage: 35 }),
    });
    assert.equal(firstAttack.body.combat.sequence, 1);
    assert.equal(firstAttack.body.combat.enemies[0].hp, 65);
    await stopServer(first);
    first = undefined;

    const startedSecond = await startServer(tempDir);
    second = startedSecond.child;
    secondBaseUrl = startedSecond.baseUrl;
    const recovered = await request(secondBaseUrl, `/rooms/${roomId}/players/player-two`);
    assert.equal(recovered.status, 200);
    assert.equal(recovered.body.combat.sequence, 1);
    assert.equal(recovered.body.combat.enemies[0].hp, 65);

    const defeat = await request(secondBaseUrl, `/rooms/${roomId}/combat/actions`, {
      method: "POST",
      body: JSON.stringify({ actorId: "player-two", targetId: "process-rat", damage: 65 }),
    });
    assert.equal(defeat.body.combat.sequence, 3);
    assert.equal(defeat.body.combat.enemies[0].state, "dead");
    assert.deepEqual(defeat.body.combat.events.map((event: any) => event.kind), ["damage", "damage", "defeat"]);

    await new Promise((resolve) => setTimeout(resolve, 14_050));
    const respawned = await request(secondBaseUrl, `/rooms/${roomId}/players/player-one`);
    assert.equal(respawned.status, 200);
    assert.equal(respawned.body.combat.sequence, 4);
    assert.equal(respawned.body.combat.enemies[0].state, "idle");
    assert.equal(respawned.body.combat.enemies[0].hp, 100);
    assert.equal(respawned.body.combat.events.at(-1).kind, "respawn");
  } finally {
    if (first) await stopServer(first);
    if (second) await stopServer(second);
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("ignora sala interrompida sem impedir outras salas válidas de carregar", async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "coop-damaged-room-"));
  let server: ChildProcess | undefined;
  try {
    const validRoomId = "VALID1";
    writeFileSync(path.join(tempDir, "coop-rooms.json"), JSON.stringify({
      [validRoomId]: {
        id: validRoomId,
        createdAt: Date.now(),
        players: [{
          playerId: "player-one",
          avatar: "moss",
          x: 100,
          y: 100,
          hp: 100,
          maxHp: 100,
          level: 3,
          weaponRank: 2,
          armorRank: 1,
          action: "idle",
          updatedAt: Date.now(),
        }],
      },
      DAMAGED: {
        id: "DAMAGED",
        createdAt: Date.now(),
        // An interrupted write stopped before the required player snapshot.
      },
    }));

    const started = await startServer(tempDir);
    server = started.child;

    const valid = await request(started.baseUrl, `/rooms/${validRoomId}/players/player-two`);
    assert.equal(valid.status, 200);
    assert.equal(valid.body.roomId, validRoomId);

    const damaged = await request(started.baseUrl, "/rooms/DAMAGED/players/player-two");
    assert.equal(damaged.status, 404);
    assert.equal(damaged.body.error, "room_not_found");
  } finally {
    if (server) await stopServer(server);
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("mantém a última sala válida quando a gravação do snapshot falha", async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "coop-atomic-save-"));
  const roomsFile = path.join(tempDir, "coop-rooms.json");
  const roomId = "ATOMIC1";
  try {
    writeFileSync(roomsFile, JSON.stringify({
      [roomId]: {
        id: roomId,
        createdAt: Date.now(),
        players: [{
          playerId: "player-one",
          avatar: "moss",
          x: 100,
          y: 100,
          hp: 100,
          maxHp: 100,
          level: 3,
          weaponRank: 2,
          armorRank: 1,
          action: "idle",
          updatedAt: Date.now(),
        }],
      },
    }), "utf8");
    reloadRoomsForTests(roomsFile);

    persistRoomsForTests(roomsFile, () => {
      throw new Error("simulated interrupted write");
    });

    assert.doesNotThrow(() => JSON.parse(readFileSync(roomsFile, "utf8")));
    reloadRoomsForTests(roomsFile);
    const server = app.listen(0);
    try {
      await new Promise<void>((resolve) => server.once("listening", () => resolve()));
      const { port } = server.address() as AddressInfo;
      const recovered = await request(`http://127.0.0.1:${port}/api/coop`, `/rooms/${roomId}/players/player-two`);
      assert.equal(recovered.status, 200);
      assert.equal(recovered.body.roomId, roomId);
    } finally {
      server.close();
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    reloadRoomsForTests();
  }
});

test("mantém a última sala válida quando a troca do snapshot falha", async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "coop-atomic-rename-"));
  const roomsFile = path.join(tempDir, "coop-rooms.json");
  const roomId = "RENAME1";
  let temporaryFile = "";
  try {
    writeFileSync(roomsFile, JSON.stringify({
      [roomId]: {
        id: roomId,
        createdAt: Date.now(),
        players: [{
          playerId: "player-one",
          avatar: "moss",
          x: 100,
          y: 100,
          hp: 100,
          maxHp: 100,
          level: 3,
          weaponRank: 2,
          armorRank: 1,
          action: "idle",
          updatedAt: Date.now(),
        }],
      },
    }), "utf8");
    reloadRoomsForTests(roomsFile);

    persistRoomsForTests(roomsFile, undefined, (source) => {
      temporaryFile = source;
      throw new Error("simulated snapshot swap failure");
    });

    assert.doesNotThrow(() => JSON.parse(readFileSync(roomsFile, "utf8")));
    assert.equal(existsSync(temporaryFile), false);
    reloadRoomsForTests(roomsFile);
    const server = app.listen(0);
    try {
      await new Promise<void>((resolve) => server.once("listening", () => resolve()));
      const { port } = server.address() as AddressInfo;
      const recovered = await request(`http://127.0.0.1:${port}/api/coop`, `/rooms/${roomId}/players/player-two`);
      assert.equal(recovered.status, 200);
      assert.equal(recovered.body.roomId, roomId);
    } finally {
      server.close();
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    reloadRoomsForTests();
  }
});

test("mantém a sala recuperável quando a troca e a limpeza do temporário falham", async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "coop-atomic-cleanup-"));
  const roomsFile = path.join(tempDir, "coop-rooms.json");
  const roomId = "CLEANUP1";
  let temporaryFile = "";
  try {
    writeFileSync(roomsFile, JSON.stringify({
      [roomId]: {
        id: roomId,
        createdAt: Date.now(),
        players: [{
          playerId: "player-one",
          avatar: "moss",
          x: 100,
          y: 100,
          hp: 100,
          maxHp: 100,
          level: 3,
          weaponRank: 2,
          armorRank: 1,
          action: "idle",
          updatedAt: Date.now(),
        }],
      },
    }), "utf8");
    reloadRoomsForTests(roomsFile);

    persistRoomsForTests(
      roomsFile,
      undefined,
      (source) => {
        temporaryFile = source;
        throw new Error("simulated snapshot swap failure");
      },
      () => {
        throw new Error("simulated temporary cleanup failure");
      },
    );

    assert.doesNotThrow(() => JSON.parse(readFileSync(roomsFile, "utf8")));
    assert.equal(existsSync(temporaryFile), true);
    reloadRoomsForTests(roomsFile);
    const server = app.listen(0);
    try {
      await new Promise<void>((resolve) => server.once("listening", () => resolve()));
      const { port } = server.address() as AddressInfo;
      const recovered = await request(`http://127.0.0.1:${port}/api/coop`, `/rooms/${roomId}/players/player-two`);
      assert.equal(recovered.status, 200);
      assert.equal(recovered.body.roomId, roomId);
    } finally {
      server.close();
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    reloadRoomsForTests();
  }
});

test("remove temporários órfãos de snapshots ao iniciar sem tocar nos JSON principais", async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "coop-orphan-cleanup-"));
  const roomsFile = path.join(tempDir, "coop-rooms.json");
  const orphanRoomsTemp = path.join(tempDir, "coop-rooms.json.999999.0123456789abcdef.tmp");
  const unrelatedTemp = path.join(tempDir, "not-a-snapshot.tmp");
  try {
    const roomsSnapshot = JSON.stringify({ KEEP: { id: "KEEP", createdAt: Date.now(), players: [] } });
    writeFileSync(roomsFile, roomsSnapshot, "utf8");
    writeFileSync(orphanRoomsTemp, "orphan rooms", "utf8");
    writeFileSync(unrelatedTemp, "keep me", "utf8");

    const started = await startServer(tempDir);
    try {
      assert.equal(existsSync(orphanRoomsTemp), false);
      assert.equal(readFileSync(roomsFile, "utf8"), roomsSnapshot);
      assert.equal(readFileSync(unrelatedTemp, "utf8"), "keep me");
      assert.equal((await request(started.baseUrl, "/rooms/KEEP/players/player-two")).status, 200);
    } finally {
      await stopServer(started.child);
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    reloadRoomsForTests();
    reloadProgressForTests();
  }
});

test("mescla atualização parcial e não sobrescreve progresso válido com corrupção", async (t) => {
  const server = app.listen(0);
  t.after(() => server.close());
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}/api/coop`;
  const cookie = `genesis_session=${createSession({ id: `account-save-test-${process.pid}` })}`;
  const headers = { cookie };
  const save = (revision: number, progress: unknown) => request(baseUrl, "/progress/moss", {
    method: "PUT", headers, body: JSON.stringify({ revision, progress }),
  });

  const first = await save(0, {
    avatar: "moss", mapId: "cave", xp: 840, flasks: 7, missions: { "forest-rats": 2 },
    completed: { "forest-rats": true }, rewarded: { "forest-rats": true }, ach: { warrior: true },
  });
  assert.equal(first.status, 200);
  assert.equal(first.body.progress.mapId, "cave");
  assert.equal(first.body.progress.xp, 840);
  assert.equal(first.body.progress.missions["forest-rats"], 2);

  const partial = await save(1, { mapId: "wasteland", xp: -10, flasks: "broken", missions: { unknown: 999, "forest-rats": -4 }, rewarded: { "unknown": true } });
  assert.equal(partial.status, 200);
  assert.equal(partial.body.progress.mapId, "cave");
  assert.equal(partial.body.progress.xp, 840);
  assert.equal(partial.body.progress.flasks, 7);
  assert.equal(partial.body.progress.missions["forest-rats"], 2);
  assert.equal(partial.body.progress.missions.unknown, undefined);
  assert.equal(partial.body.progress.completed["forest-rats"], true);
  assert.equal(partial.body.progress.rewarded["forest-rats"], true);

  const idempotent = await save(2, { completed: { "forest-rats": false }, rewarded: { "forest-rats": false } });
  assert.equal(idempotent.status, 200);
  assert.equal(idempotent.body.progress.completed["forest-rats"], true);
  assert.equal(idempotent.body.progress.rewarded["forest-rats"], true);
});

test("normaliza cache corrompido ao inicializar sem perder conclusão válida", async (t) => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "coop-progress-"));
  const progressFile = path.join(tempDir, "coop-progress.json");
  const accountId = `cache-test-${process.pid}`;
  try {
    writeFileSync(progressFile, JSON.stringify({
      [`${accountId}:moss`]: {
        accountId,
        characterId: "moss",
        revision: "broken",
        updatedAt: "broken",
        progress: {
          avatar: "unknown-avatar",
          weaponRank: "broken",
          xp: -40,
          level: 4,
          missions: { "forest-rats": 2, unknown: 999 },
          accepted: { "forest-rats": false, unknown: true },
          completed: { "forest-rats": true, unknown: true },
          rewarded: { "forest-rats": true, unknown: true },
          ach: { warrior: true, unknown: true },
          unexpected: "discard me",
        },
        unexpected: "discard me",
      },
      "not-a-valid-entry": {
        accountId: "bad",
        characterId: "moss",
        progress: {},
      },
    }), "utf8");
    reloadProgressForTests(progressFile);

    const server = app.listen(0);
    t.after(() => server.close());
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    const { port } = server.address() as AddressInfo;
    const cookie = `genesis_session=${createSession({ id: accountId })}`;
    const saved = await request(`http://127.0.0.1:${port}/api/coop`, "/progress/moss", {
      headers: { cookie },
    });

    assert.equal(saved.status, 200);
    assert.equal(saved.body.revision, 0);
    assert.equal(saved.body.updatedAt, 0);
    assert.equal(saved.body.progress.avatar, "moss");
    assert.equal(saved.body.progress.level, 4);
    assert.equal(saved.body.progress.xp, 0);
    assert.deepEqual(saved.body.progress.missions, { "forest-rats": 2 });
    assert.equal(saved.body.progress.accepted["forest-rats"], true);
    assert.equal(saved.body.progress.completed["forest-rats"], true);
    assert.equal(saved.body.progress.rewarded["forest-rats"], true);
    assert.equal(saved.body.progress.ach.warrior, true);
    assert.equal(saved.body.progress.unknown, undefined);
    assert.equal(saved.body.progress.ach.unknown, undefined);

    const sanitized = JSON.parse(readFileSync(progressFile, "utf8"));
    assert.deepEqual(Object.keys(sanitized), [`${accountId}:moss`]);
    assert.deepEqual(sanitized[`${accountId}:moss`], {
      accountId,
      characterId: "moss",
      revision: 0,
      updatedAt: 0,
      progress: {
        avatar: "moss",
        weaponRank: 1,
        armorRank: 1,
        flasks: 2,
        level: 4,
        xp: 0,
        nextXp: 120,
        ach: { warrior: true },
        kills: {},
        revives: 0,
        dmgTaken: 0,
        missions: { "forest-rats": 2 },
        accepted: { "forest-rats": true },
        completed: { "forest-rats": true },
        rewarded: { "forest-rats": true },
        inventory: {},
        bank: {},
      },
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    reloadProgressForTests();
  }
});

test("inicia e serve progresso válido quando a regravação do cache falha", async (t) => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "coop-progress-readonly-"));
  const progressFile = path.join(tempDir, "coop-progress.json");
  const accountId = `readonly-cache-${process.pid}`;
  try {
    writeFileSync(progressFile, JSON.stringify({
      [`${accountId}:moss`]: {
        accountId,
        characterId: "moss",
        revision: 3,
        updatedAt: 42,
        progress: { avatar: "moss", level: 6, xp: 240, completed: { "forest-rats": true } },
      },
    }), "utf8");

    assert.doesNotThrow(() => {
      reloadProgressForTests(progressFile, () => {
        throw new Error("cache is read-only");
      });
    });

    const server = app.listen(0);
    t.after(() => server.close());
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    const { port } = server.address() as AddressInfo;
    const cookie = `genesis_session=${createSession({ id: accountId })}`;
    const loaded = await request(`http://127.0.0.1:${port}/api/coop`, "/progress/moss", {
      headers: { cookie },
    });

    assert.equal(loaded.status, 200);
    assert.equal(loaded.body.revision, 3);
    assert.equal(loaded.body.progress.level, 6);
    assert.equal(loaded.body.progress.xp, 240);
    assert.equal(loaded.body.progress.completed["forest-rats"], true);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
    reloadProgressForTests();
  }
});

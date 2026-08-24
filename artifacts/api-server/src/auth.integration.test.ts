import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";

import app from "./app";
import { SESSION_COOKIE, createSession } from "./lib/session";

type JsonResponse = {
  status: number;
  body: any;
};

async function startServer() {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const { port } = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${port}/api` };
}

async function request(baseUrl: string, path: string, init?: RequestInit): Promise<JsonResponse> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  return { status: response.status, body: await response.json() };
}

async function login(baseUrl: string, accountId: string) {
  const response = await fetch(`${baseUrl}/login?returnTo=/game`, {
    redirect: "manual",
    headers: { "x-replit-user-id": accountId },
  });
  assert.equal(response.status, 302);
  const cookie = response.headers.get("set-cookie");
  assert.ok(cookie, "login should issue an authenticated session cookie");
  return cookie.split(";", 1)[0];
}

function progressSnapshot(xp: number) {
  return {
    avatar: "moss",
    weaponRank: 2,
    armorRank: 1,
    flasks: 4,
    level: 3,
    xp,
    nextXp: 1000,
    ach: {},
    kills: {},
    revives: 0,
    dmgTaken: 0,
    missions: {},
    accepted: {},
    completed: {},
    rewarded: {},
  };
}

test("sessão autenticada restaura o personagem correto em outro dispositivo", async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => server.close());

  const accountId = `login-restore-account-${process.pid}`;
  const cookie = await login(baseUrl, accountId);
  const saved = await request(baseUrl, "/coop/progress/moss", {
    method: "PUT",
    headers: { cookie },
    body: JSON.stringify({ revision: 0, progress: progressSnapshot(731) }),
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.accountId, accountId);
  assert.equal(saved.body.progress.xp, 731);

  // A new client has no local account header; the signed session is the identity.
  const restored = await request(baseUrl, "/coop/progress/moss", {
    headers: { cookie },
  });
  assert.equal(restored.status, 200);
  assert.equal(restored.body.accountId, accountId);
  assert.equal(restored.body.characterId, "moss");
  assert.equal(restored.body.progress.xp, 731);

  const identity = await request(baseUrl, "/auth/user", { headers: { cookie } });
  assert.deepEqual(identity.body.user, { id: accountId });
});

test("progresso sem sessão é rejeitado mesmo com X-Coop-Account", async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => server.close());

  const headers = { "x-coop-account": "attacker-account" };
  const read = await request(baseUrl, "/coop/progress/moss", { headers });
  assert.equal(read.status, 401);
  assert.equal(read.body.error, "account_required");

  const write = await request(baseUrl, "/coop/progress/moss", {
    method: "PUT",
    headers,
    body: JSON.stringify({ revision: 0, progress: progressSnapshot(9999) }),
  });
  assert.equal(write.status, 401);
  assert.equal(write.body.error, "account_required");
});

test("X-Coop-Account não altera a identidade da sessão", async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => server.close());

  const accountId = `session-owned-account-${process.pid}`;
  const cookie = await login(baseUrl, accountId);
  const saved = await request(baseUrl, "/coop/progress/thorn", {
    method: "PUT",
    headers: { cookie, "x-coop-account": "different-account" },
    body: JSON.stringify({ revision: 0, progress: progressSnapshot(412) }),
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.accountId, accountId);

  const sameSession = await request(baseUrl, "/coop/progress/thorn", {
    headers: { cookie, "x-coop-account": "different-account" },
  });
  assert.equal(sameSession.status, 200);
  assert.equal(sameSession.body.accountId, accountId);
  assert.equal(sameSession.body.progress.xp, 412);
});

test("sessão expirada não restaura nem grava progresso", async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => server.close());

  const accountId = `expired-session-account-${process.pid}`;
  const validCookie = await login(baseUrl, accountId);
  const saved = await request(baseUrl, "/coop/progress/moss", {
    method: "PUT",
    headers: { cookie: validCookie },
    body: JSON.stringify({ revision: 0, progress: progressSnapshot(731) }),
  });
  assert.equal(saved.status, 200);

  const expiredCookie = `${SESSION_COOKIE}=${createSession({ id: accountId }, 0)}`;
  const restored = await request(baseUrl, "/coop/progress/moss", {
    headers: { cookie: expiredCookie },
  });
  assert.equal(restored.status, 401);
  assert.equal(restored.body.error, "account_required");

  const rejectedSave = await request(baseUrl, "/coop/progress/moss", {
    method: "PUT",
    headers: { cookie: expiredCookie },
    body: JSON.stringify({ revision: 1, progress: progressSnapshot(9999) }),
  });
  assert.equal(rejectedSave.status, 401);
  assert.equal(rejectedSave.body.error, "account_required");

  const stillSaved = await request(baseUrl, "/coop/progress/moss", {
    headers: { cookie: validCookie },
  });
  assert.equal(stillSaved.status, 200);
  assert.equal(stillSaved.body.accountId, accountId);
  assert.equal(stillSaved.body.progress.xp, 731);
  assert.equal(stillSaved.body.revision, 1);
});

test("retry do mesmo depósito é idempotente mesmo quando a revisão já avançou", async (t) => {
  const { server, baseUrl } = await startServer();
  t.after(() => server.close());
  const cookie = await login(baseUrl, `bank-retry-account-${process.pid}`);
  const progress = { ...progressSnapshot(12), inventory: { sword1: 1 }, bank: { axe: 1 }, bankOperations: {
    "bank-operation-1": { id: "bank-operation-1", itemId: "sword1", direction: "deposit", amount: 1 },
  } };
  const first = await request(baseUrl, "/coop/progress/moss", {
    method: "PUT", headers: { cookie }, body: JSON.stringify({ revision: 0, progress }),
  });
  assert.equal(first.status, 200);
  const retry = await request(baseUrl, "/coop/progress/moss", {
    method: "PUT", headers: { cookie }, body: JSON.stringify({ revision: 0, progress }),
  });
  assert.equal(retry.status, 200);
  assert.equal(retry.body.revision, first.body.revision);
  assert.deepEqual(retry.body.progress.bank, { axe: 1 });
});

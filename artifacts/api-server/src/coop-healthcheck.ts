import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type AddressInfo } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

type JsonResponse = {
  status: number;
  body: unknown;
};

const packageDirectory = path.resolve(import.meta.dirname, "..");
let serverProcess: ChildProcess | undefined;
const serverOutput: string[] = [];
const REQUEST_TIMEOUT_MS = 10_000;
const SENTINEL_ROOM_ID = "HEALTHCHECK";
const ALERT_MAX_ATTEMPTS = 3;
const ALERT_INITIAL_BACKOFF_MS = 250;
const ALERT_MAX_DURATION_MS = 5_000;

function log(message: string, extra?: Record<string, unknown>) {
  console.log(`[coop-healthcheck] ${message}`);
  if (extra) console.log(JSON.stringify({ service: "coop-healthcheck", ...extra }));
}

async function freePort() {
  const probe = createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => resolve());
  });
  const port = (probe.address() as AddressInfo).port;
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  return port;
}

async function request(
  baseUrl: string,
  endpoint: string,
  init?: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<JsonResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${endpoint}`, {
      ...init,
      signal: controller.signal,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
  } finally {
    clearTimeout(timeout);
  }
  const text = await response.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Keep the raw response so a failed healthcheck includes useful diagnostics.
  }
  return { status: response.status, body };
}

function describe(body: unknown) {
  return typeof body === "string" ? body : JSON.stringify(body) ?? String(body);
}

async function waitForServer(baseUrl: string) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (serverProcess?.exitCode !== null) {
      throw new Error("processo encerrou antes de responder");
    }
    try {
      return await request(baseUrl, "/healthz");
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("processo não respondeu dentro do tempo limite");
}

async function stopServer() {
  if (!serverProcess || serverProcess.exitCode !== null) return;
  serverProcess.kill("SIGTERM");
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      serverProcess?.kill("SIGKILL");
      resolve();
    }, 2_000);
    serverProcess?.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

function publishedBaseUrl() {
  const configured = process.env.COOP_HEALTHCHECK_URL?.trim();
  if (!configured) throw new Error("COOP_HEALTHCHECK_URL é obrigatório no modo publicado");
  return configured.replace(/\/+$/, "").replace(/\/api$/, "") + "/api";
}

type HealthcheckFailure = Error & { endpoint?: string; stage?: string };

function failure(message: string, endpoint: string, stage: string): never {
  const error = new Error(message) as HealthcheckFailure;
  error.endpoint = endpoint;
  error.stage = stage;
  throw error;
}

export async function checkPublished(baseUrl: string) {
  const health = await request(baseUrl, "/healthz").catch((error) =>
    failure(`GET ${baseUrl}/healthz não respondeu: ${describe(error)}`, "/api/healthz", "healthz"),
  );
  if (health.status !== 200 || !health.body || typeof health.body !== "object"
    || (health.body as { status?: unknown }).status !== "ok") {
    failure(`GET /api/healthz retornou HTTP ${health.status}: ${describe(health.body)}`, "/api/healthz", "healthz");
  }
  log("GET /api/healthz: OK");

  // A nonexistent room exercises the cooperative room router and its error
  // handling without creating a room or writing coop-rooms.json.
  const roomEndpoint = `/coop/rooms/${SENTINEL_ROOM_ID}/join`;
  const room = await request(baseUrl, roomEndpoint, { method: "POST", body: "{}" }).catch((error) =>
    failure(`POST ${roomEndpoint} não respondeu: ${describe(error)}`, `/api${roomEndpoint}`, "coop-room-route"),
  );
  if (room.status !== 404 || !room.body || typeof room.body !== "object"
    || (room.body as { error?: unknown }).error !== "room_not_found") {
    failure(`POST /api${roomEndpoint} retornou HTTP ${room.status}: ${describe(room.body)}`, `/api${roomEndpoint}`, "coop-room-route");
  }
  log(`POST /api${roomEndpoint}: OK (sondagem sem alteração persistida)`);
}

async function checkLocal() {
  const dataDirectory = mkdtempSync(path.join(os.tmpdir(), "coop-healthcheck-"));
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}/api`;
  try {
    serverProcess = spawn(process.execPath, ["--import", "tsx/esm", "src/index.ts"], {
      cwd: packageDirectory,
      env: { ...process.env, COOP_DATA_DIR: dataDirectory, NODE_ENV: "test", PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    serverProcess.stdout?.on("data", (chunk: Buffer) => serverOutput.push(chunk.toString("utf8")));
    serverProcess.stderr?.on("data", (chunk: Buffer) => serverOutput.push(chunk.toString("utf8")));

    const health = await waitForServer(baseUrl);
    if (health.status !== 200 || !health.body || typeof health.body !== "object"
      || (health.body as { status?: unknown }).status !== "ok") {
      failure(`GET /api/healthz retornou HTTP ${health.status}: ${describe(health.body)}`, "/api/healthz", "healthz");
    }
    log("GET /api/healthz: OK");

    const room = await request(baseUrl, "/coop/rooms", { method: "POST", body: "{}" });
    if (room.status !== 201 || !room.body || typeof room.body !== "object"
      || typeof (room.body as { roomId?: unknown }).roomId !== "string") {
      failure(`POST /api/coop/rooms retornou HTTP ${room.status}: ${describe(room.body)}`, "/api/coop/rooms", "coop-room-create");
    }
    const roomId = (room.body as { roomId: string }).roomId;
    log(`POST /api/coop/rooms: OK (sala ${roomId})`);

    const playerEndpoint = `/coop/rooms/${roomId}/players/healthcheck-player`;
    const player = await request(baseUrl, playerEndpoint);
    if (player.status !== 200 || !player.body || typeof player.body !== "object"
      || (player.body as { roomId?: unknown }).roomId !== roomId) {
      failure(`GET /api${playerEndpoint} retornou HTTP ${player.status}: ${describe(player.body)}`, `/api${playerEndpoint}`, "coop-room-read");
    }
    log(`GET /api${playerEndpoint}: OK`);
    log("operação cooperativa concluída em diretório temporário; snapshots persistidos não foram usados");
  } finally {
    await stopServer();
    rmSync(dataDirectory, { recursive: true, force: true });
  }
}

export type AlertRetryOptions = {
  maxAttempts?: number;
  initialBackoffMs?: number;
  maxDurationMs?: number;
};

export async function sendAlert(
  error: unknown,
  baseUrl: string,
  alertUrl = process.env.COOP_HEALTHCHECK_ALERT_URL?.trim(),
  options: AlertRetryOptions = {},
) {
  const healthError = error as HealthcheckFailure;
  const alert = {
    service: "coop-healthcheck",
    status: "down",
    endpoint: healthError.endpoint ?? baseUrl,
    stage: healthError.stage ?? "unknown",
    message: error instanceof Error ? error.message : String(error),
    timestamp: new Date().toISOString(),
  };
  console.error(`[coop-healthcheck] ALERTA ${JSON.stringify(alert)}`);
  const webhook = alertUrl;
  if (!webhook) return;

  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? ALERT_MAX_ATTEMPTS));
  const initialBackoffMs = Math.max(0, options.initialBackoffMs ?? ALERT_INITIAL_BACKOFF_MS);
  const maxDurationMs = Math.max(1, options.maxDurationMs ?? ALERT_MAX_DURATION_MS);
  const startedAt = Date.now();
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs >= maxDurationMs) break;

    if (attempt === 1) {
      console.error(`[coop-healthcheck] tentativa inicial de envio do alerta (1/${maxAttempts})`);
    } else {
      console.error(`[coop-healthcheck] reenvio do alerta (tentativa ${attempt}/${maxAttempts})`);
    }

    try {
      const response = await request(
        webhook,
        "",
        { method: "POST", body: JSON.stringify(alert) },
        Math.max(1, Math.min(REQUEST_TIMEOUT_MS, maxDurationMs - elapsedMs)),
      );
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`webhook retornou HTTP ${response.status}: ${describe(response.body)}`);
      }
      return;
    } catch (webhookError) {
      lastError = webhookError;
      const remainingMs = maxDurationMs - (Date.now() - startedAt);
      if (attempt >= maxAttempts || remainingMs <= 0) break;

      const backoffMs = Math.min(initialBackoffMs * 2 ** (attempt - 1), remainingMs);
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  console.error(
    `[coop-healthcheck] esgotadas as tentativas de envio do alerta (${maxAttempts}): ${describe(lastError)}`,
  );
  console.error(`[coop-healthcheck] alerta não pôde ser enviado: ${describe(lastError)}`);
}

async function runOnce() {
  const remote = Boolean(process.env.COOP_HEALTHCHECK_URL?.trim());
  const baseUrl = remote ? publishedBaseUrl() : "http://127.0.0.1:healthcheck";
  try {
    if (remote) await checkPublished(baseUrl);
    else await checkLocal();
    log(`verificação concluída: ${baseUrl}`);
    return true;
  } catch (error) {
    await sendAlert(error, baseUrl);
    if (serverOutput.length) console.error(`[coop-healthcheck] saída do servidor:\n${serverOutput.join("")}`);
    return false;
  }
}

async function main() {
  const intervalSeconds = Number(process.env.COOP_HEALTHCHECK_INTERVAL_SECONDS ?? 0);
  if (!Number.isFinite(intervalSeconds) || intervalSeconds < 0) {
    throw new Error("COOP_HEALTHCHECK_INTERVAL_SECONDS deve ser um número maior ou igual a zero");
  }
  const periodic = intervalSeconds > 0;
  do {
    const ok = await runOnce();
    if (!periodic) {
      if (!ok) process.exitCode = 1;
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1_000));
  } while (true);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    await main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[coop-healthcheck] FALHA: ${message}`);
    const childOutput = outputForProcess();
    if (childOutput) console.error(`[coop-healthcheck] saída do servidor:\n${childOutput}`);
    process.exitCode = 1;
  } finally {
    await stopServer();
  }
}

function outputForProcess() {
  return serverProcess && serverOutput.length > 0 ? serverOutput.join("") : "";
}
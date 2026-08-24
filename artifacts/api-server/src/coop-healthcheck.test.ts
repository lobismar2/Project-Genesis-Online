import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import test from "node:test";

import { checkPublished, sendAlert } from "./coop-healthcheck";

function listen(server: Server) {
  return new Promise<string>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("servidor de teste não recebeu uma porta"));
        return;
      }
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function close(server: Server) {
  return new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

function respond(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

test("envia alerta detalhado quando o healthcheck falha", async (t) => {
  let alertRequest: { method?: string; body: string } | undefined;
  const healthServer = createServer((_request, response) => {
    respond(response, 503, { status: "unavailable" });
  });
  const webhookServer = createServer(async (request, response) => {
    alertRequest = { method: request.method, body: await readBody(request) };
    respond(response, 204, {});
  });
  const healthUrl = await listen(healthServer);
  const webhookUrl = await listen(webhookServer);
  t.after(async () => {
    await close(healthServer);
    await close(webhookServer);
  });

  const loggedErrors: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => loggedErrors.push(args.join(" "));
  try {
    await assert.rejects(
      checkPublished(healthUrl),
      (error: Error & { endpoint?: string; stage?: string }) => {
        assert.equal(error.endpoint, "/api/healthz");
        assert.equal(error.stage, "healthz");
        assert.match(error.message, /HTTP 503/);
        return true;
      },
    );
    await sendAlert(
      Object.assign(new Error("GET /api/healthz retornou HTTP 503: {\"status\":\"unavailable\"}"), {
        endpoint: "/api/healthz",
        stage: "healthz",
      }),
      `${healthUrl}/api`,
      webhookUrl,
    );
  } finally {
    console.error = originalError;
  }

  assert.equal(alertRequest?.method, "POST");
  assert.ok(alertRequest);
  const payload = JSON.parse(alertRequest.body) as Record<string, unknown>;
  assert.equal(payload.service, "coop-healthcheck");
  assert.equal(payload.status, "down");
  assert.equal(payload.endpoint, "/api/healthz");
  assert.equal(payload.stage, "healthz");
  assert.equal(payload.message, "GET /api/healthz retornou HTTP 503: {\"status\":\"unavailable\"}");
  assert.equal(typeof payload.timestamp, "string");
  assert.doesNotThrow(() => new Date(payload.timestamp as string).toISOString());
  assert.match(loggedErrors[0] ?? "", /ALERTA/);
});

test("mantém a falha do webhook visível sem propagar exceção", async (t) => {
  let webhookCalls = 0;
  const webhookServer = createServer((_request, response) => {
    webhookCalls++;
    respond(response, 503, { error: "unavailable" });
  });
  const webhookUrl = await listen(webhookServer);
  t.after(() => close(webhookServer));

  const loggedErrors: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => loggedErrors.push(args.join(" "));
  try {
    await assert.doesNotReject(
      sendAlert(
        Object.assign(new Error("healthcheck falhou"), {
          endpoint: "/api/healthz",
          stage: "healthz",
        }),
        "http://127.0.0.1:1/api",
        webhookUrl,
        { initialBackoffMs: 1 },
      ),
    );
  } finally {
    console.error = originalError;
  }

  assert.ok(loggedErrors.some((line) => line.includes("alerta não pôde ser enviado")));
  assert.ok(loggedErrors.some((line) => line.includes("tentativa inicial de envio do alerta")));
  assert.ok(loggedErrors.some((line) => line.includes("reenvio do alerta")));
  assert.ok(loggedErrors.some((line) => line.includes("esgotadas as tentativas")));
  assert.equal(webhookCalls, 3);
});

test("reenvia após falha transitória e entrega o alerta", async (t) => {
  let webhookCalls = 0;
  const webhookServer = createServer((_request, response) => {
    webhookCalls++;
    respond(response, webhookCalls === 1 ? 503 : 204, webhookCalls === 1 ? { error: "unavailable" } : {});
  });
  const webhookUrl = await listen(webhookServer);
  t.after(() => close(webhookServer));

  const loggedErrors: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => loggedErrors.push(args.join(" "));
  try {
    await assert.doesNotReject(
      sendAlert(
        Object.assign(new Error("healthcheck falhou"), {
          endpoint: "/api/healthz",
          stage: "healthz",
        }),
        "http://127.0.0.1:1/api",
        webhookUrl,
        { initialBackoffMs: 1 },
      ),
    );
  } finally {
    console.error = originalError;
  }

  assert.equal(webhookCalls, 2);
  assert.ok(loggedErrors.some((line) => line.includes("tentativa inicial de envio do alerta")));
  assert.ok(loggedErrors.some((line) => line.includes("reenvio do alerta")));
  assert.ok(!loggedErrors.some((line) => line.includes("esgotadas as tentativas")));
});
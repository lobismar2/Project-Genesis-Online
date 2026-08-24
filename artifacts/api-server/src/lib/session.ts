import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

export const SESSION_COOKIE = "genesis_session";
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
const secret = () => process.env.SESSION_SECRET ?? "development-session-secret";

export type AuthUser = { id: string; name?: string; email?: string };

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      isAuthenticated(): this is Request & { user: AuthUser };
    }
  }
}

function encode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function createSession(user: AuthUser, issuedAt = Date.now()) {
  const payload = encode(JSON.stringify({ ...user, exp: issuedAt + SESSION_TTL }));
  return `${payload}.${sign(payload)}`;
}

export function readSession(value: unknown): AuthUser | null {
  if (typeof value !== "string") return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
    return typeof data.id === "string" && data.id.length > 0 && typeof data.exp === "number" && data.exp > Date.now()
      ? { id: data.id, name: typeof data.name === "string" ? data.name : undefined, email: typeof data.email === "string" ? data.email : undefined }
      : null;
  } catch {
    return null;
  }
}

export function setSession(res: Response, user: AuthUser) {
  res.cookie(SESSION_COOKIE, createSession(user), {
    httpOnly: true, secure: process.env.NODE_ENV !== "development", sameSite: "lax", path: "/", maxAge: SESSION_TTL,
  });
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  req.isAuthenticated = function (this: Request): this is Request & { user: AuthUser } { return this.user != null; };
  const user = readSession(req.cookies?.[SESSION_COOKIE]);
  if (user) req.user = user;
  next();
}
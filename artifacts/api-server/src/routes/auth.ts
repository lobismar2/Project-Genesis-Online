import { Router, type Request } from "express";
import { SESSION_COOKIE, setSession, type AuthUser } from "../lib/session";

const router = Router();

// The hosting layer supplies this identity only after it has authenticated the
// visitor. The client never gets to choose the value used as the account key.
function trustedUser(req: Request): AuthUser | null {
  const id = req.header("x-replit-user-id") ?? req.header("x-authenticated-user-id");
  if (!id || !/^[a-zA-Z0-9_.:@-]{1,256}$/.test(id)) return null;
  return {
    id,
    name: req.header("x-replit-user-name") ?? undefined,
    email: req.header("x-replit-user-email") ?? undefined,
  };
}

router.get("/auth/user", (req, res) => res.json({ user: req.user ?? null }));

router.get("/login", (req, res) => {
  const user = trustedUser(req);
  if (!user) return res.status(503).json({ error: "authentication_unavailable" });
  setSession(res, user);
  const returnTo = typeof req.query.returnTo === "string" && req.query.returnTo.startsWith("/") && !req.query.returnTo.startsWith("//") ? req.query.returnTo : "/";
  return res.redirect(returnTo);
});

router.get("/logout", (req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  const returnTo = typeof req.query.returnTo === "string" && req.query.returnTo.startsWith("/") && !req.query.returnTo.startsWith("//") ? req.query.returnTo : "/";
  return res.redirect(returnTo);
});

export default router;
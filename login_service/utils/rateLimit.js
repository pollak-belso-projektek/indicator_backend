import { rateLimit, ipKeyGenerator } from "express-rate-limit";

/**
 * The real client address. Behind Cloudflare -> tunnel -> gateway every request
 * reaches this service from the same proxy address, so `req.ip` alone would put
 * all users into one shared bucket (one person's failures would lock out everyone).
 * Cloudflare sets `cf-connecting-ip`; fall back to `req.ip` when it is absent.
 */
export function clientIp(req) {
  const cf = req.headers["cf-connecting-ip"];
  return (typeof cf === "string" && cf.trim()) || req.ip || "unknown";
}

const byClient = (req) => `ip:${ipKeyGenerator(clientIp(req))}`;

function accountKey(req) {
  const email = req.body?.email;
  return typeof email === "string" && email.trim() ? `acct:${email.trim().toLowerCase()}` : byClient(req);
}

const tooMany = (message) => ({ message });

const base = {
  standardHeaders: true,
  legacyHeaders: false,
  // Only failed attempts count: a user logging in normally is never blocked.
  skipSuccessfulRequests: true,
};

/**
 * Login limits (password and 2FA brute force):
 *  - per client:  30 failed attempts / 15 minutes
 *  - per account: 10 failed attempts / 15 minutes (stops distributed guessing on one account)
 */
export function createLoginLimiters({ windowMs = 15 * 60 * 1000, perClient = 30, perAccount = 10 } = {}) {
  const message = tooMany("Túl sok sikertelen bejelentkezési kísérlet. Kérjük, próbáld újra később.");
  return [
    rateLimit({ ...base, windowMs, limit: perClient, keyGenerator: byClient, message }),
    rateLimit({ ...base, windowMs, limit: perAccount, keyGenerator: accountKey, message }),
  ];
}

/** Google login: no e-mail before verification, so per client only. */
export function createGoogleLoginLimiter({ windowMs = 15 * 60 * 1000, limit = 30 } = {}) {
  return rateLimit({
    ...base, windowMs, limit, keyGenerator: byClient,
    message: tooMany("Túl sok sikertelen bejelentkezési kísérlet. Kérjük, próbáld újra később."),
  });
}

/** 2FA setup verification for a logged-in user: limited per user. */
export function createTwoFactorLimiter({ windowMs = 15 * 60 * 1000, limit = 10 } = {}) {
  return rateLimit({
    ...base, windowMs, limit,
    keyGenerator: (req) => (req.userId ? `user:${req.userId}` : byClient(req)),
    message: tooMany("Túl sok hibás kód. Kérjük, próbáld újra később."),
  });
}

/** Forgot password: 3 requests / hour per client and per e-mail address (counts every request). */
export function createForgotPasswordLimiters({ windowMs = 60 * 60 * 1000, limit = 3 } = {}) {
  const message = tooMany("Túl sok kérés. Kérjük, próbáld újra egy óra múlva.");
  const opts = { standardHeaders: true, legacyHeaders: false, windowMs, limit, message };
  return [
    rateLimit({ ...opts, keyGenerator: byClient }),
    rateLimit({ ...opts, keyGenerator: accountKey }),
  ];
}

const crypto = require("crypto");
const { readDb, publicUser } = require("./db");

const SESSION_SECRET = process.env.SESSION_SECRET || "change-this-before-production";

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, savedHash] = stored.split(":");
  const candidate = crypto.scryptSync(password, salt, 64);
  const saved = Buffer.from(savedHash, "hex");
  return saved.length === candidate.length && crypto.timingSafeEqual(saved, candidate);
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verify(token) {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function createSession(user) {
  return sign({
    sub: user.id,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7
  });
}

function getBearer(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice(7);
}

function currentUser(req) {
  const payload = verify(getBearer(req));
  if (!payload) return null;
  const db = readDb();
  return db.users.find((user) => user.id === payload.sub) || null;
}

function requireAuth(handler) {
  return (req, res, params) => {
    const user = currentUser(req);
    if (!user) return res.error(401, "Please log in first.");
    return handler(req, res, params, user);
  };
}

function requireAdmin(handler) {
  return requireAuth((req, res, params, user) => {
    if (user.role !== "Admin") return res.error(403, "Only admins can do that.");
    return handler(req, res, params, user);
  });
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSession,
  requireAuth,
  requireAdmin,
  publicUser
};

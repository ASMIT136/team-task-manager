const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const dataDir = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const dbPath = process.env.DB_PATH || path.join(dataDir, "db.json");

function createEmptyDb() {
  return {
    users: [],
    projects: [],
    projectMembers: [],
    tasks: []
  };
}

function normalizeDb(db) {
  const emptyDb = createEmptyDb();
  return Object.fromEntries(
    Object.entries(emptyDb).map(([key, fallback]) => [key, Array.isArray(db?.[key]) ? db[key] : fallback])
  );
}

function ensureDb() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(createEmptyDb(), null, 2));
  }
}

function readDb() {
  ensureDb();
  const raw = fs.readFileSync(dbPath, "utf8");
  return raw.trim() ? normalizeDb(JSON.parse(raw)) : createEmptyDb();
}

function writeDb(db) {
  ensureDb();
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function now() {
  return new Date().toISOString();
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt
  };
}

module.exports = {
  readDb,
  writeDb,
  id,
  now,
  publicUser
};

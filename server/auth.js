//passwords and login tokens
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import db from "./db.js";

const dir = path.dirname(fileURLToPath(import.meta.url));
const TOKEN_DAYS = 7;

//the secret that signs login tokens. anyone who knows it can make a token for any user,
//so it can't be a fixed string in the code. set AUTH_SECRET in server/.env, or a random one
//is made the first time and kept in server/auth-secret.txt (gitignored) so a restart
//doesn't log everyone out
function loadSecret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  const file = path.join(dir, "auth-secret.txt");
  try {
    const saved = fs.readFileSync(file, "utf8").trim();
    if (saved) return saved;
  } catch {
    //not made yet
  }
  const secret = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(file, secret + "\n", { mode: 0o600 });
  return secret;
}

const SECRET = loadSecret();

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function checkPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(test, Buffer.from(hash, "hex"));
}

function sign(data) {
  return crypto.createHmac("sha256", SECRET).update(data).digest("base64url");
}

export function makeToken(userId) {
  const exp = Date.now() + TOKEN_DAYS * 24 * 60 * 60 * 1000;
  const payload = Buffer.from(JSON.stringify({ id: userId, exp })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function readToken(token) {
  const [payload, sig] = (token || "").split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

//put on any route that needs a logged in user.
//also checks the user still exists (the database might have been reset)
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const data = readToken(header.replace(/^Bearer /, ""));
  const user = data && db.prepare("SELECT 1 FROM user WHERE user_id = ?").get(data.id);
  if (!user) return res.status(401).json({ error: "Log in to continue." });
  req.userId = data.id;
  next();
}

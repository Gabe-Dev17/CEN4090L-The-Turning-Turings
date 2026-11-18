import crypto from "node:crypto";

const SECRET = process.env.AUTH_SECRET || "dev-secret-change-me";
const TOKEN_DAYS = 7;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function checkPassword(password, stored) {
  const [salt, hash] = stored.split(":");
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

//put on any route that needs a logged in user
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const data = readToken(header.replace(/^Bearer /, ""));
  if (!data) return res.status(401).json({ error: "Not logged in" });
  req.userId = data.id;
  next();
}

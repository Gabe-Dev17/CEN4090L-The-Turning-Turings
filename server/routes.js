import express from "express";
import { randomUUID } from "node:crypto";
import db from "./db.js";
import { hashPassword, checkPassword, makeToken, requireAuth } from "./auth.js";
import { check, registerSchema, loginSchema } from "./validate.js";
import entryRoutes from "./entries.js";
import foodRoutes from "./foods.js";
import { goalRoutes, waterRoutes, weightRoutes, diaryRoutes } from "./tracking.js";

const router = express.Router();

//never sends the password hash
function publicUser(u) {
  return { userId: u.user_id, email: u.email, displayName: u.display_name };
}

//auth
router.post("/auth/register", (req, res) => {
  const { name, email, password } = check(registerSchema, req.body);

  const exists = db.prepare("SELECT 1 FROM user WHERE email = ?").get(email);
  if (exists) return res.status(409).json({ error: "An account with this email already exists.", field: "email" });

  const userId = randomUUID();
  db.prepare("INSERT INTO user (user_id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)").run(
    userId, email, hashPassword(password), name, new Date().toISOString()
  );
  const user = db.prepare("SELECT * FROM user WHERE user_id = ?").get(userId);
  res.status(201).json({ token: makeToken(userId), user: publicUser(user) });
});

//same message for a wrong password and an unknown email, so it doesn't give away who has an account
router.post("/auth/login", (req, res) => {
  const { email, password } = check(loginSchema, req.body);
  const user = db.prepare("SELECT * FROM user WHERE email = ?").get(email);
  if (!user || !checkPassword(password, user.password_hash)) {
    return res.status(401).json({ error: "Email or password is incorrect." });
  }
  res.json({ token: makeToken(user.user_id), user: publicUser(user) });
});

//everything below needs a token
router.use(requireAuth);

router.get("/me", (req, res) => {
  const user = db.prepare("SELECT * FROM user WHERE user_id = ?").get(req.userId);
  res.json(publicUser(user));
});

router.use("/entries", entryRoutes);
router.use("/foods", foodRoutes);
router.use("/goal", goalRoutes);
router.use("/water", waterRoutes);
router.use("/weight", weightRoutes);
router.use("/diary", diaryRoutes);

export default router;

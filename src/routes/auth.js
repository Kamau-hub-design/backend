import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function issueToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" },
  );
}

router.post("/register", (req, res) => {
  const { name, email, password } = req.body ?? {};
  if (
    typeof name !== "string" ||
    name.trim().length < 2 ||
    name.trim().length > 100 ||
    typeof email !== "string" ||
    !emailPattern.test(email) ||
    typeof password !== "string" ||
    password.length < 8 ||
    password.length > 72
  ) {
    return res.status(400).json({
      error: "Provide a name, valid email, and password between 8 and 72 characters",
    });
  }

  const passwordHash = bcrypt.hashSync(password, 12);
  try {
    const result = db
      .prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)")
      .run(name.trim(), email.trim().toLowerCase(), passwordHash);
    const user = db
      .prepare("SELECT id, name, email, role FROM users WHERE id = ?")
      .get(result.lastInsertRowid);
    return res.status(201).json({ user, token: issueToken(user) });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ error: "An account with that email already exists" });
    }
    throw error;
  }
});

router.post("/login", (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const publicUser = { id: user.id, name: user.name, email: user.email, role: user.role };
  return res.json({ user: publicUser, token: issueToken(publicUser) });
});

router.get("/me", requireAuth, (req, res) => {
  const user = db
    .prepare("SELECT id, name, email, role, created_at FROM users WHERE id = ?")
    .get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  return res.json({ user });
});

export default router;

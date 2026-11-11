import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "./db.js";

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!email || !password || password.length < 12) {
  throw new Error("Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters in .env");
}

const existingAdmin = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
if (existingAdmin) {
  console.log(`Administrator ${email} already exists; no changes made.`);
} else {
  db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')").run(
    "Store Admin",
    email,
    bcrypt.hashSync(password, 12),
  );
  console.log(`Created administrator ${email}.`);
}

const productCount = db.prepare("SELECT COUNT(*) AS count FROM products").get().count;
if (productCount === 0) {
  const insertProduct = db.prepare(
    "INSERT INTO products (name, description, category, price_cents, stock) VALUES (?, ?, ?, ?, ?)",
  );
  insertProduct.run("Everyday Backpack", "A durable bag for everyday use.", "Accessories", 4999, 25);
  insertProduct.run("Ceramic Travel Mug", "A reusable mug for hot and cold drinks.", "Home", 1899, 40);
  console.log("Added two sample products.");
}

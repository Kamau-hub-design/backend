import { Router } from "express";
import { db } from "../db.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

const router = Router();
const productFields = ["name", "description", "category", "price_cents", "stock", "image_url"];

function validProduct(input, partial = false) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const has = (field) => Object.hasOwn(input, field);
  if (!partial && !["name", "price_cents", "stock"].every(has)) return false;
  if (has("name") && (typeof input.name !== "string" || !input.name.trim())) return false;
  if (has("description") && typeof input.description !== "string") return false;
  if (has("category") && (typeof input.category !== "string" || !input.category.trim())) return false;
  if (has("image_url") && input.image_url !== null && typeof input.image_url !== "string") return false;
  if (has("price_cents") && (!Number.isSafeInteger(input.price_cents) || input.price_cents < 0)) return false;
  if (has("stock") && (!Number.isSafeInteger(input.stock) || input.stock < 0)) return false;
  return true;
}

router.get("/", (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
  const search = typeof req.query.search === "string" ? `%${req.query.search.trim()}%` : null;
  const category = typeof req.query.category === "string" ? req.query.category.trim() : null;
  const where = [];
  const values = [];
  if (search) {
    where.push("(name LIKE ? OR description LIKE ?)");
    values.push(search, search);
  }
  if (category) {
    where.push("category = ?");
    values.push(category);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = db.prepare(`SELECT COUNT(*) AS count FROM products ${clause}`).get(...values).count;
  const products = db
    .prepare(`SELECT * FROM products ${clause} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(...values, limit, (page - 1) * limit);
  return res.json({ products, pagination: { page, limit, total } });
});

router.get("/:id", (req, res) => {
  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!product) return res.status(404).json({ error: "Product not found" });
  return res.json({ product });
});

router.post("/", requireAuth, requireAdmin, (req, res) => {
  if (!validProduct(req.body)) {
    return res.status(400).json({ error: "Invalid product fields" });
  }
  const input = req.body;
  const result = db
    .prepare(
      `INSERT INTO products (${productFields.join(", ")})
       VALUES (@name, @description, @category, @price_cents, @stock, @image_url)`,
    )
    .run({
      name: input.name.trim(),
      description: input.description ?? "",
      category: input.category?.trim() || "General",
      price_cents: input.price_cents,
      stock: input.stock,
      image_url: input.image_url ?? null,
    });
  const product = db.prepare("SELECT * FROM products WHERE id = ?").get(result.lastInsertRowid);
  return res.status(201).json({ product });
});

router.patch("/:id", requireAuth, requireAdmin, (req, res) => {
  if (!validProduct(req.body, true) || !Object.keys(req.body).some((key) => productFields.includes(key))) {
    return res.status(400).json({ error: "Provide valid product fields to update" });
  }
  const current = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!current) return res.status(404).json({ error: "Product not found" });
  const updates = Object.fromEntries(
    Object.entries(req.body)
      .filter(([key]) => productFields.includes(key))
      .map(([key, value]) => [key, typeof value === "string" && key !== "image_url" ? value.trim() : value]),
  );
  const next = { ...current, ...updates };
  if (!next.name || !next.category) return res.status(400).json({ error: "Name and category cannot be empty" });
  db.prepare(
    `UPDATE products SET name = @name, description = @description, category = @category,
     price_cents = @price_cents, stock = @stock, image_url = @image_url WHERE id = @id`,
  ).run(next);
  return res.json({ product: db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id) });
});

router.delete("/:id", requireAuth, requireAdmin, (req, res) => {
  const result = db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: "Product not found" });
  return res.status(204).end();
});

export default router;

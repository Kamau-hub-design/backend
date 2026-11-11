import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

function getCart(userId) {
  const items = db
    .prepare(
      `SELECT p.id AS product_id, p.name, p.price_cents, p.stock, p.image_url, c.quantity,
       p.price_cents * c.quantity AS line_total_cents
       FROM cart_items c JOIN products p ON p.id = c.product_id
       WHERE c.user_id = ? ORDER BY p.name`,
    )
    .all(userId);
  return {
    items,
    total_cents: items.reduce((total, item) => total + item.line_total_cents, 0),
  };
}

router.get("/", (req, res) => res.json({ cart: getCart(req.user.id) }));

router.post("/items", (req, res) => {
  const { product_id: productId, quantity } = req.body ?? {};
  if (!Number.isSafeInteger(Number(productId)) || !Number.isSafeInteger(quantity) || quantity < 1) {
    return res.status(400).json({ error: "A product_id and positive integer quantity are required" });
  }
  const product = db.prepare("SELECT id, stock FROM products WHERE id = ?").get(Number(productId));
  if (!product) return res.status(404).json({ error: "Product not found" });
  const existing = db
    .prepare("SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?")
    .get(req.user.id, product.id)?.quantity ?? 0;
  if (existing + quantity > product.stock) {
    return res.status(409).json({ error: "Requested quantity exceeds available stock" });
  }
  db.prepare(
    `INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)
     ON CONFLICT(user_id, product_id) DO UPDATE SET quantity = excluded.quantity`,
  ).run(req.user.id, product.id, existing + quantity);
  return res.status(201).json({ cart: getCart(req.user.id) });
});

router.put("/items/:productId", (req, res) => {
  const { quantity } = req.body ?? {};
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    return res.status(400).json({ error: "Quantity must be a positive integer" });
  }
  const product = db.prepare("SELECT stock FROM products WHERE id = ?").get(req.params.productId);
  if (!product) return res.status(404).json({ error: "Product not found" });
  if (quantity > product.stock) {
    return res.status(409).json({ error: "Requested quantity exceeds available stock" });
  }
  const result = db
    .prepare("UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?")
    .run(quantity, req.user.id, req.params.productId);
  if (!result.changes) return res.status(404).json({ error: "Product is not in your cart" });
  return res.json({ cart: getCart(req.user.id) });
});

router.delete("/items/:productId", (req, res) => {
  const result = db
    .prepare("DELETE FROM cart_items WHERE user_id = ? AND product_id = ?")
    .run(req.user.id, req.params.productId);
  if (!result.changes) return res.status(404).json({ error: "Product is not in your cart" });
  return res.json({ cart: getCart(req.user.id) });
});

router.delete("/", (req, res) => {
  db.prepare("DELETE FROM cart_items WHERE user_id = ?").run(req.user.id);
  return res.status(204).end();
});

export default router;

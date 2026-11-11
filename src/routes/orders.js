import { Router } from "express";
import { db } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

const checkout = db.transaction((userId) => {
  const items = db
    .prepare(
      `SELECT c.product_id, c.quantity, p.name, p.price_cents, p.stock
       FROM cart_items c JOIN products p ON p.id = c.product_id WHERE c.user_id = ?`,
    )
    .all(userId);
  if (!items.length) {
    const error = new Error("Your cart is empty");
    error.status = 400;
    throw error;
  }
  for (const item of items) {
    if (item.quantity > item.stock) {
      const error = new Error(`${item.name} does not have enough stock`);
      error.status = 409;
      throw error;
    }
  }
  const total = items.reduce((sum, item) => sum + item.price_cents * item.quantity, 0);
  const orderId = db
    .prepare("INSERT INTO orders (user_id, total_cents) VALUES (?, ?)")
    .run(userId, total).lastInsertRowid;
  const addItem = db.prepare(
    `INSERT INTO order_items (order_id, product_id, product_name, unit_price_cents, quantity)
     VALUES (?, ?, ?, ?, ?)`,
  );
  const reduceStock = db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?");
  for (const item of items) {
    addItem.run(orderId, item.product_id, item.name, item.price_cents, item.quantity);
    reduceStock.run(item.quantity, item.product_id);
  }
  db.prepare("DELETE FROM cart_items WHERE user_id = ?").run(userId);
  return orderId;
});

function orderById(orderId, userId) {
  const order = db
    .prepare("SELECT * FROM orders WHERE id = ? AND user_id = ?")
    .get(orderId, userId);
  if (!order) return null;
  order.items = db
    .prepare("SELECT product_id, product_name, unit_price_cents, quantity FROM order_items WHERE order_id = ?")
    .all(order.id);
  return order;
}

router.post("/", (req, res) => {
  try {
    const orderId = checkout(req.user.id);
    return res.status(201).json({ order: orderById(orderId, req.user.id) });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    throw error;
  }
});

router.get("/", (req, res) => {
  const orders = db
    .prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC, id DESC")
    .all(req.user.id);
  for (const order of orders) {
    order.items = db
      .prepare("SELECT product_id, product_name, unit_price_cents, quantity FROM order_items WHERE order_id = ?")
      .all(order.id);
  }
  return res.json({ orders });
});

router.get("/:id", (req, res) => {
  const order = orderById(req.params.id, req.user.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  return res.json({ order });
});

export default router;

import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import request from "supertest";

process.env.JWT_SECRET = "test-secret-that-is-long-enough-for-tests";
process.env.DATABASE_FILE = ":memory:";

const { app } = await import("../src/app.js");
const { db } = await import("../src/db.js");
const bcrypt = (await import("bcryptjs")).default;

let customerToken;
let adminToken;
let productId;

before(async () => {
  const customerId = db
    .prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)")
    .run("Test Customer", "customer@example.com", bcrypt.hashSync("customer-pass-123", 4)).lastInsertRowid;
  const adminId = db
    .prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')")
    .run("Test Admin", "admin@example.com", bcrypt.hashSync("admin-pass-123", 4)).lastInsertRowid;
  const { default: jwt } = await import("jsonwebtoken");
  customerToken = jwt.sign({ id: customerId, role: "customer" }, process.env.JWT_SECRET);
  adminToken = jwt.sign({ id: adminId, role: "admin" }, process.env.JWT_SECRET);
});

after(() => db.close());

test("health endpoint responds", async () => {
  const response = await request(app).get("/api/health");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: "ok" });
});

test("product management requires administrator access", async () => {
  const denied = await request(app)
    .post("/api/products")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ name: "Test Item", price_cents: 500, stock: 3 });
  assert.equal(denied.status, 403);

  const created = await request(app)
    .post("/api/products")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ name: "Test Item", price_cents: 500, stock: 3 });
  assert.equal(created.status, 201);
  productId = created.body.product.id;
});

test("customer can add an item and check out atomically", async () => {
  const added = await request(app)
    .post("/api/cart/items")
    .set("Authorization", `Bearer ${customerToken}`)
    .send({ product_id: productId, quantity: 2 });
  assert.equal(added.status, 201);
  assert.equal(added.body.cart.total_cents, 1000);

  const ordered = await request(app)
    .post("/api/orders")
    .set("Authorization", `Bearer ${customerToken}`);
  assert.equal(ordered.status, 201);
  assert.equal(ordered.body.order.total_cents, 1000);
  assert.equal(ordered.body.order.items[0].quantity, 2);
  assert.equal(db.prepare("SELECT stock FROM products WHERE id = ?").get(productId).stock, 1);
  assert.equal(
    (await request(app).get("/api/cart").set("Authorization", `Bearer ${customerToken}`)).body.cart.items.length,
    0,
  );
});

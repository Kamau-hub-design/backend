import express from "express";
import authRoutes from "./routes/auth.js";
import cartRoutes from "./routes/cart.js";
import orderRoutes from "./routes/orders.js";
import productRoutes from "./routes/products.js";

export const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);

app.use((req, res) => res.status(404).json({ error: "Route not found" }));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof SyntaxError && "body" in error) {
    return res.status(400).json({ error: "Invalid JSON request body" });
  }
  console.error(error);
  return res.status(500).json({ error: "Internal server error" });
});

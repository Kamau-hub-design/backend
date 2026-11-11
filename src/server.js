import "dotenv/config";
import { app } from "./app.js";
import "./db.js";

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be set to a secret of at least 32 characters");
}

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a valid TCP port");
}

app.listen(port, () => {
  console.log(`E-commerce API listening on http://localhost:${port}`);
});

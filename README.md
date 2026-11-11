# E-commerce API

A Node.js REST API starter for products, customer accounts, shopping carts, and orders. It uses Express and SQLite; prices are stored as integer cents.

## Requirements

- Node.js 20 or newer

## Setup

```powershell
npm install
Copy-Item .env.example .env
```

Set `JWT_SECRET` to a random secret of at least 32 characters and set a strong `ADMIN_PASSWORD` (at least 12 characters) in `.env`. Then run:

```powershell
npm run seed
npm run dev
```

The API listens on `http://localhost:3000` by default. SQLite creates `data/store.db` automatically. The seed command creates the administrator and adds sample products only when they are not already present.

## API

All endpoints are prefixed with `/api`.

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/health` | Public | Health check |
| POST | `/auth/register` | Public | Create customer account |
| POST | `/auth/login` | Public | Sign in and receive a bearer token |
| GET | `/auth/me` | Signed in | Current account |
| GET | `/products` | Public | Browse products (`search`, `category`, `page`, `limit`) |
| GET | `/products/:id` | Public | Product details |
| POST | `/products` | Admin | Create a product |
| PATCH | `/products/:id` | Admin | Update product fields |
| DELETE | `/products/:id` | Admin | Delete a product |
| GET | `/cart` | Signed in | View cart |
| POST | `/cart/items` | Signed in | Add quantity: `{ "product_id": 1, "quantity": 2 }` |
| PUT | `/cart/items/:productId` | Signed in | Set item quantity: `{ "quantity": 2 }` |
| DELETE | `/cart/items/:productId` | Signed in | Remove item |
| DELETE | `/cart` | Signed in | Empty cart |
| POST | `/orders` | Signed in | Check out cart and reserve stock |
| GET | `/orders` | Signed in | List own orders |
| GET | `/orders/:id` | Signed in | View own order |

For admin and customer-only endpoints, send `Authorization: Bearer <token>` using the token returned by register or login. Product create/update bodies use `name`, `description`, `category`, `price_cents`, `stock`, and optional `image_url`.

## Tests

```powershell
npm test
```

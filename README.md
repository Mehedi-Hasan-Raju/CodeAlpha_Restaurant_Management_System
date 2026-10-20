# MHR Restaurent

A restaurant point-of-sale system with a live kitchen display. Staff can take dine-in, takeaway and delivery orders, manage the menu, tables, reservations and stock, bill customers, and follow sales on a dashboard.

The project has two parts:

- `backend/` is a REST API with real-time updates (Node.js, Express, PostgreSQL, Prisma, Socket.IO).
- `frontend/` is the staff web app (Next.js).

## Features

- **POS:** pick items, choose addons (size, toppings, dressing), apply a coupon, place the order. The server calculates every price.
- **Kitchen display:** orders move through New, Preparing, Ready and Served, and appear on every screen instantly.
- **Floor plan and reservations:** table status updates automatically when an order is placed or a reservation changes.
- **Menu management:** categories, items with image upload, addon groups and coupons.
- **Billing:** invoices, payments, refunds and one-click payment (no payment gateway).
- **Inventory:** stock levels with +/- adjustment and low-stock alerts.
- **Dashboard:** revenue, orders, average order, new customers, sales by day, orders by type and top items.
- **Roles:** admin, cashier and kitchen, each with their own pages and permissions.

## Tech stack

| Part | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, plain CSS |
| Backend | Node.js, Express |
| Database | PostgreSQL with Prisma 6 |
| Auth | JWT (7 days) and bcrypt password hashing |
| Real-time | Socket.IO |
| Uploads | multer (files saved on disk) |

## Project structure

```
Restaurent/
  backend/
    prisma/
      schema.prisma          database schema
      seed*.js               demo data scripts
    scripts/
      listen.js              prints live socket events (for testing)
    src/
      server.js              app entry
      prisma.js              database client
      realtime.js            Socket.IO setup and emit helper
      middleware/auth.js     login check and role check
      routes/                one file per API area
      utils/                 pricing, billing and helper functions
    uploads/                 uploaded item images (not in git)
  frontend/
    app/                     layout, global styles, page route
    components/              shell (sidebar, login gate), pages, forms
    lib/
      api.js                 all requests to the backend
      auth.js                login state
      store.js               shared app state
```

## Getting started

### 1. Requirements

- Node.js 18 or newer
- PostgreSQL (running)

### 2. Create the database

In pgAdmin or `psql`:

```sql
CREATE DATABASE restropos;
```

### 3. Backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/restropos?schema=public"
PORT=4000
JWT_SECRET="put_a_long_random_text_here"
```

Create the tables and load demo data:

```bash
npx prisma migrate dev
node prisma/seed.js
node prisma/seedUsers.js
node prisma/seedMenu.js
node prisma/seedFloor.js
node prisma/seedInventory.js
```

Optional: demo sales history for the dashboard charts.

```bash
node prisma/seedSales.js            # adds about two weeks of demo orders
node prisma/seedSales.js --clear    # removes them again
```


## Demo accounts

These are for development only. Change or delete them before going live.

| Role | Email | Password |
|---|---|---|
| Admin | admin@restropos.com | admin123 |
| Cashier | cashier@restropos.com | cashier123 |
| Kitchen | kitchen@restropos.com | kitchen123 |

Anyone who registers on the Register page becomes a cashier. Admin and kitchen accounts are created by seed script or directly in the database.

## Roles and access

| Page | Admin | Cashier | Kitchen |
|---|---|---|---|
| Dashboard | Yes | No | No |
| POS | Yes | Yes | No |
| Floor plan | Yes | Yes | Yes |
| Kitchen display | Yes | Yes | Yes |
| Orders | Yes | Yes | No |
| Reservations | Yes | Yes | No |
| Category, Items, Addons, Coupons | Yes | No | No |
| Inventory | Yes (full) | View and adjust | View and adjust |
| Customers, Invoices, Payments | Yes | Yes | No |

The backend enforces these rules itself, so hiding a page in the frontend is never the only protection.

## How the system works

- **Prices come from the server.** The POS sends only item ids, quantities and addon option ids. Any price sent by the browser is ignored.
- **Tax** is 5% of the amount after the coupon discount.
- **Order status flow:** `NEW`, then `PREPARING`, then `READY`, then `SERVED`. An order can be cancelled before it is served, by admin or cashier only. Cancelling returns the coupon use and frees the table when it has no other open orders.
- **Orders, invoices and payments are never deleted.** They are cancelled or refunded, so the sales history stays correct.
- **Invoices:** one invoice per order. It becomes `PAID` when completed payments reach the total, and goes back to `PENDING` if a payment is refunded.
- **One-click payment:** `POST /api/payments/quick` creates the invoice if needed and pays the remaining balance as a completed payment.
- **Reservations:** a table must have enough seats and be free at that time. Seating a reservation marks the table occupied, and completing it marks the table as cleaning.
- **Inventory:** stock can never go below zero. Status is `OUT` at zero, `LOW` below the minimum, otherwise `ADEQUATE`.
- **Coupons** are checked for active status, expiry, minimum order and usage limit.

## API reference

All endpoints start with `/api` and (except login, register and health) need the header `Authorization: Bearer <token>`.

### Auth

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/auth/register` | Public | Create a cashier account |
| POST | `/auth/login` | Public | Get a token |
| GET | `/auth/me` | Any | Current user |

### Menu

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET, POST, PUT, DELETE | `/categories`, `/categories/:id` | Read: any. Write: admin | Categories |
| GET, POST, PUT, DELETE | `/items`, `/items/:id` | Read: any. Write: admin | Menu items. A new item needs an uploaded image. Filters: `categoryId`, `type`, `q`, `active` |
| GET, POST, PUT, DELETE | `/addons`, `/addons/:id` | Read: any. Write: admin | Addon groups with options |
| GET, POST, PUT, DELETE | `/coupons`, `/coupons/:id` | Read: any. Write: admin | Coupons |
| POST | `/coupons/validate` | Any | Check a code and get the discount |
| POST | `/uploads` | Admin | Upload an image (form field `image`) |

### Floor

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET, POST, PUT, DELETE | `/tables`, `/tables/:id` | Read: any. Write: admin | Tables. Filters: `area`, `status` |
| PATCH | `/tables/:id/status` | Admin, cashier | Change table status |
| GET, POST, PUT, DELETE | `/customers`, `/customers/:id` | Read: any. Write: admin, cashier. Delete: admin | Customers with order count and total spent |
| GET, POST, PUT, DELETE | `/reservations`, `/reservations/:id` | Read: any. Write: admin, cashier. Delete: admin | Reservations. Filters: `status`, `date`, `q` |
| PATCH | `/reservations/:id/status` | Admin, cashier | Change status (also updates the table) |

### Orders

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/orders/quote` | Admin, cashier | Price check, saves nothing |
| POST | `/orders` | Admin, cashier | Place an order |
| GET | `/orders`, `/orders/:id` | Any | List (`status`, `type`, `date`, `tableId`, `page`, `limit`) and detail |
| PATCH | `/orders/:id/status` | Any (cancel: admin, cashier) | Move an order forward or cancel it |

### Billing

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST, GET | `/invoices`, `/invoices/:id` | Admin, cashier | Create from an order, list, detail |
| POST | `/invoices/:id/cancel` | Admin | Cancel an unpaid invoice |
| POST, GET | `/payments`, `/payments/:id` | Admin, cashier | Record and list payments |
| POST | `/payments/quick` | Admin, cashier | One-click payment for an order |
| PATCH | `/payments/:id/status` | Admin, cashier (refund: admin) | Complete, fail or refund a payment |

### Inventory and dashboard

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/inventory` | Any | All items with status and stat counts |
| GET | `/inventory/alerts` | Any | Low and out-of-stock items |
| POST, PUT, DELETE | `/inventory`, `/inventory/:id` | Admin | Manage items |
| PATCH | `/inventory/:id/adjust` | Any | Add or use stock with `{ "delta": 5 }` |
| GET | `/dashboard?days=7` | Admin | All dashboard numbers (`days` from 1 to 90) |

### Errors

Errors always look like `{ "error": "message" }`. Common codes: 400 invalid input, 401 not logged in, 403 not allowed, 404 not found, 409 duplicate or record in use.

## Real-time events

The frontend connects to the backend with Socket.IO and its login token (`auth: { token }`). A connection without a valid token is refused. Events are sent only after the change is saved.

| Event | Data | Sent when |
|---|---|---|
| `order:created` | Full order | An order is placed |
| `order:updated` | Full order | An order status changes |
| `table:changed` | `{ id }` | A table status changes |
| `inventory:updated` | Inventory item | An item is created, edited or adjusted |
| `inventory:deleted` | `{ id }` | An item is deleted |

To watch events in a terminal while testing:

```bash
cd backend
node scripts/listen.js
```

## Image uploads

- Only the admin can upload. Allowed types are JPG, PNG and WEBP, up to 3 MB.
- Files are saved in `backend/uploads` with random names and served from `/uploads/<name>`.
- The API returns a path like `/uploads/ab12cd.jpg`. Save that as the item's `imageUrl`. The frontend adds the server address when it shows the image.
- The `uploads` folder is not in git. Back it up together with the database.

## Troubleshooting

| Problem | Likely cause and fix |
|---|---|
| `P1001: Can't reach database server` | PostgreSQL is not running, or the port in `DATABASE_URL` is wrong |
| `P1000: Authentication failed` | Wrong database password in `backend/.env` |
| `secretOrPrivateKey must have a value` | `JWT_SECRET` is missing in `backend/.env`. Restart the backend after editing `.env` |
| Login returns "Something went wrong on the server" | The real error is printed in the backend terminal |
| "Cannot reach the server" in the frontend | The backend is not running, or `NEXT_PUBLIC_API_URL` is wrong. Restart the frontend after editing `.env.local` |
| CORS error in the browser console | The frontend must run on exactly `http://localhost:3000`, or change `origin` in `backend/src/server.js` and `backend/src/realtime.js` |
| `Unknown argument` or missing Prisma model | Run `npx prisma generate`, then restart the backend |
| Uploaded image does not show | The image address must start with the backend address, for example `http://localhost:4000/uploads/...` |

## Before deploying

- Change `JWT_SECRET` to a long random value, and keep `.env` out of git.
- Remove or change the demo accounts, and delete demo orders with `node prisma/seedSales.js --clear`.
- Set the CORS `origin` in `server.js` and `realtime.js` to your real frontend address, and serve everything over HTTPS.
- Run `npx prisma migrate deploy` (not `migrate dev`) on the production database.
- Add rate limiting and security headers, and set up regular database and `uploads` backups.
- Keep the file `.env.local` values in the hosting provider's environment settings instead.

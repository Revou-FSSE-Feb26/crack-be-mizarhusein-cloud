[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/EdN1T4tj)

# Saluna Backend

Backend API for Saluna Beach Club built with NestJS, Prisma, and PostgreSQL.

## Stack

- NestJS (Express platform)
- PostgreSQL via Prisma ORM
- JWT auth (Passport) with two roles: `ADMIN` and `CUSTOMER`
- Swagger / OpenAPI for API docs (importable into Postman)

## Getting started

1. Copy the env file and adjust if needed:
   ```
   cp .env.example .env
   ```
2. Start PostgreSQL (via Docker):
   ```
   docker compose up -d
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Run migrations (creates the `users`, `menus`, `reservations`, `orders`, and `order_items` tables):
   ```
   npx prisma migrate dev
   ```
5. Seed the database with mock data (menu catalog, sample reservations, and one admin user, see [Auth](#auth) below). **Local development only — the seed deletes all menus and reservations first.**
   ```
   npx prisma db seed
   ```
6. Start the dev server:
   ```
   npm run start:dev
   ```

The API listens on `http://localhost:4000` (or whatever `PORT` is set to in `.env`).

## Auth

Login/register issue a JWT (`Authorization: Bearer <token>`, 8h expiry, signed with `JWT_SECRET`). The token carries the user's `role`. Passwords are hashed with bcrypt, never stored or returned in plain text. Emails are trimmed and lower-cased, so login is case-insensitive.

| Method | Path            | Auth   | Description                              |
| ------ | --------------- | ------ | ----------------------------------------- |
| POST   | /auth/register  | Public | Create a **customer** account, returns `{ access_token, user }`. No email verification, the account can log in immediately. |
| POST   | /auth/login     | Public | Returns `{ access_token, user }` (`user.role` is `ADMIN` or `CUSTOMER`) |

### Roles

| Role       | How you get it | What it can do |
| ---------- | -------------- | -------------- |
| `CUSTOMER` | Sign up via `POST /auth/register` (the only role public sign-up can create; sending a `role` field is rejected with 400) | Book a table, view and cancel **their own** reservations |
| `ADMIN`    | Created with `npm run create-admin` (or the seed, locally) | Everything a customer can, plus manage the menu and see/update/cancel **all** reservations |

Routes are protected with the `@Auth(...roles)` decorator (`src/auth/roles.decorator.ts`): `@Auth()` means "any logged-in user", `@Auth(Role.ADMIN)` means admin only. A missing/invalid token gets `401`; a valid token with the wrong role gets `403`.

### Creating an admin

`create-admin` creates the admin or resets its password/role, and **never touches menus or reservations**, so it is safe to run against production:

```
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-strong-password' npm run create-admin
```

For a hosted database, run it against that database with the platform's env injected, e.g. `railway run npm run create-admin` (with `ADMIN_EMAIL` / `ADMIN_PASSWORD` set in your shell).

The local seed also creates an admin (`admin1@gmail.com` / `admin098`). That password is public in this repo, so **never use it in production**; create your own admin instead.

`saluna-frontend` calls this API directly for login/register — `saluna-frontend`'s `ADMIN_SESSION_SECRET` env var must be set to the **same value** as this app's `JWT_SECRET`, since the frontend only verifies the JWT this backend signs.

## API docs / Postman

Swagger UI: `http://localhost:4000/api-docs`

OpenAPI JSON (import this into Postman as a collection): `http://localhost:4000/api-docs-json`

**Ready-made Postman collection**: `postman/Saluna-Backend-API.postman_collection.json` — covers Auth (login/register, including the 401/409/400 negative cases and a check that a role can't be self-assigned), Menu (public reads, admin-only writes, and a 403 for customers), Reservation (login-required booking, customer "my reservations"/cancel, admin list/update/cancel, and 401/403 negative cases), Order (guest ordering with server-side pricing, admin list/status changes, and 400/401/403 cases), and Dashboard Stats. Import it into Postman and run the whole collection top-to-bottom (Collection Runner, or the ▶ button) — it logs in as the seeded admin and registers a throwaway customer automatically, chains the created menu/reservation ids into the later requests via collection variables, and asserts the expected status code + response shape on every request. It expects the seeded admin, so run `npx prisma db seed` on your local database first. Also runnable headlessly with [Newman](https://www.npmjs.com/package/newman):
```
npx newman run postman/Saluna-Backend-API.postman_collection.json
```

## Endpoints

### Menus

| Method | Path          | Auth        | Description                          |
| ------ | ------------- | ----------- | ------------------------------------- |
| GET    | /menus        | Public      | List menu items (optional `?category=`) |
| GET    | /menus/:id    | Public      | Get one menu item                    |
| POST   | /menus        | Admin       | Create a menu item                   |
| PUT    | /menus/:id    | Admin       | Replace a menu item                  |
| PATCH  | /menus/:id    | Admin       | Partially update a menu item         |
| DELETE | /menus/:id    | Admin       | Delete a menu item                   |

### Reservations

| Method | Path                    | Auth            | Description                                            |
| ------ | ----------------------- | --------------- | ------------------------------------------------------- |
| POST   | /reservations           | Any logged-in user | Create a reservation, linked to the caller's account |
| GET    | /reservations/me        | Any logged-in user | The caller's own reservations                         |
| DELETE | /reservations/me/:id    | Any logged-in user | Cancel one of the caller's own `PENDING`/`CONFIRMED` reservations (someone else's id returns 404) |
| GET    | /reservations           | Admin           | List all reservations (optional `?status=`)             |
| GET    | /reservations/:id       | Admin           | Get one reservation                                      |
| PATCH  | /reservations/:id       | Admin           | Partially update a reservation (including `status`)      |
| DELETE | /reservations/:id       | Admin           | Cancel a reservation (sets `status = CANCELLED`, does not delete the row) |

Booking requires an account (customers must register/log in first). The full reservation list and menu writes are admin-only because reservations carry customer PII (name/email/phone) and menu changes should only come from the admin dashboard. Get a token from `POST /auth/login` first.

### Orders

Orders come from the digital menu on the website. Guests can order without an account, so `POST /orders` is public. The request contains only menu ids and quantities: **the server looks up each price and computes the subtotal, 10% tax and total itself**, so a client can't underpay by editing the request (a `price` field is rejected). Each order line keeps a snapshot of the item's name and price, so history stays correct if the menu changes later.

| Method | Path                    | Auth   | Description                                            |
| ------ | ----------------------- | ------ | ------------------------------------------------------- |
| POST   | /orders                 | Public | Place an order: `{ customerName?, tableNumber?, notes?, items: [{ menuId, quantity, notes? }] }` (1-50 lines, quantity 1-50). Returns the stored order with its `id`. |
| GET    | /orders                 | Admin  | List orders, newest first, with their items (optional `?status=`) |
| GET    | /orders/:id             | Admin  | Get one order                                           |
| PATCH  | /orders/:id/status      | Admin  | Move an order along `PENDING` → `PREPARING` → `SERVED` → `COMPLETED`, or set `CANCELLED`. Completed/cancelled orders can't be changed any more. |

### Admin dashboard stats

| Method | Path          | Auth  | Description |
| ------ | ------------- | ----- | ----------- |
| GET    | /admin/stats  | Admin | Live numbers for the dashboard: today's reservations and guests, upcoming (next 7 days) and pending reservations, menu item count, today's order count and revenue (excluding cancelled), active orders, plus the 5 most recent reservations and orders |

"Today" is computed for the venue's timezone, not UTC. It defaults to WITA (UTC+8); set `APP_UTC_OFFSET_HOURS` (e.g. `7` for WIB) to change it.

## Deploying (Railway + Supabase)

Database is hosted on **Supabase** (Postgres, via its pooler endpoints — the direct `db.<ref>.supabase.co:5432` host is IPv6-only and unreachable from some networks), API compute on **Railway**. `railway.json` tells Railway to run `npm run start:prod`, which applies pending Prisma migrations (`prisma migrate deploy`) before starting the server — no manual migration step needed after each deploy.

1. In Supabase: Project Settings → Database → **Connect** → **ORM** tab → **Prisma** — copy both `DATABASE_URL` (transaction pooler, port 6543, `?pgbouncer=true`) and `DIRECT_URL` (session pooler, port 5432). Percent-encode any `@`/`%` in your DB password (`@` → `%40`, `%` → `%25`).
2. On Railway: New Project → Deploy from GitHub repo → this repo.
   - Add env vars from step 1 (`DATABASE_URL`, `DIRECT_URL`) plus `JWT_SECRET` (any long random string — must match `saluna-frontend`'s `ADMIN_SESSION_SECRET` exactly, see [Auth](#auth)).
   - No Postgres plugin needed on Railway — the database lives on Supabase, not Railway.
   - If pushes to GitHub don't trigger a deploy (the Railway GitHub app needs access to the repo/organization), deploy from your machine with `railway up` inside this folder.
3. After the first deploy, create the admin user once (run locally with the production env injected, see [Creating an admin](#creating-an-admin)):
   ```
   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-strong-password' railway run npm run create-admin
   ```
   **Do not run `prisma db seed` against production.** It deletes every menu item and reservation before re-creating the sample data, which would wipe real customer bookings. The menu catalog can be managed from the admin dashboard.

Migrations that change existing data are applied automatically on deploy. `20260919135916_add_roles_and_reservation_owner` adds the `role` column and promotes every account that existed at that point to `ADMIN` (before it, all accounts were admins).

## Testing

```
npm run test:e2e
```

Runs integration tests against a real running database (whatever `DATABASE_URL` points to) — auth (register creates customers, role can't be self-assigned, login/duplicate-email/bad-credentials), menu CRUD (public reads, admin-only writes, 403 for customers), the reservation flow (login required, ownership of "my reservations", customer vs admin permissions, cancelling), and orders + dashboard stats (server-side pricing, admin-only access, status flow, price snapshots). Each spec creates its own throwaway test users/records and cleans them up in `afterAll`; the seeded catalog/admin from `prisma db seed` is untouched. Requires a seeded local database (the menu spec expects the seeded catalog).

## Notes

- Menu seed data mirrors `saluna-frontend/server/data/menuData.ts` so both apps start from the same catalog.
- **This backend is wired to `saluna-frontend`**: the frontend's `/api/menu`, `/api/reservation`, `/api/auth/*` routes and its admin menu/reservation pages all proxy to this API instead of using static mock data. The frontend stores the returned JWT as an httpOnly cookie — see [Auth](#auth).

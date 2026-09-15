[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/EdN1T4tj)

# Saluna Backend

Backend API for Saluna Beach Club built with NestJS, Prisma, and PostgreSQL.

## Stack

- NestJS (Express platform)
- PostgreSQL via Prisma ORM
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
4. Run migrations (creates the `users`, `menus`, and `reservations` tables):
   ```
   npx prisma migrate dev
   ```
5. Seed the database with mock data (includes one admin user, see [Auth](#auth) below):
   ```
   npx prisma db seed
   ```
6. Start the dev server:
   ```
   npm run start:dev
   ```

The API listens on `http://localhost:4000` (or whatever `PORT` is set to in `.env`).

## Auth

Login/register issue a JWT (`Authorization: Bearer <token>`, 8h expiry, signed with `JWT_SECRET`). Passwords are hashed with bcrypt, never stored or returned in plain text.

| Method | Path            | Auth   | Description                              |
| ------ | --------------- | ------ | ----------------------------------------- |
| POST   | /auth/register  | Public | Create a user, returns `{ access_token, user }` |
| POST   | /auth/login     | Public | Returns `{ access_token, user }` |

The seed script creates one admin user (`admin1@gmail.com` / `admin098` — the same credentials the admin dashboard already used before this backend had real auth). Change it by registering a new user and updating who the frontend's admin dashboard expects to log in as.

`saluna-frontend`'s admin login page and dashboard call this API directly — `saluna-frontend`'s `ADMIN_SESSION_SECRET` env var must be set to the **same value** as this app's `JWT_SECRET`, since the frontend only verifies the JWT this backend signs.

## API docs / Postman

Swagger UI: `http://localhost:4000/api-docs`

OpenAPI JSON (import this into Postman as a collection): `http://localhost:4000/api-docs-json`

**Ready-made Postman collection**: `postman/Saluna-Backend-API.postman_collection.json` — covers Auth (login/register, including the 401/409/400 negative cases), Menu (public reads + JWT-gated writes), and Reservation (public create + JWT-gated list/update/cancel). Import it into Postman and run the whole collection top-to-bottom (Collection Runner, or the ▶ button) — it logs in as the seeded admin automatically, chains the created menu/reservation ids into the later requests via collection variables, and asserts the expected status code + response shape on every request. Also runnable headlessly with [Newman](https://www.npmjs.com/package/newman):
```
npx newman run postman/Saluna-Backend-API.postman_collection.json
```

## Endpoints

### Menus

| Method | Path          | Auth        | Description                          |
| ------ | ------------- | ----------- | ------------------------------------- |
| GET    | /menus        | Public      | List menu items (optional `?category=`) |
| GET    | /menus/:id    | Public      | Get one menu item                    |
| POST   | /menus        | Bearer JWT  | Create a menu item                   |
| PUT    | /menus/:id    | Bearer JWT  | Replace a menu item                  |
| PATCH  | /menus/:id    | Bearer JWT  | Partially update a menu item         |
| DELETE | /menus/:id    | Bearer JWT  | Delete a menu item                   |

### Reservations

| Method | Path                | Auth        | Description                                            |
| ------ | ------------------- | ----------- | ------------------------------------------------------- |
| POST   | /reservations       | Public      | Create a reservation (customers book without logging in) |
| GET    | /reservations       | Bearer JWT  | List reservations (optional `?status=`)                 |
| GET    | /reservations/:id   | Bearer JWT  | Get one reservation                                      |
| PATCH  | /reservations/:id   | Bearer JWT  | Partially update a reservation (including `status`)      |
| DELETE | /reservations/:id   | Bearer JWT  | Cancel a reservation (sets `status = CANCELLED`, does not delete the row) |

Menu/reservation writes and reservation reads are admin-only because reservations carry customer PII (name/email/phone) and menu writes should only come from the admin dashboard. Get a token from `POST /auth/login` first.

## Deploying (Railway + Supabase)

Database is hosted on **Supabase** (Postgres, via its pooler endpoints — the direct `db.<ref>.supabase.co:5432` host is IPv6-only and unreachable from some networks), API compute on **Railway**. `railway.json` tells Railway to run `npm run start:prod`, which applies pending Prisma migrations (`prisma migrate deploy`) before starting the server — no manual migration step needed after each deploy.

1. In Supabase: Project Settings → Database → **Connect** → **ORM** tab → **Prisma** — copy both `DATABASE_URL` (transaction pooler, port 6543, `?pgbouncer=true`) and `DIRECT_URL` (session pooler, port 5432). Percent-encode any `@`/`%` in your DB password (`@` → `%40`, `%` → `%25`).
2. On Railway: New Project → Deploy from GitHub repo → this repo.
   - Add env vars from step 1 (`DATABASE_URL`, `DIRECT_URL`) plus `JWT_SECRET` (any long random string — must match `saluna-frontend`'s `ADMIN_SESSION_SECRET` exactly, see [Auth](#auth)).
   - No Postgres plugin needed on Railway — the database lives on Supabase, not Railway.
3. After the first deploy, seed the real menu catalog + admin user once (run locally, pointed at Supabase):
   ```
   DATABASE_URL="<supabase-pooler-url>" DIRECT_URL="<supabase-direct-pooler-url>" npx prisma db seed
   ```

## Testing

```
npm run test:e2e
```

Runs integration tests against a real running database (whatever `DATABASE_URL` points to) — auth (register/login/duplicate-email/bad-credentials), menu CRUD (public reads, JWT-gated writes), and reservation flow (public create, JWT-gated list/update/cancel). Each spec creates its own throwaway test user/records and cleans them up in `afterAll`; the seeded catalog/admin from `prisma db seed` is untouched.

## Notes

- Menu seed data mirrors `saluna-frontend/server/data/menuData.ts` so both apps start from the same catalog.
- **This backend is now wired to `saluna-frontend`**: the frontend's public `/api/menu`/`/api/reservation` routes and its admin menu/reservation pages both proxy to this API instead of using static mock data. The admin login page also calls `POST /auth/login` here directly (via a frontend proxy route) and stores the returned JWT as an httpOnly cookie — see [Auth](#auth).

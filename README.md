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
4. Run migrations (creates the `menus` and `reservations` tables):
   ```
   npx prisma migrate dev
   ```
5. Seed the database with mock data:
   ```
   npx prisma db seed
   ```
6. Start the dev server:
   ```
   npm run start:dev
   ```

The API listens on `http://localhost:4000` (or whatever `PORT` is set to in `.env`).

## API docs / Postman

Swagger UI: `http://localhost:4000/api-docs`

OpenAPI JSON (import this into Postman as a collection): `http://localhost:4000/api-docs-json`

## Endpoints

### Menus

| Method | Path          | Description                          |
| ------ | ------------- | ------------------------------------- |
| POST   | /menus        | Create a menu item                   |
| GET    | /menus        | List menu items (optional `?category=`) |
| GET    | /menus/:id    | Get one menu item                    |
| PUT    | /menus/:id    | Replace a menu item                  |
| PATCH  | /menus/:id    | Partially update a menu item         |
| DELETE | /menus/:id    | Delete a menu item                   |

### Reservations

| Method | Path                | Description                                            |
| ------ | ------------------- | ------------------------------------------------------- |
| POST   | /reservations       | Create a reservation                                    |
| GET    | /reservations       | List reservations (optional `?status=`)                 |
| GET    | /reservations/:id   | Get one reservation                                      |
| PATCH  | /reservations/:id   | Partially update a reservation (including `status`)      |
| DELETE | /reservations/:id   | Cancel a reservation (sets `status = CANCELLED`, does not delete the row) |

## Deploying (Render + Supabase)

Database is hosted on **Supabase** (Postgres), API on **Render** (Node web service). `npm run start:prod` already runs `prisma migrate deploy` before `node dist/main`, so migrations apply automatically on every deploy — no manual step needed.

1. Create a Supabase project, then grab the **direct connection** string from Project Settings → Database → Connection string (URI). Use this as `DATABASE_URL`.
2. On Render: New → Web Service → connect this repo.
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start:prod`
   - Environment variable: `DATABASE_URL` = the Supabase connection string above.
   - Do **not** set `PORT` manually — Render injects its own and `main.ts` already reads `process.env.PORT`.
3. Seed the real menu catalog once, run locally against Supabase:
   ```
   DATABASE_URL="<supabase-connection-string>" npx prisma db seed
   ```

## Notes

- Menu seed data mirrors `saluna-frontend/server/data/menuData.ts` so both apps start from the same catalog.
- **This backend is now wired to `saluna-frontend`**: the frontend's public `/api/menu` route and its admin menu CRUD pages both proxy to this API instead of using static mock data.

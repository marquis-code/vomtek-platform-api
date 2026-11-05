# LineSight API

NestJS 11 + MongoDB core platform API.

## Run
```bash
pnpm install
cp .env.example .env
pnpm build
pnpm start
```
API: http://localhost:4110/api · Swagger: `/api/docs`.

MongoDB must be available on `MONGODB_URI` (default
`mongodb://127.0.0.1:27019/linesight`). With `SEED_ON_BOOT=true`, an empty
database is seeded automatically.

## Modules
- Auth/JWT + roles
- Public catalog, plans, configurator, leads
- Portal: assets, inspections, reports, orders, rentals, subscription, jobs,
  bids, escrow
- Admin: metrics, accounts, orders, rentals, reports, jobs, catalog,
  subscriptions, partners, leads
- Engine client with deterministic fallback

## Environment
See `.env.example`. Seed accounts:
`demo@linesight.io`, `utility@linesight.io`, `homeowner@linesight.io`,
`contractor@linesight.io` (password `LineSightDemo!2026`);
`ops@linesight.io` / `LineSightOps!2026`.

## Revenue
Orders store an 8% commission; subscriptions store annual value; rentals store
deposit + subtotal. Studio aggregates these for the dashboard.

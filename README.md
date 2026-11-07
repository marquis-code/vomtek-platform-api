# Vomtek API

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
`mongodb://127.0.0.1:27019/vomtek_platform`). With `SEED_ON_BOOT=true`, an empty
database is seeded automatically.

## Modules
- Auth/JWT + roles, registration and password reset
- Public catalog, plans, configurator, leads, partner applications
- Portal: assets, CSV upload, reports/comparison/PDF, orders, invoices/payments,
  rentals/pickup/return, subscription, jobs, bids, escrow, contractor profiles
  and work orders, notifications, manufacturer catalog
- Admin: metrics, accounts, orders, invoices/refunds, rentals, reports, jobs,
  work-order verification, catalog, subscriptions, partners, contractors, users,
  leads, audit and settings
- Engine client with deterministic fallback
- PDFKit report/invoice generation and local upload storage

## Environment
See `.env.example`. Seed accounts:
`demo@vomtek.com`, `utility@vomtek.com`, `homeowner@vomtek.com`,
`contractor@vomtek.com` (password `VomtekDemo!2026`);
`ops@vomtek.com` / `VomtekOps!2026`.

## Revenue
Orders store an 8% commission; subscriptions store annual value; rentals store
deposit + subtotal. Studio aggregates these for the dashboard.

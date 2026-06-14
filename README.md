# Inventory Intelligence Dashboard

Next.js 14 App Router dashboard for the Inventory Intelligence Pilot. Reads from an existing Supabase project populated by the ingestion API.

## Getting started

1. Copy environment variables:

```bash
cp .env.local.example .env.local
```

2. Fill in `.env.local` with your Supabase project credentials.

3. Create the first auth user (see `supabase/seed-auth.sql` for documented steps).

4. Install dependencies and run the dev server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tenant scoping

All data queries must filter by `TENANT_ID` from `lib/tenant.ts`. The pilot default is `tropical-battery`.

## Routes

| Route | Description |
| --- | --- |
| `/login` | Email/password sign in |
| `/dashboard` | Dashboard (placeholder) |
| `/inventory` | Inventory (placeholder) |
| `/reorder` | Reorder recommendations (placeholder) |
| `/purchase-orders` | Purchase orders (placeholder) |
| `/reference-data` | Reference data (placeholder) |
| `/connector-health` | Connector health (placeholder) |

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Production build
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

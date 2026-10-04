# Baseer — Multi-tenant Wholesale Clothing Management

A SaaS foundation for wholesale clothing merchants built with **Next.js 16 (App Router)**, **MongoDB/Mongoose**, and **Tailwind CSS 4**.

## Architecture

### Tenancy model
- **Single deployment, shared database, tenant-scoped collections.** Every merchant-owned record carries a `tenantId` (all future business modules must follow this).
- Shops live at `/<slug>/...` (e.g. `/baseer/dashboard`, `/ahmad/dashboard`). One shared codebase serves all tenants — no code duplication.
- **Tenant identity always comes from the signed session token** (`lib/session.ts`), never from the URL, query params, or request bodies. The slug in the URL is only checked *against* the session.
- `proxy.ts` (Next 16's replacement for `middleware.ts`) enforces route guards at the edge; `lib/auth.ts` re-verifies user/tenant status against the database on every request.

### Roles
| Role | Area | Access |
|---|---|---|
| `super_admin` | `/admin` | Manage all shops: create, edit, activate/deactivate, reset credentials |
| `merchant_admin` | `/<slug>/dashboard` | Only their own shop |

### Key directories
```
lib/
  mongodb.ts              Cached Mongoose connection
  constants.ts            Shared constants (currencies, roles, slugs)
  validation.ts           Validation + slugify (shared client/server-safe)
  session.ts              JWT session (jose, httpOnly cookie, server-only)
  auth.ts                 Guards: requireSuperAdmin, requireMerchantAdmin
  models/                 Tenant (shop) + User models
  services/
    auth.service.ts       Credential verification, session payloads
    tenant.service.ts     Shop CRUD (super admin only, called from actions)
    tenant-query.service.ts  Tenant-scoped query pattern for future modules
app/
  actions/                Server Actions (auth, tenant management)
  [slug]/                 Tenant space: dashboard, settings, per-shop login
  admin/                  Super admin: shops list, create, edit, reset credentials
  _components/            Reusable UI (forms, badges, language switcher)
lib/i18n/                 Dictionaries (en, fa-AF, ps), RTL config, formatters
```

## Environment

Copy `.env.example` to `.env.local` and fill in:

- `MONGODB_URI` — MongoDB connection string
- `AUTH_SECRET` — random 32+ char secret for signing sessions (`openssl rand -base64 32`)

## Seeding the Super Admin

```bash
npm run db:seed
```

Creates/updates the super admin from `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` (defaults `admin@baseer.com` / `SuperAdmin@123`). **Change these in production.**

## Running

```bash
npm run dev        # http://localhost:3000
npm run build      # production build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```

## Routes

| Route | Description |
|---|---|
| `/` | Public shop directory |
| `/super-login` | Super admin login |
| `/admin` | Super admin dashboard (shop list + actions) |
| `/admin/shops/new` | Create shop |
| `/admin/shops/[id]` | Edit shop + reset admin credentials |
| `/login` | Generic merchant login |
| `/<slug>/login` | Per-shop login |
| `/<slug>/dashboard` | Merchant dashboard (tenant-scoped) |
| `/<slug>/settings` | Shop settings (read-only for merchants) |

## Internationalization

- **Languages:** English (`en`, LTR), Dari (`fa-AF`, RTL), Pashto (`ps`, RTL)
- Switch languages from the UI (header dropdown); stored in the `ws_locale` cookie
- All UI text comes from `lib/i18n/dictionaries/*.json` — never hardcode strings
- Add a language by adding a JSON dictionary + entry in `lib/i18n/config.ts` and `LOCALES` in `lib/constants.ts`
- RTL is applied via `<html dir>`; layouts use CSS logical properties (no left/right hacks)
- `formatCurrency(amount, currency)` displays money in its **original currency** — no automatic conversion

## Currency

- Supported: **AFN**, **USD** (see `lib/constants.ts`)
- Transactions store `amount` + `currency` together and always display the original currency
- Reports can group AFN and USD separately — no implicit FX conversion

## Adding business modules later

Every future merchant-facing query must be tenant-scoped, with `tenantId` taken from the session:

```ts
// e.g. lib/services/invoice.service.ts
export async function listInvoices({ tenantId }: TenantScope) {
  await connectToDatabase();
  return InvoiceModel.find({ tenantId }).sort({ createdAt: -1 });
}
```

Pages/actions obtain `tenantId` via `requireMerchantAdmin()` — there is no code path where a client-supplied tenant id is trusted.

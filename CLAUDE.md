# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cajú is a supplier payment management app for Uruguayan businesses. It handles invoice upload, AI-powered data extraction (Claude Vision API + tool use), supplier management, payment scheduling, Itaú bank payment file generation, and multi-year cash flow projection. The UI is in Spanish (rioplatense). Auth is **Google OAuth via Supabase** (`LoginScreen` in `page.js`) — no email/password flow.

## Commands

- `npm run dev` — Start development server (Next.js + Turbopack)
- `npm run build` — Production build
- `npm run lint` — Run ESLint
- No test framework is configured

## Tech Stack

- **Framework**: Next.js 16 (App Router) with React 19, JavaScript (no TypeScript)
- **Styling**: Tailwind CSS v3 with inline styles used extensively in components
- **Database**: Supabase (PostgreSQL with RLS). Base schema in `database/schema.sql`, incremental changes in `supabase/migrations/`
- **AI**: Anthropic Claude API (`@anthropic-ai/sdk`) for invoice OCR/extraction
- **Bank Integration**: Itaú Link Empresa payment file generation (`src/lib/itau-format.js`)
- **Excel**: two paths — `exceljs` (npm dep, used by `RecurringView` for the recurring-expenses template) and SheetJS loaded from CDN at runtime (`Payables.js`, payment-list export). This duplication is known tech debt.
- **Charts**: recharts (Cashflow module)
- **Icons**: lucide-react
- **Deployment**: Vercel

## Architecture

The app is a **single-page, module-based SPA**. There is no routing beyond `/`. `page.js` renders a `ModuleLauncher` that switches between two top-level modules, and within a module, view switching is plain state (`view` + `selectedId`), not URL routes.

- **`pagos`** (Gestión de Pagos) — invoices, suppliers, payables, recurring expenses. This is the original core.
- **`cashflow`** — multi-year financial projection tool, largely self-contained.

### Orchestrator: `src/app/page.js`
Holds auth, all global state (invoices, suppliers, recurring, categories, notifications), data fetching (`fetchData()`), and navigation. It creates its **own** Supabase browser client inline via a lazy singleton `getSupabase()` (does **not** use `src/lib/supabase-browser.js`). Child components receive state and the `supabase` client via props. Categories are persisted to `localStorage` (`caju_categories`).

### Pagos components (`src/components/`)
`Dashboard`, `Inbox`, `InvoiceDetail`, `Payables`, `RecurringView`, `Suppliers`, `SupplierDetail`, `DocPreview`, `Notifications`, and `SharedUI` (reusable primitives: Badge, DueBadge, Card, Btn, Input, Select, Progress, Pagination, ConfBadge, ExtractionChecklist, `PAGE_SIZE`).

### Cashflow module
- `components/CashflowView.js` — the UI (largest component in the repo). Persists projects to Supabase via `/api/cashflow` as a single JSONB blob.
- `lib/cashflow-engine.js` — pure projection engine: loan amortization (PMT with grace periods), inflation compounding, payment-term timing. No I/O.
- `lib/cashflow-types.js` — default shapes/constants (e.g. `DEFAULT_PAYMENT_TERMS`).
- `lib/cashflow-i18n.js` — en/es string tables. `lib/cashflow-format.js` — month labels / number formatting. `lib/sample-data.js` — `SAMPLE_PROJECT` seed inserted on first use.

### API Routes (`src/app/api/`)
All routes require `Authorization: Bearer <access_token>`; the frontend gets the token from `supabase.auth.getSession()`. The standard pattern: validate the token with a **service-role** client (`service.auth.getUser(token)`), then run all data queries through a **user-scoped** client (`createUserClient(token)`) so RLS applies.

- `invoices/route.js` — POST invoice upload. File validation (PDF/JPG/PNG/WebP, 10MB max), SHA-256 dedup, extraction via `extractInvoiceData()`, Uruguayan amount parsing, date correction, auto-creation of suppliers by RUT, insert. Service role used **only** for storage uploads.
- `invoices/re-extract/route.js` — POST re-run extraction on an existing invoice's stored document; updates fields + confidence.
- `cashflow/route.js` — GET/POST/PUT/DELETE CRUD for `cashflow_projects` (JSONB `data` column).
- `recurring-instances/route.js` — GET/POST/PATCH monthly checklist instances. POST supports a `batch` mode that materializes instances for all active recurring expenses in a period.
- `suppliers/dedup/route.js` — GET previews fuzzy-duplicate supplier groups (dry run), POST merges them. Uses `normalizeName()` to strip legal suffixes (S.A., SRL, etc.) and accents.

### Shared library (`src/lib/`)
- `utils.js` — **single source of truth** for shared constants/helpers: `STATUSES` (label/color/bg/icon), `BANK_CODES`, `fmt()`, `fmtDate()`, `fmtDateFull()`, `daysUntil()`. Imported by `page.js` and `itau-format.js`. Do not redefine these elsewhere.
- `extract.js` — **the** extraction module, used by both invoice routes. Claude Vision + **tool use** (`extract_invoice_data` tool) for structured output, with retry and validation. Handles both `invoice` and `payroll` document types. (Older docs called this file unused — that is no longer true.)
- `itau-format.js` — fixed-width Itaú payment files. Two formats: Classic (97 positions, intra-Itaú) and Inter-bank (165 positions). Used by `Payables.js`.
- `supabase-server.js` — `createServiceClient()` (service role, bypasses RLS) and `createUserClient(accessToken)` (anon key + user JWT, RLS-scoped).
- `supabase-browser.js` — `@supabase/ssr` browser client. **Not currently used** (`page.js` rolls its own inline).

### Database & RLS
Tables: `invoices`, `suppliers`, `invoice_items`, `invoice_events`, `recurring_expenses`, `recurring_instances`, `cashflow_projects`, `bank_transactions`, `profiles`.

**Multi-tenancy is enforced by RLS `user_id = auth.uid()`.** `suppliers`, `invoices`, `recurring_expenses`, `recurring_instances`, `cashflow_projects` carry a `user_id` column (DEFAULT `auth.uid()`). `invoice_items` / `invoice_events` inherit access through their parent invoice's `user_id`. `profiles` is scoped to `id = auth.uid()`.

**RLS is security-critical and has drifted before.** On 2026-07-09, `invoices`/`suppliers`/`recurring_expenses`/`invoice_events` were found readable by the anonymous role (a stale permissive policy had survived a migration; the anon key is public by design, so RLS is the only barrier). Fixed by `supabase/migrations/20260709_fix_rls_v2_bulletproof.sql`, which drops **all** policies on the data tables dynamically, then `ENABLE` + `FORCE ROW LEVEL SECURITY` and recreates only the user-scoped policies. **After any schema change, verify anon cannot read data tables** (query the REST API with only the anon key — every data table must return empty).

Other notes:
- Invoice status workflow: NEW → EXTRACTING → EXTRACTED → REVIEW_REQUIRED → APPROVED → SCHEDULED → PAID (plus DISPUTE, REJECTED, DUPLICATE). Defined in `STATUSES` (`utils.js`).
- Duplicate detection via a generated `duplicate_key` column (supplier RUT + invoice number + total + date).
- Triggers auto-log status changes to `invoice_events` and maintain `updated_at`.
- `bank_transactions` is currently **unused** by application code.
- Migrations live in `supabase/migrations/` and are applied by hand in the Supabase SQL editor (no CLI/automated migration runner is wired up). `20260309_backfill_user_id.sql` is a one-off with a hardcoded target user — do not re-run blindly.

### Environment Variables
See `.env.local.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `ITAU_DEBIT_ACCOUNT`, `ITAU_OFFICE_CODE`.

## Key Conventions

- **Serverless lazy-init**: API-route clients (Anthropic, Supabase service) must be lazy-initialized inside getter functions, never at module level — module-level init crashes silently on Vercel when env vars aren't present at import time.
- **Imports use the `@/...` alias** (jsconfig.json). Relative paths like `../../lib/` break on Vercel Turbopack builds.
- Currency uses Uruguayan locale (`es-UY`), default UYU. Dates get a `T12:00:00` suffix to avoid timezone drift.
- `parseAmount()` converts Uruguayan number format ("3.235,01" → 3235.01) and cross-fills subtotal/IVA (22%) when missing. The extraction tool prompt is tuned for e-factura/CFE/RUT.
- Bank codes map to Itaú's internal numbering (e.g. BROU = "1", Itaú = "113"); source in `BANK_CODES`.
- `updateInvoice()` uses optimistic updates with rollback on Supabase error.
- Notification timeouts: 2.5s success, 5s errors, 6s supplier auto-creation.
- `DocPreview` fetches Supabase **signed URLs** (storage bucket is private).
- `PAGE_SIZE = 25` shared across Inbox and Pagos; filtered lists are `useMemo`-sliced and pagination resets to page 1 on filter change.
- AI extraction UX: `ConfBadge` (green ≥90% / yellow ≥80% / red <80%), `ExtractionChecklist` summary strip; confidence <80% auto-opens edit mode with red-highlighted fields; failed uploads fall back to a manual-entry form (inserted with status REVIEW_REQUIRED).

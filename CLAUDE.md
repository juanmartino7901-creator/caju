# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Cajú is a supplier payment management app for Uruguayan businesses. It handles invoice upload, AI-powered data extraction (using Claude Vision API), supplier management, payment scheduling, and Itaú bank payment file generation. The UI is in Spanish (rioplatense).

## Commands

- `npm run dev` — Start development server (Next.js)
- `npm run build` — Production build
- `npm run lint` — Run ESLint
- No test framework is configured

## Tech Stack

- **Framework**: Next.js 16 (App Router) with React 19, JavaScript (no TypeScript)
- **Styling**: Tailwind CSS v3 with inline styles extensively used in components
- **Database**: Supabase (PostgreSQL with RLS). Schema in `database/schema.sql`
- **AI**: Anthropic Claude API (`@anthropic-ai/sdk`) for invoice OCR/extraction
- **Bank Integration**: Itaú Link Empresa payment file generation (`src/lib/itau-format.js`)
- **Excel**: SheetJS loaded dynamically from CDN for payment list exports
- **Icons**: lucide-react
- **Deployment**: Vercel

## Architecture

### Component architecture
`src/app/page.js` is the orchestrator: auth, global state, data fetching, navigation. Views are in `src/components/`:
- `SharedUI.js` — Reusable primitives: Badge, DueBadge, Card, Btn, Input, Select, Progress, Pagination, ConfBadge, ExtractionChecklist, PAGE_SIZE
- `Dashboard.js` — KPIs, monthly obligations, upcoming due dates
- `Inbox.js` — Invoice list, filters, pagination, upload, manual entry fallback
- `InvoiceDetail.js` — Invoice detail, edit form, actions, re-extract
- `Payables.js` — Payment queue, history by month, Excel/Itaú file generation
- `RecurringView.js` — Recurring expenses, category editor, form
- `Suppliers.js` — Supplier list, search, batch delete
- `SupplierDetail.js` — Supplier detail, edit, bank info, invoice list
- `DocPreview.js` — Document preview with Supabase signed URLs
- `Notifications.js` — Toast notification system

Components receive state via props from page.js. Components that need Supabase receive the `supabase` client as a prop. No routing beyond the root page — view switching via `nav(view, id)` state.

### API Routes
- `src/app/api/invoices/route.js` — POST endpoint for invoice upload. Requires `Authorization: Bearer <access_token>` header. Uses user-scoped Supabase client (RLS) for all data queries; service role only for storage uploads. Handles: file validation, SHA-256 dedup, Claude Vision extraction (max_tokens 4096), Uruguayan amount parsing, date correction, auto-creation of suppliers by RUT, invoice insertion. Clients are lazy-initialized (not module-level) to avoid serverless cold-start crashes.
- `src/app/api/invoices/re-extract/route.js` — POST endpoint for re-extracting data from an existing invoice's document. Downloads file from storage, sends to Claude Vision, updates invoice fields and confidence scores. Same lazy-init and amount parsing as upload route. Used by the "Re-extraer" button in invoice detail.

### Library modules (`src/lib/`)
- `utils.js` — **Single source of truth** for shared constants and helpers: `STATUSES` (with label, color, bg, icon), `BANK_CODES`, `fmt()`, `fmtDate()` (short), `fmtDateFull()` (with year), `daysUntil()`. Both `page.js` and `itau-format.js` import from here.
- `itau-format.js` — Generates Itaú bank-compatible fixed-width payment files. Two formats: Classic (97 positions, intra-Itaú) and Inter-bank (165 positions). Imports `BANK_CODES` from `utils.js`. Used by `Payables.js` via `generateItauPaymentFile()`.
- `supabase-server.js` — Two exported clients: `createServiceClient()` (service role, bypasses RLS — for storage/admin) and `createUserClient(accessToken)` (anon key + user JWT — for RLS-scoped queries).
- `supabase-browser.js` — Browser client using `@supabase/ssr`'s `createBrowserClient`. **Note**: not currently used by `page.js`, which creates its own client inline.
- `extract.js` — Standalone extraction module with `extractInvoiceData()` and `matchSupplier()`. **Note**: not currently used by the API route, which has its own inline extraction.

### Database
- Main tables: `invoices`, `suppliers`, `invoice_items`, `invoice_events`, `recurring_expenses`, `bank_transactions`, `profiles`
- **Multi-tenancy**: `invoices`, `suppliers`, `recurring_expenses` have `user_id` column (DEFAULT `auth.uid()`). RLS policies enforce `user_id = auth.uid()` — each user only sees their own data. Migration: `supabase/migrations/20260309_add_user_id_multi_tenancy.sql`
- Invoice status workflow: NEW → EXTRACTING → EXTRACTED → REVIEW_REQUIRED → APPROVED → SCHEDULED → PAID (also DISPUTE, REJECTED, DUPLICATE)
- Duplicate detection via generated `duplicate_key` column (supplier RUT + invoice number + total + date)
- `invoice_items` and `invoice_events` inherit access through their parent invoice's `user_id`
- Triggers auto-log status changes to `invoice_events` and auto-update `updated_at`
- `profiles` table stores user role — fetched on auth to display in sidebar

### Environment Variables
See `.env.local.example`. Key vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `ITAU_DEBIT_ACCOUNT`, `ITAU_OFFICE_CODE`.

## Key Conventions

- Currency amounts use Uruguayan locale formatting (`es-UY`), default currency is UYU
- Dates are handled with `T12:00:00` suffix to avoid timezone issues
- The Claude extraction prompt is tuned for Uruguayan invoices (e-factura, CFE, RUT format). It instructs Claude to convert Uruguayan number format (dot=thousands, comma=decimal) to JSON numbers, sum line_items when no explicit total, and cross-calculate subtotal/IVA (22%)
- `parseAmount()` in both API routes handles string amounts with Uruguayan format ("3.235,01" → 3235.01) and provides fallback calculations for missing subtotal/tax
- Bank codes map to Itaú's internal numbering system (e.g., BROU = "1", Itaú = "113")
- All shared constants live in `utils.js` — do not redefine STATUSES, BANK_CODES, or helpers elsewhere
- `updateInvoice()` uses optimistic updates with rollback on Supabase errors
- Notifications use 2.5s timeout for success, 5s for errors, 6s for supplier auto-creation toasts
- Form validation: supplier requires name + RUT, recurring expense requires name + amount > 0
- DocPreview uses Supabase signed URLs directly (bucket is private)
- API routes require `Authorization: Bearer <token>` — frontend gets token via `supabase.auth.getSession()`
- Service role client is only for storage uploads; all data queries use user-scoped client with RLS
- **Serverless pattern**: API route clients (Anthropic, Supabase service) must be lazy-initialized inside getters, NOT at module level — module-level init crashes silently on Vercel if env vars aren't available at import time
- Imports must use `@/lib/...` alias (configured in jsconfig.json) — relative paths like `../../lib/` fail on Vercel Turbopack builds

### Pagination & Filters
- `PAGE_SIZE = 25` — shared constant for both Inbox and Pagos views
- `Pagination` component renders "Mostrando X-Y de Z" with Anterior/Siguiente buttons
- Inbox filters: status (pill buttons), text search (supplier/number/amount), advanced filters (supplier dropdown, date range). Page resets to 1 on filter change.
- Pagos filters: text search, supplier, date range, amount range (min/max). Same pagination pattern.
- Filtered list → paginated via `useMemo` slice. `paged` / `pagedPayable` are what gets rendered.

### AI Extraction UX
- `ConfBadge` — Confidence indicator with tooltip: green ✓ (≥90%), yellow ⚠ (≥80%), red ✗ (<80%)
- `ExtractionChecklist` — Quick summary strip: "Proveedor ✓ | Monto ✓ | Fecha ⚠ | RUT ✗"
- Low confidence (<80%) auto-opens edit mode in `InvDetail`, with red-highlighted fields
- "Re-extraer" button calls `/api/invoices/re-extract` then refreshes data via `fetchData()`
- Failed uploads show document preview + manual entry form (inserted directly into Supabase with status REVIEW_REQUIRED)

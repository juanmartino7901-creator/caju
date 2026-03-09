-- ============================================================
-- Migration: Add user_id for multi-tenancy
-- Adds user_id column to invoices, suppliers, recurring_expenses
-- Replaces old RLS policies with user_id-based isolation
-- ============================================================

-- ─── 1. Add user_id columns ─────────────────────────────────

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

ALTER TABLE public.recurring_expenses
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- ─── 2. Set default for new rows ────────────────────────────

ALTER TABLE public.invoices
  ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.suppliers
  ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.recurring_expenses
  ALTER COLUMN user_id SET DEFAULT auth.uid();

-- ─── 3. Create indexes ──────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_user_id ON recurring_expenses(user_id);

-- ─── 4. Drop old RLS policies ───────────────────────────────

DROP POLICY IF EXISTS "Suppliers viewable by authenticated" ON suppliers;
DROP POLICY IF EXISTS "Suppliers writable by admin/employee" ON suppliers;

DROP POLICY IF EXISTS "Invoices viewable by authenticated" ON invoices;
DROP POLICY IF EXISTS "Invoices insertable by admin/employee" ON invoices;
DROP POLICY IF EXISTS "Invoices updatable by admin" ON invoices;

DROP POLICY IF EXISTS "Invoice items viewable" ON invoice_items;
DROP POLICY IF EXISTS "Invoice items writable" ON invoice_items;

DROP POLICY IF EXISTS "Events viewable" ON invoice_events;
DROP POLICY IF EXISTS "Events writable" ON invoice_events;

DROP POLICY IF EXISTS "Recurring viewable" ON recurring_expenses;
DROP POLICY IF EXISTS "Recurring writable by admin" ON recurring_expenses;

-- ─── 5. Create new user_id-based RLS policies ───────────────

-- Suppliers: user can only see/manage their own
CREATE POLICY "Suppliers: user owns" ON suppliers
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Invoices: user can only see/manage their own
CREATE POLICY "Invoices: user owns" ON invoices
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Invoice items: user can access items for their own invoices
CREATE POLICY "Invoice items: user owns invoice" ON invoice_items
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM invoices WHERE invoices.id = invoice_items.invoice_id AND invoices.user_id = auth.uid()
  ));

-- Invoice events: user can access events for their own invoices
CREATE POLICY "Invoice events: user owns invoice" ON invoice_events
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM invoices WHERE invoices.id = invoice_events.invoice_id AND invoices.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM invoices WHERE invoices.id = invoice_events.invoice_id AND invoices.user_id = auth.uid()
  ));

-- Recurring expenses: user can only see/manage their own
CREATE POLICY "Recurring: user owns" ON recurring_expenses
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── 6. Make user_id NOT NULL after backfill ─────────────────
-- NOTE: Run the backfill script FIRST (assign_existing_data.sql),
-- then uncomment and run these:
--
-- ALTER TABLE public.invoices ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.suppliers ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.recurring_expenses ALTER COLUMN user_id SET NOT NULL;

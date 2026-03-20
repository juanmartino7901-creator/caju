-- ============================================================
-- Migration: Add recurring_instances table
-- Monthly checklist instances for recurring expenses
-- ============================================================

CREATE TABLE public.recurring_instances (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recurring_id    UUID NOT NULL REFERENCES public.recurring_expenses(id) ON DELETE CASCADE,
  period          TEXT NOT NULL,           -- format "2026-03"
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'invoice_linked', 'paid_manual')),
  invoice_id      UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  paid_date       DATE,
  paid_amount     NUMERIC(15,2),
  notes           TEXT,
  user_id         UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at      TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_recurring_period UNIQUE(recurring_id, period)
);

CREATE INDEX idx_recurring_instances_period ON recurring_instances(period);
CREATE INDEX idx_recurring_instances_user ON recurring_instances(user_id);
CREATE INDEX idx_recurring_instances_recurring ON recurring_instances(recurring_id);

-- ─── RLS ──────────────────────────────────────────────────
ALTER TABLE public.recurring_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurring_instances_select" ON recurring_instances
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "recurring_instances_insert" ON recurring_instances
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "recurring_instances_update" ON recurring_instances
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "recurring_instances_delete" ON recurring_instances
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================================
-- Fix RLS v2 (bulletproof) — 2026-07-09
-- La v1 no cerró invoices/suppliers/recurring_expenses/invoice_events.
-- Causa probable: quedó una policy permisiva con un nombre que no
-- previmos, o RLS no llegó a activarse. Esta versión NO borra por
-- nombre: elimina TODA policy existente en esas tablas y recrea
-- solo las correctas. Idempotente. No toca datos.
-- ============================================================

DO $$
DECLARE
  r RECORD;
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'suppliers','invoices','invoice_items','invoice_events',
    'recurring_expenses','profiles','bank_transactions'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    -- borrar TODAS las policies existentes en la tabla
    FOR r IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, tbl);
    END LOOP;
    -- activar (y forzar) RLS
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', tbl);
  END LOOP;
END $$;

-- Recrear políticas correctas (solo el dueño, autenticado) --------
CREATE POLICY "Suppliers: user owns" ON public.suppliers
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Invoices: user owns" ON public.invoices
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Recurring: user owns" ON public.recurring_expenses
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Invoice items: user owns invoice" ON public.invoice_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i
                 WHERE i.id = invoice_items.invoice_id AND i.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i
                      WHERE i.id = invoice_items.invoice_id AND i.user_id = auth.uid()));

CREATE POLICY "Invoice events: user owns invoice" ON public.invoice_events
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.invoices i
                 WHERE i.id = invoice_events.invoice_id AND i.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i
                      WHERE i.id = invoice_events.invoice_id AND i.user_id = auth.uid()));

CREATE POLICY "Profiles: user owns" ON public.profiles
  FOR ALL TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- bank_transactions: sin uso en la app → sin policy = nadie accede
-- (RLS activo + 0 policies = deny all, excepto service_role).

-- ============================================================
-- VERIFICACIÓN — corré esto después y mirá el resultado.
-- Las 7 deben tener rowsecurity = true:
--   SELECT tablename, rowsecurity
--   FROM pg_tables
--   WHERE schemaname='public'
--     AND tablename IN ('suppliers','invoices','invoice_items',
--       'invoice_events','recurring_expenses','profiles','bank_transactions')
--   ORDER BY tablename;
-- ============================================================

-- ============================================================
-- Backfill: Assign existing data to a specific user
-- ============================================================
--
-- INSTRUCTIONS:
-- 1. Find your user ID in Supabase Dashboard → Authentication → Users
--    or run: SELECT id, email FROM auth.users;
-- 2. Replace YOUR_USER_ID_HERE below with your actual UUID
-- 3. Run this script in Supabase SQL Editor
-- 4. After verifying, run the NOT NULL constraints from the migration
-- ============================================================

-- Replace this with your actual user UUID: 
-- Example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
DO $$
DECLARE
  target_user_id UUID := 326b515a-2c46-4d83-ac2e-393b65ea9ec2;
BEGIN
  -- Verify the user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'User ID % not found in auth.users. Check your UUID.', target_user_id;
  END IF;

  -- Backfill suppliers
  UPDATE public.suppliers
    SET user_id = target_user_id
    WHERE user_id IS NULL;
  RAISE NOTICE 'Suppliers updated: %', (SELECT count(*) FROM suppliers WHERE user_id = target_user_id);

  -- Backfill invoices
  UPDATE public.invoices
    SET user_id = target_user_id
    WHERE user_id IS NULL;
  RAISE NOTICE 'Invoices updated: %', (SELECT count(*) FROM invoices WHERE user_id = target_user_id);

  -- Backfill recurring expenses
  UPDATE public.recurring_expenses
    SET user_id = target_user_id
    WHERE user_id IS NULL;
  RAISE NOTICE 'Recurring expenses updated: %', (SELECT count(*) FROM recurring_expenses WHERE user_id = target_user_id);
END $$;

-- ============================================================
-- After backfill, enforce NOT NULL:
-- ============================================================

-- Verify no NULLs remain
-- SELECT 'invoices' AS t, count(*) FROM invoices WHERE user_id IS NULL
-- UNION ALL
-- SELECT 'suppliers', count(*) FROM suppliers WHERE user_id IS NULL
-- UNION ALL
-- SELECT 'recurring_expenses', count(*) FROM recurring_expenses WHERE user_id IS NULL;

-- Then uncomment and run:
-- ALTER TABLE public.invoices ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.suppliers ALTER COLUMN user_id SET NOT NULL;
-- ALTER TABLE public.recurring_expenses ALTER COLUMN user_id SET NOT NULL;

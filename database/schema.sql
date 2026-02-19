-- ============================================================
-- PAGOBOX — Database Schema for Supabase
-- Execute this in Supabase SQL Editor
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE invoice_status AS ENUM (
  'NEW', 'EXTRACTING', 'EXTRACTED', 'REVIEW_REQUIRED',
  'APPROVED', 'SCHEDULED', 'PAID', 'DISPUTE',
  'REJECTED', 'DUPLICATE'
);

CREATE TYPE invoice_source AS ENUM (
  'paper', 'email', 'whatsapp', 'recurring_auto'
);

CREATE TYPE payment_method AS ENUM (
  'transfer', 'check', 'cash', 'credit_card', 'debit', 'other'
);

CREATE TYPE user_role AS ENUM (
  'admin', 'employee', 'viewer'
);

CREATE TYPE recurring_type AS ENUM (
  'fixed_cost', 'owner_withdrawal', 'installment'
);

-- ============================================================
-- USERS (extends Supabase auth.users)
-- ============================================================

CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT NOT NULL,
  role        user_role NOT NULL DEFAULT 'employee',
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'employee'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- SUPPLIERS
-- ============================================================

CREATE TABLE public.suppliers (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                TEXT NOT NULL,
  alias               TEXT,
  tax_id              TEXT,
  tax_id_normalized   TEXT GENERATED ALWAYS AS (
    REPLACE(REPLACE(REPLACE(COALESCE(tax_id, ''), '.', ''), '-', ''), ' ', '')
  ) STORED,
  category            TEXT,
  
  -- Bank details
  bank_name           TEXT,
  bank_code           TEXT,             -- Itau code (113, 1, 137, etc)
  account_type        TEXT,             -- CC, CA
  account_number      TEXT,
  account_currency    TEXT DEFAULT 'UYU',
  
  -- Contact
  phone               TEXT,
  email               TEXT,
  contact_name        TEXT,
  payment_terms       TEXT DEFAULT '30 días',
  notes               TEXT,
  
  created_by          UUID REFERENCES public.profiles(id),
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_tax_id UNIQUE(tax_id_normalized)
);

CREATE INDEX idx_suppliers_name ON suppliers USING gin(to_tsvector('spanish', name));
CREATE INDEX idx_suppliers_tax_id ON suppliers(tax_id_normalized);

-- ============================================================
-- INVOICES
-- ============================================================

CREATE TABLE public.invoices (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- File
  file_path           TEXT NOT NULL,
  file_hash           TEXT NOT NULL,
  file_name           TEXT,
  file_mime_type      TEXT,
  file_size_bytes     INTEGER,
  
  -- Source
  source              invoice_source NOT NULL DEFAULT 'paper',
  source_detail       TEXT,
  
  -- Status
  status              invoice_status NOT NULL DEFAULT 'NEW',
  
  -- Extracted fields
  supplier_id         UUID REFERENCES suppliers(id),
  supplier_name_raw   TEXT,
  supplier_tax_id_raw TEXT,
  invoice_number      TEXT,
  invoice_series      TEXT,
  issue_date          DATE,
  due_date            DATE,
  currency            TEXT DEFAULT 'UYU',
  subtotal            NUMERIC(15,2),
  tax_amount          NUMERIC(15,2),
  total               NUMERIC(15,2),
  payment_terms       TEXT,
  notes_extracted     TEXT,
  
  -- AI extraction metadata
  raw_extracted_text  TEXT,
  extraction_json     JSONB,
  confidence_scores   JSONB,
  extraction_errors   TEXT[],
  extraction_model    TEXT,
  extracted_at        TIMESTAMPTZ,
  
  -- Duplicate detection
  duplicate_key       TEXT GENERATED ALWAYS AS (
    COALESCE(supplier_tax_id_raw, '') || '|' || 
    COALESCE(invoice_number, '') || '|' || 
    COALESCE(total::text, '') || '|' || 
    COALESCE(issue_date::text, '')
  ) STORED,
  is_possible_duplicate BOOLEAN DEFAULT false,
  duplicate_of_id     UUID REFERENCES invoices(id),
  
  -- Payment
  payment_date        DATE,
  payment_method      payment_method,
  payment_reference   TEXT,
  payment_bank_account TEXT,
  payment_proof_path  TEXT,
  
  -- Recurring link
  recurring_expense_id UUID,
  
  -- Audit
  created_by          UUID REFERENCES profiles(id),
  approved_by         UUID REFERENCES profiles(id),
  approved_at         TIMESTAMPTZ,
  paid_by             UUID REFERENCES profiles(id),
  paid_at             TIMESTAMPTZ,
  locked              BOOLEAN DEFAULT false,
  
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  
  CONSTRAINT unique_file_hash UNIQUE(file_hash)
);

CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_supplier ON invoices(supplier_id);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);
CREATE INDEX idx_invoices_duplicate_key ON invoices(duplicate_key);
CREATE INDEX idx_invoices_created ON invoices(created_at DESC);

-- ============================================================
-- INVOICE ITEMS (line items)
-- ============================================================

CREATE TABLE public.invoice_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id  UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT,
  quantity    NUMERIC(10,3),
  unit        TEXT,
  unit_price  NUMERIC(15,4),
  line_total  NUMERIC(15,2),
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INVOICE EVENTS (audit trail)
-- ============================================================

CREATE TABLE public.invoice_events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id    UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL,
  from_status   invoice_status,
  to_status     invoice_status,
  performed_by  UUID REFERENCES profiles(id),
  notes         TEXT,
  metadata      JSONB,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_events_invoice ON invoice_events(invoice_id, created_at DESC);

-- ============================================================
-- RECURRING EXPENSES
-- ============================================================

CREATE TABLE public.recurring_expenses (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type                  recurring_type NOT NULL,
  name                  TEXT NOT NULL,
  description           TEXT,
  
  estimated_amount      NUMERIC(15,2) NOT NULL,
  currency              TEXT DEFAULT 'UYU',
  is_variable           BOOLEAN DEFAULT false,
  
  frequency             TEXT DEFAULT 'monthly',
  day_of_month          INTEGER DEFAULT 1,
  
  -- Installments (cuotas)
  total_installments    INTEGER,
  current_installment   INTEGER,
  original_description  TEXT,
  original_purchase_date DATE,
  credit_card_last4     TEXT,
  
  -- Supplier link
  supplier_id           UUID REFERENCES suppliers(id),
  category              TEXT,
  
  active                BOOLEAN DEFAULT true,
  start_date            DATE DEFAULT CURRENT_DATE,
  end_date              DATE,
  
  auto_generate         BOOLEAN DEFAULT true,
  last_generated_date   DATE,
  
  created_by            UUID REFERENCES profiles(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- Add FK from invoices to recurring
ALTER TABLE invoices 
  ADD CONSTRAINT fk_recurring 
  FOREIGN KEY (recurring_expense_id) 
  REFERENCES recurring_expenses(id);

-- ============================================================
-- BANK TRANSACTIONS (for future reconciliation)
-- ============================================================

CREATE TABLE public.bank_transactions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bank_account      TEXT,
  transaction_date  DATE NOT NULL,
  description       TEXT,
  amount            NUMERIC(15,2) NOT NULL,
  currency          TEXT DEFAULT 'UYU',
  reference         TEXT,
  matched_invoice_id UUID REFERENCES invoices(id),
  match_confidence  NUMERIC(3,2),
  imported_at       TIMESTAMPTZ DEFAULT now(),
  import_batch_id   TEXT
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all, update own
CREATE POLICY "Profiles are viewable by authenticated" ON profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Suppliers: all authenticated can read, admin/employee can write
CREATE POLICY "Suppliers viewable by authenticated" ON suppliers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Suppliers writable by admin/employee" ON suppliers
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'employee'))
  );

-- Invoices: all authenticated can read, different write rules
CREATE POLICY "Invoices viewable by authenticated" ON invoices
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Invoices insertable by admin/employee" ON invoices
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'employee'))
  );
CREATE POLICY "Invoices updatable by admin" ON invoices
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR (
      -- Employees can only update extraction fields, not status
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'employee')
      AND status IN ('NEW', 'REVIEW_REQUIRED', 'EXTRACTED')
    )
  );

-- Invoice items: follow invoice permissions
CREATE POLICY "Invoice items viewable" ON invoice_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Invoice items writable" ON invoice_items
  FOR ALL TO authenticated USING (true);

-- Events: all can read, system/admin can write
CREATE POLICY "Events viewable" ON invoice_events
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Events writable" ON invoice_events
  FOR INSERT TO authenticated WITH CHECK (true);

-- Recurring: all can read, admin can write
CREATE POLICY "Recurring viewable" ON recurring_expenses
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Recurring writable by admin" ON recurring_expenses
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Bank transactions: admin only
CREATE POLICY "Bank transactions admin only" ON bank_transactions
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_invoices_timestamp
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_suppliers_timestamp
  BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_recurring_timestamp
  BEFORE UPDATE ON recurring_expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to auto-log invoice status changes
CREATE OR REPLACE FUNCTION log_invoice_status_change()
RETURNS trigger AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO invoice_events (invoice_id, event_type, from_status, to_status, performed_by, notes)
    VALUES (
      NEW.id,
      'status_change',
      OLD.status,
      NEW.status,
      auth.uid(),
      'Estado cambiado de ' || OLD.status || ' a ' || NEW.status
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_invoice_status_change
  AFTER UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION log_invoice_status_change();

-- Function to check duplicates after extraction
CREATE OR REPLACE FUNCTION check_invoice_duplicate()
RETURNS trigger AS $$
DECLARE
  existing_id UUID;
BEGIN
  IF NEW.duplicate_key IS NOT NULL AND NEW.duplicate_key != '|||' THEN
    SELECT id INTO existing_id
    FROM invoices
    WHERE duplicate_key = NEW.duplicate_key
      AND id != NEW.id
      AND status NOT IN ('REJECTED', 'DUPLICATE')
    LIMIT 1;
    
    IF existing_id IS NOT NULL THEN
      NEW.is_possible_duplicate = true;
      NEW.duplicate_of_id = existing_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_duplicate_before_update
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION check_invoice_duplicate();

-- ============================================================
-- STORAGE POLICIES
-- ============================================================

-- These are configured via Supabase dashboard, but here for reference:
-- Bucket: invoices (private)
-- Policy: authenticated users can upload
-- Policy: authenticated users can read

-- INSERT policy for 'invoices' bucket
-- Allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'invoices');

-- SELECT policy for 'invoices' bucket  
-- Allow authenticated users to read files
CREATE POLICY "Allow authenticated reads"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'invoices');

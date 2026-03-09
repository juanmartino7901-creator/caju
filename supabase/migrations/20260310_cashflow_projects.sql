-- ============================================================
-- Migration: Add cashflow_projects table
-- Stores financial planning projects as JSONB (ProjectData)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cashflow_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  name TEXT NOT NULL DEFAULT 'Nuevo Proyecto',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.cashflow_projects ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_cashflow_projects_user_id
  ON public.cashflow_projects(user_id);

CREATE POLICY "Cashflow projects: user owns" ON public.cashflow_projects
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

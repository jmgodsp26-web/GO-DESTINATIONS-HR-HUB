-- ==============================================================================
-- GO Destinations HR Hub - Supabase PostgreSQL Schema & Security Blueprint
-- Status: Prepared for future Supabase Integration (Pre-Connection Phase)
-- ==============================================================================

-- 1. DEPARTMENTS & POSITIONS (Reference Tables)
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. EMPLOYEES & PROFILES (Linked with Supabase Auth auth.users.id)
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  department TEXT NOT NULL,
  job_title TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee', 'manager')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  avatar_url TEXT,
  date_joined DATE NOT NULL DEFAULT CURRENT_DATE,
  hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
  date_of_birth DATE,
  is_pc BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. LEAVE TYPES
CREATE TABLE IF NOT EXISTS public.leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  default_days NUMERIC(5, 1) NOT NULL DEFAULT 0,
  is_paid BOOLEAN DEFAULT TRUE,
  requires_attachment_after_days INTEGER DEFAULT NULL
);

-- 4. LEAVE BALANCES
CREATE TABLE IF NOT EXISTS public.leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT NOT NULL REFERENCES public.employees(employee_id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL,
  allocated_days NUMERIC(5, 1) NOT NULL DEFAULT 0,
  used_days NUMERIC(5, 1) NOT NULL DEFAULT 0,
  year INTEGER NOT NULL DEFAULT 2026,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (employee_id, leave_type, year)
);

-- 5. LEAVE REQUESTS
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT NOT NULL REFERENCES public.employees(employee_id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  employee_department TEXT NOT NULL,
  leave_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count NUMERIC(5, 1) NOT NULL,
  is_half_day BOOLEAN DEFAULT FALSE,
  half_day_period TEXT CHECK (half_day_period IN ('Morning', 'Afternoon')),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Cancelled')),
  attachment_name TEXT,
  attachment_url TEXT,
  reviewed_by_id TEXT,
  reviewed_by_name TEXT,
  reviewed_at TIMESTAMPTZ,
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. LEAVE TRANSACTIONS (Auditable Ledger)
CREATE TABLE IF NOT EXISTS public.leave_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT NOT NULL REFERENCES public.employees(employee_id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL,
  change_amount NUMERIC(5, 1) NOT NULL,
  previous_balance NUMERIC(5, 1) NOT NULL,
  new_balance NUMERIC(5, 1) NOT NULL,
  reason TEXT NOT NULL,
  performed_by_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. COMPANY HOLIDAYS
CREATE TABLE IF NOT EXISTS public.holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date DATE UNIQUE NOT NULL,
  description TEXT,
  is_workday BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. HOLIDAY SHIFT REQUESTS (Staffing Coverage)
CREATE TABLE IF NOT EXISTS public.holiday_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT NOT NULL REFERENCES public.employees(employee_id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  employee_department TEXT NOT NULL,
  holiday_id UUID NOT NULL REFERENCES public.holidays(id) ON DELETE CASCADE,
  holiday_name TEXT NOT NULL,
  holiday_date DATE NOT NULL,
  working_hours TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  assigned_by_admin BOOLEAN DEFAULT FALSE,
  reviewed_by_id TEXT,
  reviewed_by_name TEXT,
  reviewed_at TIMESTAMPTZ,
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. EMPLOYEE DOCUMENTS
CREATE TABLE IF NOT EXISTS public.employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT NOT NULL REFERENCES public.employees(employee_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Contract', 'ID Proof', 'Resume', 'Certificate', 'Review', 'Other')),
  file_size TEXT NOT NULL,
  storage_path TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  uploaded_by_name TEXT NOT NULL
);

-- 10. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  link_tab TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id TEXT NOT NULL,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  details TEXT,
  timestamp TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. COMPANY SETTINGS
CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'GO Destinations Ltd.',
  timezone TEXT NOT NULL DEFAULT 'Asia/Singapore (GMT+8)',
  working_hours TEXT NOT NULL DEFAULT '09:00 - 18:00',
  workweek TEXT NOT NULL DEFAULT 'Monday to Friday',
  annual_leave_default NUMERIC(5, 1) DEFAULT 20,
  sick_leave_default NUMERIC(5, 1) DEFAULT 10,
  casual_leave_default NUMERIC(5, 1) DEFAULT 5,
  holiday_credit_rate NUMERIC(3, 1) DEFAULT 1.0,
  require_medical_cert_days INTEGER DEFAULT 2,
  email_notifications_enabled BOOLEAN DEFAULT TRUE,
  browser_notifications_enabled BOOLEAN DEFAULT TRUE,
  leave_approval_digest TEXT DEFAULT 'daily',
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holiday_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Helper to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.employees
    WHERE auth_user_id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Employees Table Policies
CREATE POLICY "Employees can read their own profile or directory"
  ON public.employees FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can modify employee records"
  ON public.employees FOR ALL
  TO authenticated
  USING (public.is_admin());

-- Leave Requests Policies
CREATE POLICY "Employees can view their own leave requests"
  ON public.leave_requests FOR SELECT
  TO authenticated
  USING (
    employee_id IN (
      SELECT employee_id FROM public.employees WHERE auth_user_id = auth.uid()
    ) OR public.is_admin()
  );

CREATE POLICY "Employees can create their own leave requests"
  ON public.leave_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    employee_id IN (
      SELECT employee_id FROM public.employees WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Only admins can approve/reject leave requests"
  ON public.leave_requests FOR UPDATE
  TO authenticated
  USING (public.is_admin());

-- Holidays Policies (Everyone reads, Admins modify)
CREATE POLICY "Everyone can read company holidays"
  ON public.holidays FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can modify company holidays"
  ON public.holidays FOR ALL
  TO authenticated
  USING (public.is_admin());

-- Add diagnosis column to ortho_cases
alter table public.ortho_cases 
  add column if not exists diagnosis text;

-- Update verify/calculated functions if any to ensure compatibility
-- (The existing calculate_ortho_balance and log_ortho_adjustment RPCs use table%rowtype or specific JSON inserts, 
--  adding a column to ortho_cases does not break them since we insert/select specific fields or handle them safely.)

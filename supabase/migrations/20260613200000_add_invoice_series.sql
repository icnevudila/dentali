-- Add series column to invoices table
alter table public.invoices
  add column if not exists series text not null default 'INV';

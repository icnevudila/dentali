-- Inventory enhancements
ALTER TABLE inventory_items 
ADD COLUMN IF NOT EXISTS supplier text,
ADD COLUMN IF NOT EXISTS brand text,
ADD COLUMN IF NOT EXISTS unit_cost numeric DEFAULT 0;

-- Lab Cases Module
CREATE TABLE IF NOT EXISTS lab_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  provider_id uuid,
  lab_name text NOT NULL,
  case_type text NOT NULL,
  sent_date date NOT NULL,
  expected_date date,
  received_date date,
  status text NOT NULL DEFAULT 'pending',
  cost numeric DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Odontogram to Inventory Mapping
CREATE TABLE IF NOT EXISTS procedure_inventory_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  procedure_code text NOT NULL,
  inventory_item_id uuid NOT NULL,
  quantity_required numeric NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

-- Doctor Commissions
ALTER TABLE staff_profiles
ADD COLUMN IF NOT EXISTS commission_rate numeric DEFAULT 0;

CREATE TABLE IF NOT EXISTS provider_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  branch_id uuid NOT NULL,
  provider_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  amount numeric NOT NULL,
  calculated_at timestamptz DEFAULT now()
);

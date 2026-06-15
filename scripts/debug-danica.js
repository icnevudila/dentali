const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Parse .env.local manually
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const processEnv = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    processEnv[key] = value.trim();
  }
});

const supabaseUrl = processEnv.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = processEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Listing all invoices in the database...");
  const { data: invoices, error: iError } = await supabase
    .from('invoices')
    .select('id, invoice_number, total_amount, paid_amount, status, patient_id, created_at, due_date');

  if (iError) {
    console.error("Error fetching invoices:", iError);
    return;
  }

  console.log(`Total invoices found: ${invoices.length}`);
  for (const inv of invoices) {
    console.log(`- Invoice ${inv.invoice_number} (ID: ${inv.id}):`);
    console.log(`  Total: ₱${inv.total_amount}, Paid: ₱${inv.paid_amount}, Status: ${inv.status}, Patient ID: ${inv.patient_id}`);
  }

  console.log("\nListing all payments in the database...");
  const { data: payments, error: payError } = await supabase
    .from('invoice_payments')
    .select('id, invoice_id, amount, payment_method, notes, created_at');

  if (payError) {
    console.error("Error fetching payments:", payError);
    return;
  }

  console.log(`Total payments found: ${payments.length}`);
  for (const pay of payments) {
    console.log(`- Payment of ₱${pay.amount} for Invoice ID ${pay.invoice_id} via ${pay.payment_method}`);
  }
}

main();

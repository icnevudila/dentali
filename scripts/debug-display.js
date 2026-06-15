const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("Fetching definition of public.get_public_queue_display...");
  
  // We can query pg_proc using a simple select via RPC or standard query if allowed, 
  // or we can run a query directly if we have permission. Since we are using service/anon key,
  // we might not have direct select on pg_catalog tables via postgrest.
  // Let's try to query a custom sql function or execute query if there is any SQL runner RPC.
  // Wait, let's see if we can read queue entries first to see if any exist.
  const { data: entries, error: entriesError } = await supabase
    .from('queue_entries')
    .select('*')
    .limit(10);
  
  if (entriesError) {
    console.error("Error reading queue entries:", entriesError);
  } else {
    console.log("Queue Entries:", entries);
  }

  // Let's also check if there is an active branch token
  const { data: tokens, error: tokenError } = await supabase
    .from('branch_public_tokens')
    .select('*');
  
  if (tokenError) {
    console.error("Error reading branch public tokens:", tokenError);
  } else {
    console.log("Branch Public Tokens:", tokens);
  }
}

main();


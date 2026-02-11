import { createClient } from '@supabase/supabase-js';

import { ProxyAgent, setGlobalDispatcher } from 'undici';

// Configure global proxy agent for corporate network
const proxyAgent = new ProxyAgent({
  uri: 'http://host.containers.internal:9000',
  requestTls: {
    rejectUnauthorized: false
  }
});
setGlobalDispatcher(proxyAgent);

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function listInvoices() {


  const { data, error } = await supabase.from('invoices').select().eq('amount', 666);

  if (error) {
    console.error('Error retrieving invoices:', error);
    throw error;
  }
  return data;



  return data;
}


export async function GET() {

  try {
    return Response.json(await listInvoices());
  } catch (error) {
    return Response.json({ error }, { status: 500 });
  }
}

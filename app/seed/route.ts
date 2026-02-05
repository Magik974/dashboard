import bcrypt from 'bcrypt';
import { createClient } from '@supabase/supabase-js';
import { ProxyAgent, setGlobalDispatcher } from 'undici';
import { invoices, customers, revenue, users } from '../lib/placeholder-data';

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

async function seedUsers() {
  const results = await Promise.all(
    users.map(async (user) => {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      const { data, error } = await supabase.from('users').upsert({
        id: user.id,
        name: user.name,
        email: user.email,
        password: hashedPassword
      }, { onConflict: 'id' });

      if (error) {
        console.error('Error inserting user:', user.email, error);
        throw error;
      }
      return data;
    }),
  );

  console.log(`Seeded ${results.length} users`);
  return results;
}

async function seedInvoices() {
  const results = await Promise.all(
    invoices.map(async (invoice) => {
      const { data, error } = await supabase.from('invoices').upsert({
        customer_id: invoice.customer_id,
        amount: invoice.amount,
        status: invoice.status,
        date: invoice.date
      });

      if (error) {
        console.error('Error inserting invoice:', invoice, error);
        throw error;
      }
      return data;
    })
  );

  console.log(`Seeded ${results.length} invoices`);
  return results;
}

async function seedCustomers() {
  const results = await Promise.all(
    customers.map(async (customer) => {
      const { data, error } = await supabase.from('customers').upsert({
        id: customer.id,
        name: customer.name,
        email: customer.email,
        image_url: customer.image_url
      }, { onConflict: 'id' });

      if (error) {
        console.error('Error inserting customer:', customer.name, error);
        throw error;
      }
      return data;
    })
  );

  console.log(`Seeded ${results.length} customers`);
  return results;
}

async function seedRevenue() {
  const results = await Promise.all(
    revenue.map(async (rev) => {
      const { data, error } = await supabase.from('revenue').upsert({
        month: rev.month,
        revenue: rev.revenue
      }, { onConflict: 'month' });

      if (error) {
        console.error('Error inserting revenue:', rev.month, error);
        throw error;
      }
      return data;
    })
  );

  console.log(`Seeded ${results.length} revenue records`);
  return results;
}

export async function GET() {
  console.log('Starting database seed...');
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
  console.log('SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    await seedUsers();
    await seedCustomers();
    await seedInvoices();
    await seedRevenue();

    console.log('Database seeded successfully!');
    return Response.json({ message: 'Database seeded successfully' });
  } catch (error) {
    console.error('Seeding error:', error);
    return Response.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error
    }, { status: 500 });
  }
}

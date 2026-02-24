'use server';
import { z } from 'zod';
import { ProxyAgent, setGlobalDispatcher } from 'undici';
import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
  fields?: {
    customerId?: string;
    amount?: string;
    status?: string;
  };
  submittedAt?: number;
};

// Configure global proxy agent for corporate network
const proxyAgent = new ProxyAgent({
  uri: 'http://host.containers.internal:9000',
  requestTls: {
    rejectUnauthorized: false
  }
});
setGlobalDispatcher(proxyAgent);

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: 'Please select a customer.',

  }),
  amount: z.coerce.number().gt(0, { message: 'Please enter an amount greater than $0.' }),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select an invoice status.',
  }),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });


export async function createInvoice(prevState: State, formData: FormData) {

  console.log("Previous State:", prevState);
  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
      fields: {
        customerId: formData.get('customerId')?.toString(),
        amount: formData.get('amount')?.toString(),
        status: formData.get('status')?.toString(),
      },
      submittedAt: Date.now(),
    };
  }

  const { customerId, amount, status } = validatedFields.data;

  const amountInCents = amount * 100;
  const date = new Date().toISOString().split('T')[0];

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

  const { data, error } = await supabase
    .from('invoices')
    .insert({
      customer_id: customerId,
      amount: amountInCents,
      status: status,
      date: date
    });

  if (error) {
    console.error('Failed to create invoice:', error);
    return {
      message: 'Database Error: Failed to Create Invoice.',
    };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');

}
export async function updateInvoice(id: string, formData: FormData) {
  const { customerId, amount, status } = UpdateInvoice.parse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  const amountInCents = amount * 100;

  // await sql`
  //   UPDATE invoices
  //   SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
  //   WHERE id = ${id}
  // `;

  const supabase = createClient(process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  const { data, error } = await supabase
    .from('invoices')
    .update({
      customer_id: customerId,
      amount: amountInCents,
      status: status
    })
    .eq('id', id);
  if (error) {
    console.error('Failed to update invoice:', error);
    throw new Error('Failed to update invoice.');
  }
  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}
export async function deleteInvoice(id: string) {
  throw new Error('Failed to Delete Invoice');

  const supabase = createClient(process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  const { data, error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', id);
  revalidatePath('/dashboard/invoices');
}


export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.';
        default:
          return 'Something went wrong.';
      }
    }
    throw error;
  }
}
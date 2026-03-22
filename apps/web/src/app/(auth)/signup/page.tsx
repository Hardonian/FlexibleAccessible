import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { SignupForm } from './signup-form';

export const metadata = { title: 'Sign Up - AROS' };

export default async function SignupPage() {
  const user = await getSession();
  if (user) redirect('/dashboard');

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-slate-900 mb-6">Create your account</h2>
      <SignupForm />
      <p className="mt-4 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <a href="/login" className="text-brand-600 hover:text-brand-700 font-medium">
          Sign in
        </a>
      </p>
    </div>
  );
}

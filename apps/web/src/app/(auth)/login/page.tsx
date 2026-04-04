import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSession } from '@/lib/session';
import { LoginForm } from './login-form';
import { pageTitle } from '@/lib/product-brand';

export const metadata: Metadata = {
  title: pageTitle('Sign in'),
  description: 'Sign in to your FlexibleAccessible workspace.',
  robots: { index: false, follow: true },
};

export default async function LoginPage() {
  const user = await getSession();
  if (user) redirect('/dashboard');

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-slate-900 mb-6">Sign in to your account</h2>
      <LoginForm />
      <p className="mt-4 text-center text-sm text-slate-500">
        Don&apos;t have an account?{' '}
        <a href="/signup" className="text-brand-600 hover:text-brand-700 font-medium">
          Sign up
        </a>
      </p>
    </div>
  );
}

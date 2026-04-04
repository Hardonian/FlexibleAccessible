import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSession } from '@/lib/session';
import { SignupForm } from './signup-form';
import { pageTitle } from '@/lib/product-brand';

export const metadata: Metadata = {
  title: pageTitle('Create workspace'),
  description:
    'Create a FlexibleAccessible workspace for private scans, findings, exports, and plan-gated API access.',
  robots: { index: false, follow: true },
};

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

import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSession } from '@/lib/session';
import { LoginForm } from './login-form';
import { pageTitle } from '@/lib/product-brand';
import { getOidcEnterpriseConfig } from '@/lib/auth/oidc-env';

export const metadata: Metadata = {
  title: pageTitle('Sign in'),
  description: 'Sign in to your AccessibleMadeFlexible workspace.',
  robots: { index: false, follow: true },
};

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function LoginPage({ searchParams }: PageProps) {
  const user = await getSession();
  if (user?.emailVerified) redirect('/dashboard');
  if (user && !user.emailVerified) redirect('/verify-email');

  const sp = await searchParams;
  const resetOk = sp.reset === 'success';
  const verifyInvalid = sp.verify === 'invalid';
  const rawMsg = sp.message;
  const msgStr = Array.isArray(rawMsg) ? rawMsg[0] : rawMsg;
  const oidcError =
    sp.oidc === 'error'
      ? msgStr
        ? decodeURIComponent(msgStr)
        : 'Sign-in with your organization failed. Try again or use email and password.'
      : null;
  const ssoEnabled = getOidcEnterpriseConfig() !== null;

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-slate-900 mb-6">Sign in to your account</h2>
      {resetOk && (
        <p role="status" className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-900">
          Password updated. Sign in with your new password.
        </p>
      )}
      {verifyInvalid && (
        <p role="alert" className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-950">
          That confirmation or reset link is invalid, expired, or already used. Request a new one if you still need access.
        </p>
      )}
      {oidcError && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-900">
          {oidcError}
        </p>
      )}
      <LoginForm ssoEnabled={ssoEnabled} />
      <p className="mt-4 text-center text-sm text-slate-500">
        Don&apos;t have an account?{' '}
        <a href="/signup" className="text-brand-600 hover:text-brand-700 font-medium">
          Sign up
        </a>
      </p>
    </div>
  );
}

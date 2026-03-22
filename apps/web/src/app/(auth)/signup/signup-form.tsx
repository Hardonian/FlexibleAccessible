'use client';

import { useActionState } from 'react';
import { signupAction } from './actions';

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signupAction, { error: null });

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="name" className="label">
          Full name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoComplete="name"
          className="input"
          placeholder="Jane Smith"
        />
      </div>

      <div>
        <label htmlFor="email" className="label">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="input"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="input"
          placeholder="At least 8 characters"
        />
      </div>

      <div>
        <label htmlFor="orgName" className="label">
          Organization name
        </label>
        <input
          id="orgName"
          name="orgName"
          type="text"
          required
          className="input"
          placeholder="Acme Inc."
        />
      </div>

      <button type="submit" disabled={pending} className="btn-primary w-full">
        {pending ? 'Creating account...' : 'Create account'}
      </button>

      <p className="text-xs text-slate-400 text-center">
        By signing up, you agree to our Terms of Service and Privacy Policy.
      </p>
    </form>
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { getEmailOutboundSummary } from "@aros/config";
import { ResendVerificationForm } from "./resend-form";
import { logoutAction } from "@/components/layout/logout-action";

export const metadata = { title: "Confirm your email" };

export default async function VerifyEmailPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.emailVerified) redirect("/dashboard");

  const emailReady = getEmailOutboundSummary(process.env).configured;

  return (
    <div className="mx-auto max-w-lg space-y-6 py-8">
      <div className="card">
        <h1 className="text-xl font-semibold text-slate-900">Confirm your email</h1>
        <p className="mt-2 text-sm text-slate-600">
          We sent a confirmation link to <span className="font-medium">{user.email}</span>. Open it
          on this device or any device signed into your mail — the link is single-use and expires in
          48 hours.
        </p>
        {!emailReady && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
          >
            Outbound email is not configured on this deployment, so a confirmation message may not
            arrive. Ask an operator to configure SMTP (see{" "}
            <Link href="/system" className="underline underline-offset-2 font-medium">
              System
            </Link>
            ) or contact support.
          </div>
        )}
        <div className="mt-6">
          <ResendVerificationForm />
        </div>
        <p className="mt-6 text-sm text-slate-500">
          Wrong account?{" "}
          <form action={logoutAction} className="inline">
            <button
              type="submit"
              className="text-brand-600 font-medium underline underline-offset-2"
            >
              Sign out
            </button>
          </form>
        </p>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "./forgot-password-form";
import { pageTitle } from "@/lib/product-brand";

export const metadata: Metadata = {
  title: pageTitle("Forgot password"),
  robots: { index: false, follow: true },
};

export default async function ForgotPasswordPage() {
  const user = await getSession();
  if (user?.emailVerified) redirect("/dashboard");
  if (user && !user.emailVerified) redirect("/verify-email");

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-slate-900 mb-2">Reset your password</h2>
      <p className="text-sm text-slate-600 mb-6">
        Enter your email. If we recognize it, we will send a single-use link that expires in one hour.
      </p>
      <ForgotPasswordForm />
      <p className="mt-4 text-center text-sm text-slate-500">
        <Link href="/login" className="text-brand-600 hover:text-brand-700 font-medium">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

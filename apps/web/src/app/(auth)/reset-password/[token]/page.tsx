import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResetPasswordForm } from "../reset-password-form";
import { pageTitle } from "@/lib/product-brand";

export const metadata: Metadata = {
  title: pageTitle("Set new password"),
  robots: { index: false, follow: false },
};

export default async function ResetPasswordTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token: raw } = await params;
  const token = decodeURIComponent(raw);
  if (!token || token.length < 16) notFound();

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-slate-900 mb-6">Choose a new password</h2>
      <ResetPasswordForm token={token} />
      <p className="mt-4 text-center text-sm text-slate-500">
        <Link href="/login" className="text-brand-600 hover:text-brand-700 font-medium">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

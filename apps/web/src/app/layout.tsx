import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'AROS - Accessibility Remediation OS',
  description:
    'Discover, scan, cluster, and remediate accessibility issues at the source level with browser-accurate scanning and AI-assisted fixes.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">{children}</body>
    </html>
  );
}

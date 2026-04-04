import { requireSession } from '@/lib/session';
import { AddSiteForm } from './add-site-form';

export const metadata = { title: 'Add Site' };

export default async function AddSitePage() {
  await requireSession();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Add a New Site</h1>
        <p className="text-slate-500 mt-1">
          Register a website to start crawling and scanning for accessibility issues.
        </p>
      </div>
      <div className="card">
        <AddSiteForm />
      </div>
    </div>
  );
}

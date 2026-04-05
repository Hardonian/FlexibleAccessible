import { requireSession } from '@/lib/session';
import { AddSiteForm } from './add-site-form';
import { PageHeader } from '@/components/layout/page-header';
import { pageTitle } from '@/lib/product-brand';

export const metadata = { title: pageTitle('Add site') };

export default async function AddSitePage() {
  await requireSession();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Add site"
        description="Register a URL so FlexibleAccessible can crawl pages and queue verification scans against your plan limits."
      />
      <div className="card">
        <AddSiteForm />
      </div>
    </div>
  );
}

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect('/login');

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: {
      organization: {
        include: {
          workspaces: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });

  const orgs = memberships.map((m) => ({
    id: m.organization.id,
    name: m.organization.name,
    slug: m.organization.slug,
    role: m.role,
    workspaces: m.organization.workspaces,
  }));

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar orgs={orgs} user={user} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar user={user} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}

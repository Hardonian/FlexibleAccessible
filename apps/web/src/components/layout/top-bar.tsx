import { logoutAction } from './logout-action';

interface TopBarProps {
  user: { id: string; email: string; name: string | null };
}

export function TopBar({ user }: TopBarProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div />
      <div className="flex items-center gap-4">
        <span className="text-sm text-slate-500">{user.name ?? user.email}</span>
        <form action={logoutAction}>
          <button type="submit" className="btn-ghost text-sm">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}

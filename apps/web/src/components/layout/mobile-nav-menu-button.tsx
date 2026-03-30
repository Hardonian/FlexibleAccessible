'use client';

import { useDashboardNav } from './dashboard-nav-context';
import { NAV_ICON_MAP } from './dashboard-nav-config';

export function MobileNavMenuButton() {
  const { toggleMobileNav, mobileNavOpen } = useDashboardNav();
  return (
    <button
      type="button"
      className="btn-ghost min-h-[44px] min-w-[44px] shrink-0 md:hidden"
      onClick={toggleMobileNav}
      aria-label="Open main menu"
      aria-expanded={mobileNavOpen}
    >
      <span className="text-lg" aria-hidden="true">
        {NAV_ICON_MAP.Menu}
      </span>
    </button>
  );
}

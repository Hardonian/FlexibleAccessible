"use client";

import { useDashboardNav } from "./dashboard-nav-context";
import { NAV_ICON_MAP } from "./dashboard-nav-config";

export function MobileNavMenuButton() {
  const { toggleMobileNav, mobileNavOpen } = useDashboardNav();
  const MenuIcon = NAV_ICON_MAP.Menu;
  return (
    <button
      type="button"
      className="btn-ghost min-h-[44px] min-w-[44px] shrink-0 md:hidden"
      onClick={toggleMobileNav}
      aria-label={mobileNavOpen ? "Close main menu" : "Open main menu"}
      aria-expanded={mobileNavOpen}
    >
      {MenuIcon && <MenuIcon className="h-5 w-5" aria-hidden="true" />}
    </button>
  );
}

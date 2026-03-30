import type { MemberRole } from "@aros/db";
import {
  LayoutDashboard,
  Globe,
  AlertTriangle,
  Layers,
  Wrench,
  CheckSquare,
  FileText,
  Settings,
  Server,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";

export interface OrgInfo {
  id: string;
  name: string;
  slug: string;
  role: MemberRole;
  workspaces: Array<{ id: string; name: string; slug: string }>;
}

export const DASHBOARD_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/sites", label: "Sites", icon: "Globe" },
  { href: "/findings", label: "Findings", icon: "AlertTriangle" },
  { href: "/clusters", label: "Clusters", icon: "Layers" },
  { href: "/remediation", label: "Remediation", icon: "Wrench" },
  { href: "/reviews", label: "Reviews", icon: "CheckSquare" },
  { href: "/reports", label: "Reports", icon: "FileText" },
  { href: "/settings", label: "Settings", icon: "Settings" },
] as const;

export const NAV_ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Globe,
  AlertTriangle,
  Layers,
  Wrench,
  CheckSquare,
  FileText,
  Settings,
  Server,
  Menu,
  Close: X,
};

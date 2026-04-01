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
  subscription?: {
    aiEnabled: boolean;
    aiTokenLimit: number;
  } | null;
}

export const DASHBOARD_NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard", premium: true },
  { href: "/sites", label: "Sites", icon: "Globe", premium: true },
  { href: "/findings", label: "Findings", icon: "AlertTriangle", premium: true },
  { href: "/clusters", label: "Clusters", icon: "Layers", premium: true },
  { href: "/remediation", label: "Remediation", icon: "Wrench", premium: true },
  { href: "/reviews", label: "Reviews", icon: "CheckSquare", premium: true },
  { href: "/reports", label: "Reports", icon: "FileText", premium: true },
  { href: "/settings", label: "Settings", icon: "Settings", premium: false },
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

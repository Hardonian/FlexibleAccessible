export type Permission =
  | "org:system:view"
  | "org:system:manage"
  | "org:manage"
  | "org:billing"
  | "org:members:manage"
  | "org:members:view"
  | "workspace:create"
  | "workspace:manage"
  | "site:create"
  | "site:manage"
  | "site:view"
  | "crawl:start"
  | "crawl:view"
  | "scan:start"
  | "scan:view"
  | "findings:view"
  | "findings:manage"
  | "suggestions:view"
  | "suggestions:approve"
  | "suggestions:export"
  | "review:view"
  | "review:manage"
  | "review:assign"
  | "integrations:manage"
  | "integrations:view"
  | "reports:view"
  | "reports:export"
  | "audit:view"
  | "stakeholders:view"
  | "stakeholders:manage"
  | "stakeholders:engage"
  | "stakeholders:audit"
  | "stakeholders:governance";

type Role =
  | "OWNER"
  | "ADMIN"
  | "DEVELOPER"
  | "CONTENT_EDITOR"
  | "AUDITOR"
  | "REVIEWER";

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: [
    "org:system:view",
    "org:system:manage",
    "org:manage",
    "org:billing",
    "org:members:manage",
    "org:members:view",
    "workspace:create",
    "workspace:manage",
    "site:create",
    "site:manage",
    "site:view",
    "crawl:start",
    "crawl:view",
    "scan:start",
    "scan:view",
    "findings:view",
    "findings:manage",
    "suggestions:view",
    "suggestions:approve",
    "suggestions:export",
    "review:view",
    "review:manage",
    "review:assign",
    "integrations:manage",
    "integrations:view",
    "reports:view",
    "reports:export",
    "audit:view",
    "stakeholders:view",
    "stakeholders:manage",
    "stakeholders:engage",
    "stakeholders:audit",
    "stakeholders:governance",
  ],
  ADMIN: [
    "org:system:view",
    "org:system:manage",
    "org:members:manage",
    "org:members:view",
    "workspace:create",
    "workspace:manage",
    "site:create",
    "site:manage",
    "site:view",
    "crawl:start",
    "crawl:view",
    "scan:start",
    "scan:view",
    "findings:view",
    "findings:manage",
    "suggestions:view",
    "suggestions:approve",
    "suggestions:export",
    "review:view",
    "review:manage",
    "review:assign",
    "integrations:manage",
    "integrations:view",
    "reports:view",
    "reports:export",
    "audit:view",
    "stakeholders:view",
    "stakeholders:manage",
    "stakeholders:engage",
    "stakeholders:audit",
    "stakeholders:governance",
  ],
  DEVELOPER: [
    "org:members:view",
    "site:view",
    "crawl:start",
    "crawl:view",
    "scan:start",
    "scan:view",
    "findings:view",
    "findings:manage",
    "suggestions:view",
    "suggestions:approve",
    "suggestions:export",
    "review:view",
    "integrations:view",
    "reports:view",
    "reports:export",
    "stakeholders:view",
    "stakeholders:engage",
  ],
  CONTENT_EDITOR: [
    "site:view",
    "crawl:view",
    "scan:view",
    "findings:view",
    "suggestions:view",
    "suggestions:approve",
    "review:view",
    "review:manage",
    "reports:view",
    "stakeholders:view",
  ],
  AUDITOR: [
    "org:members:view",
    "site:view",
    "crawl:view",
    "scan:view",
    "findings:view",
    "suggestions:view",
    "review:view",
    "review:manage",
    "review:assign",
    "reports:view",
    "reports:export",
    "audit:view",
    "stakeholders:view",
    "stakeholders:audit",
  ],
  REVIEWER: [
    "site:view",
    "crawl:view",
    "scan:view",
    "findings:view",
    "suggestions:view",
    "suggestions:approve",
    "review:view",
    "review:manage",
    "reports:view",
    "stakeholders:view",
  ],
  DEVELOPER: [
    "org:members:view",
    "site:view",
    "crawl:start",
    "crawl:view",
    "scan:start",
    "scan:view",
    "findings:view",
    "findings:manage",
    "suggestions:view",
    "suggestions:approve",
    "suggestions:export",
    "review:view",
    "integrations:view",
    "reports:view",
    "reports:export",
  ],
  CONTENT_EDITOR: [
    "site:view",
    "crawl:view",
    "scan:view",
    "findings:view",
    "suggestions:view",
    "suggestions:approve",
    "review:view",
    "review:manage",
    "reports:view",
  ],
  AUDITOR: [
    "org:members:view",
    "site:view",
    "crawl:view",
    "scan:view",
    "findings:view",
    "suggestions:view",
    "review:view",
    "review:manage",
    "review:assign",
    "reports:view",
    "reports:export",
    "audit:view",
  ],
  REVIEWER: [
    "site:view",
    "crawl:view",
    "scan:view",
    "findings:view",
    "suggestions:view",
    "suggestions:approve",
    "review:view",
    "review:manage",
    "reports:view",
  ],
};

export const PERMISSIONS = ROLE_PERMISSIONS;

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

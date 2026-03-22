import { describe, it, expect } from 'vitest';
import { hasPermission } from '../permissions';

describe('hasPermission', () => {
  it('OWNER and ADMIN can view org system status', () => {
    expect(hasPermission('OWNER', 'org:system:view')).toBe(true);
    expect(hasPermission('ADMIN', 'org:system:view')).toBe(true);
    expect(hasPermission('DEVELOPER', 'org:system:view')).toBe(false);
  });

  it('OWNER has all permissions', () => {
    expect(hasPermission('OWNER', 'org:manage')).toBe(true);
    expect(hasPermission('OWNER', 'org:billing')).toBe(true);
    expect(hasPermission('OWNER', 'site:create')).toBe(true);
    expect(hasPermission('OWNER', 'suggestions:approve')).toBe(true);
    expect(hasPermission('OWNER', 'audit:view')).toBe(true);
  });

  it('DEVELOPER cannot manage org or billing', () => {
    expect(hasPermission('DEVELOPER', 'org:manage')).toBe(false);
    expect(hasPermission('DEVELOPER', 'org:billing')).toBe(false);
    expect(hasPermission('DEVELOPER', 'org:members:manage')).toBe(false);
  });

  it('DEVELOPER can start crawls and view findings', () => {
    expect(hasPermission('DEVELOPER', 'crawl:start')).toBe(true);
    expect(hasPermission('DEVELOPER', 'findings:view')).toBe(true);
    expect(hasPermission('DEVELOPER', 'suggestions:export')).toBe(true);
  });

  it('CONTENT_EDITOR cannot start crawls', () => {
    expect(hasPermission('CONTENT_EDITOR', 'crawl:start')).toBe(false);
    expect(hasPermission('CONTENT_EDITOR', 'scan:start')).toBe(false);
  });

  it('CONTENT_EDITOR can view findings and approve suggestions', () => {
    expect(hasPermission('CONTENT_EDITOR', 'findings:view')).toBe(true);
    expect(hasPermission('CONTENT_EDITOR', 'suggestions:approve')).toBe(true);
  });

  it('AUDITOR can view audit logs', () => {
    expect(hasPermission('AUDITOR', 'audit:view')).toBe(true);
    expect(hasPermission('AUDITOR', 'reports:export')).toBe(true);
  });

  it('AUDITOR cannot manage integrations', () => {
    expect(hasPermission('AUDITOR', 'integrations:manage')).toBe(false);
  });

  it('REVIEWER can manage reviews but not export suggestions', () => {
    expect(hasPermission('REVIEWER', 'review:manage')).toBe(true);
    expect(hasPermission('REVIEWER', 'suggestions:export')).toBe(false);
  });
});

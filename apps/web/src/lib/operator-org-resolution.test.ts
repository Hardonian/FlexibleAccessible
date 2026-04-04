import { describe, expect, it } from "vitest";
import {
  resolveOperatorScopedMembership,
  type OperatorMembershipRow,
} from "./operator-org-resolution";

const day = (n: number) => new Date(Date.UTC(2026, 0, n));

describe("resolveOperatorScopedMembership", () => {
  it("returns null when no membership has the permission", () => {
    const rows: OperatorMembershipRow[] = [
      {
        organizationId: "a",
        role: "REVIEWER",
        createdAt: day(1),
      },
    ];
    expect(
      resolveOperatorScopedMembership(rows, "a", "org:system:view"),
    ).toBeNull();
  });

  it("prefers active-org cookie when that org is eligible", () => {
    const rows: OperatorMembershipRow[] = [
      {
        organizationId: "old",
        role: "ADMIN",
        createdAt: day(1),
      },
      {
        organizationId: "new",
        role: "ADMIN",
        createdAt: day(10),
      },
    ];
    expect(
      resolveOperatorScopedMembership(rows, "new", "org:system:view"),
    ).toEqual({ organizationId: "new", role: "ADMIN" });
  });

  it("ignores cookie when user is not eligible for that org", () => {
    const rows: OperatorMembershipRow[] = [
      {
        organizationId: "eligible",
        role: "ADMIN",
        createdAt: day(2),
      },
      {
        organizationId: "other",
        role: "REVIEWER",
        createdAt: day(1),
      },
    ];
    expect(
      resolveOperatorScopedMembership(rows, "other", "org:system:view"),
    ).toEqual({ organizationId: "eligible", role: "ADMIN" });
  });

  it("falls back to oldest eligible membership when cookie missing", () => {
    const rows: OperatorMembershipRow[] = [
      {
        organizationId: "second",
        role: "ADMIN",
        createdAt: day(5),
      },
      {
        organizationId: "first",
        role: "ADMIN",
        createdAt: day(1),
      },
    ];
    expect(
      resolveOperatorScopedMembership(rows, undefined, "org:system:view"),
    ).toEqual({ organizationId: "first", role: "ADMIN" });
  });
});

import { describe, expect, it } from "vitest";
import { metadata as authMetadata } from "@/app/(auth)/layout";
import { metadata as dashboardMetadata } from "@/app/(dashboard)/layout";

describe("non-public route metadata", () => {
  it("marks auth routes as noindex", () => {
    expect(authMetadata.robots).toMatchObject({
      index: false,
      follow: false,
      nocache: true,
    });
  });

  it("marks dashboard routes as noindex", () => {
    expect(dashboardMetadata.robots).toMatchObject({
      index: false,
      follow: false,
      nocache: true,
    });
  });
});

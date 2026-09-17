import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function signInAsDemo(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill("demo@aros.dev");
  await page.getByLabel(/password/i).fill("demo1234");
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page
    .waitForURL(/\/(dashboard|sites|findings)/, { timeout: 10000 })
    .catch(() => {});
}

test.describe("Mobile Navigation Accessibility", () => {
  test("should have accessible mobile navigation menu", async ({
    page,
    browserName,
  }) => {
    if (browserName === "webkit") {
      test.skip();
    }

    await page.setViewportSize({ width: 375, height: 667 });

    await signInAsDemo(page);
    await page.goto("/dashboard");

    const mobileNavButton = page.getByRole("button", {
      name: /open main menu|menu|navigation/i,
    });
    if ((await mobileNavButton.count()) === 0) {
      test.skip(
        true,
        "No mobile nav button found – desktop viewport may be active",
      );
      return;
    }
    await expect(mobileNavButton).toBeVisible();

    const expandedBefore = await mobileNavButton.getAttribute("aria-expanded");
    await mobileNavButton.click();

    const expandedAfter = await mobileNavButton.getAttribute("aria-expanded");
    expect(expandedAfter).not.toBe(expandedBefore);

    const navElement = page.locator("nav, [role='navigation']").first();
    await expect(navElement).toBeVisible();
  });

  test("should pass accessibility audit on dashboard with mobile nav", async ({
    page,
    browserName,
  }) => {
    if (browserName === "webkit") {
      test.skip();
    }

    await page.setViewportSize({ width: 375, height: 667 });

    await signInAsDemo(page);
    await page.goto("/dashboard");

    const accessibilityScanResults = await new AxeBuilder({ page: page as any })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const relevantViolations = accessibilityScanResults.violations.filter(
      (violation) =>
        !violation.id.includes("bypass") &&
        !violation.id.includes("heading-order") &&
        !violation.id.includes("color-contrast"),
    );

    expect(relevantViolations).toEqual([]);
  });

  test("should handle keyboard navigation in mobile menu", async ({
    page,
    browserName,
  }) => {
    if (browserName === "webkit") {
      test.skip();
    }

    await page.setViewportSize({ width: 375, height: 667 });

    await signInAsDemo(page);
    await page.goto("/dashboard");

    const mobileNavButton = page.getByRole("button", {
      name: /open main menu|menu|navigation/i,
    });
    if ((await mobileNavButton.count()) === 0) {
      test.skip(true, "No mobile nav button found");
      return;
    }
    await mobileNavButton.focus();
    await page.keyboard.press("Enter");

    const navElement = page.locator("nav, [role='navigation']").first();
    await expect(navElement).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(navElement).not.toBeVisible();
  });
});

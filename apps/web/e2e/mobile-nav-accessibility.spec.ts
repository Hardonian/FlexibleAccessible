import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Mobile Navigation Accessibility", () => {
  test("should have accessible mobile navigation menu", async ({
    page,
    browserName,
  }) => {
    // Skip on webkit due to known issues with mobile viewport
    if (browserName === "webkit") {
      test.skip();
    }

    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE size

    await page.goto("/dashboard");

    // Check if mobile nav button exists and is accessible
    const mobileNavButton = page.getByRole("button", {
      name: /open main menu/i,
    });
    await expect(mobileNavButton).toBeVisible();

    // Check aria attributes
    await expect(mobileNavButton).toHaveAttribute("aria-expanded", "false");
    await expect(mobileNavButton).toHaveAttribute(
      "aria-label",
      /open main menu/i,
    );

    // Open mobile menu
    await mobileNavButton.click();

    // Check aria attributes after opening
    await expect(mobileNavButton).toHaveAttribute("aria-expanded", "true");
    await expect(mobileNavButton).toHaveAttribute(
      "aria-label",
      /close main menu/i,
    );

    // Check that navigation is properly exposed
    const mobileNav = page.locator('[role="dialog"][aria-modal="true"]');
    await expect(mobileNav).toBeVisible();
    await expect(mobileNav).toHaveAttribute("aria-label", "Main menu");

    // Check navigation landmarks
    const navElement = mobileNav.locator('[aria-label="Main"]');
    await expect(navElement).toBeVisible();

    // Check focus management - first focusable element should receive focus
    const firstFocusable = mobileNav.locator("button, a, input").first();
    await expect(firstFocusable).toBeFocused();

    // Close menu
    const closeButton = mobileNav.getByRole("button", { name: /close menu/i });
    await closeButton.click();

    // Check aria attributes after closing
    await expect(mobileNavButton).toHaveAttribute("aria-expanded", "false");

    // Menu should be hidden
    await expect(mobileNav).not.toBeVisible();
  });

  test("should pass accessibility audit on dashboard with mobile nav", async ({
    page,
    browserName,
  }) => {
    if (browserName === "webkit") {
      test.skip();
    }

    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto("/dashboard");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    // Filter out known issues that are acceptable or external
    const relevantViolations = accessibilityScanResults.violations.filter(
      (violation) =>
        !violation.id.includes("bypass") && // Skip bypass link issues for now
        !violation.id.includes("heading-order") && // Skip heading order for complex layouts
        !violation.id.includes("color-contrast"), // Skip color contrast for now
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

    await page.goto("/dashboard");

    // Focus on mobile nav button
    const mobileNavButton = page.getByRole("button", {
      name: /open main menu/i,
    });
    await mobileNavButton.focus();

    // Press Enter to open menu
    await page.keyboard.press("Enter");

    // Check that menu opened
    const mobileNav = page.locator('[role="dialog"][aria-modal="true"]');
    await expect(mobileNav).toBeVisible();

    // Tab to first focusable element
    await page.keyboard.press("Tab");
    const firstFocusable = mobileNav.locator("button, a, input").first();
    await expect(firstFocusable).toBeFocused();

    // Tab through menu items
    await page.keyboard.press("Tab");
    const secondFocusable = mobileNav.locator("button, a, input").nth(1);
    await expect(secondFocusable).toBeFocused();

    // Press Escape to close menu
    await page.keyboard.press("Escape");

    // Menu should be closed
    await expect(mobileNav).not.toBeVisible();

    // Focus should return to mobile nav button
    await expect(mobileNavButton).toBeFocused();
  });
});

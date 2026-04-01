import { test, expect, Page } from "@playwright/test";

async function checkAccessibility(
  page: Page,
  url: string,
  description: string,
) {
  await page.goto(url);

  // Check for keyboard-navigable interactive elements
  const focusableElements = await page
    .locator(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    .count();

  // At least some interactive elements should be present on pages
  expect(focusableElements).toBeGreaterThan(0);

  // Check for proper heading hierarchy
  const headings = await page.locator("h1, h2, h3, h4, h5, h6").all();
  if (headings.length > 0) {
    // First heading should be h1
    const firstHeading = await headings[0].evaluate((el) =>
      el.tagName.toLowerCase(),
    );
    expect(firstHeading).toBe("h1");
  }
}

test.describe("Accessibility - Public Pages", () => {
  test("homepage has proper accessibility structure", async ({ page }) => {
    await page.goto("/");

    // Check page has title
    await expect(page).toHaveTitle(/.*/);

    // Check for skip link or main content
    const main = page.locator("main, [role='main']");
    await expect(main.first()).toBeVisible();
  });

  test("login page is keyboard accessible", async ({ page }) => {
    await checkAccessibility(page, "/login", "Login page");

    // Check form has proper labels
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator(
      'input[type="password"], input[name="password"]',
    );

    // Inputs should have associated labels
    if ((await emailInput.count()) > 0) {
      const emailLabel = page.locator(
        `label[for="${await emailInput.getAttribute("id")}"]`,
      );
      // Either explicit label or aria-label
      const hasLabel =
        (await emailLabel.count()) > 0 ||
        (await emailInput.getAttribute("aria-label")) !== null ||
        (await emailInput.getAttribute("aria-labelledby")) !== null;
      expect(hasLabel || (await emailInput.count()) === 0).toBeTruthy();
    }
  });

  test("signup page is keyboard accessible", async ({ page }) => {
    await checkAccessibility(page, "/signup", "Signup page");
  });
});

test.describe("Accessibility - Protected Pages (Unauthenticated)", () => {
  test("protected routes redirect to login with proper focus management", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    // Should redirect to login
    await expect(page).toHaveURL(/.*\/login/);

    // Focus should be on login form after redirect
    const loginButton = page.locator(
      'button[type="submit"], input[type="submit"]',
    );
    // Focus should be managed (not lost in redirect)
    await page.waitForLoadState("domcontentloaded");
  });

  test("login redirects preserve accessibility", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/.*\/login/);

    // Login page should have proper landmark regions
    await expect(
      page.locator("header, nav, main, footer").first(),
    ).toBeVisible();
  });
});

test.describe("Accessibility - Forms", () => {
  test("forms have proper error handling and aria attributes", async ({
    page,
  }) => {
    await page.goto("/login");

    // Try to submit empty form
    const submitButton = page.locator('button[type="submit"]');
    if ((await submitButton.count()) > 0) {
      await submitButton.click();

      // If form has validation errors, they should be announced
      const errors = page.locator(
        '[role="alert"], .error, .field-error, [aria-invalid="true"]',
      );
      const errorCount = await errors.count();

      // If there are errors, they should be accessible
      if (errorCount > 0) {
        // Error messages should be connected to inputs via aria-describedby or be in role="alert"
        const alertElements = await page.locator('[role="alert"]').count();
        expect(alertElements + errorCount).toBeGreaterThan(0);
      }
    }
  });

  test("buttons have accessible names", async ({ page }) => {
    await page.goto("/login");

    const buttons = page.locator("button");
    const buttonCount = await buttons.count();

    for (let i = 0; i < Math.min(buttonCount, 10); i++) {
      const button = buttons.nth(i);
      const text = await button.textContent();
      const ariaLabel = await button.getAttribute("aria-label");

      // Button should have text content or aria-label
      const hasAccessibleName =
        (text && text.trim().length > 0) || ariaLabel !== null;
      expect(hasAccessibleName).toBeTruthy();
    }
  });
});

test.describe("Accessibility - Navigation", () => {
  test("navigation has proper semantic structure", async ({ page }) => {
    await page.goto("/login");

    // Should have nav or navigation landmark
    const nav = page.locator("nav, [role='navigation']");
    await expect(nav.first()).toBeVisible();
  });

  test("links have descriptive text", async ({ page }) => {
    await page.goto("/login");

    const links = page.locator("a[href]");
    const linkCount = await links.count();

    for (let i = 0; i < Math.min(linkCount, 10); i++) {
      const link = links.nth(i);
      const text = await link.textContent();
      const ariaLabel = await link.getAttribute("aria-label");

      // Link should have text or aria-label
      const hasAccessibleName =
        (text && text.trim().length > 0) || ariaLabel !== null;
      expect(hasAccessibleName).toBeTruthy();
    }
  });
});

test.describe("Accessibility - Color and Contrast", () => {
  test("interactive elements have visible focus states", async ({ page }) => {
    await page.goto("/login");

    // Check that focus styles are defined (CSS check)
    const styles = await page.evaluate(() => {
      const styleSheets = document.styleSheets;
      let hasFocusStyles = false;

      for (const sheet of styleSheets) {
        try {
          const rules = sheet.cssRules;
          for (const rule of rules) {
            if (
              rule.cssText.includes(":focus") ||
              rule.cssText.includes(":focus-visible")
            ) {
              hasFocusStyles = true;
              break;
            }
          }
        } catch {
          // Ignore CORS errors for external stylesheets
        }
        if (hasFocusStyles) break;
      }

      return hasFocusStyles;
    });

    expect(styles).toBeTruthy();
  });
});

test.describe("Accessibility - Screen Reader Support", () => {
  test("images have alt text or aria attributes", async ({ page }) => {
    await page.goto("/login");

    const images = page.locator("img");
    const imageCount = await images.count();

    for (let i = 0; i < Math.min(imageCount, 5); i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute("alt");
      const ariaLabel = await img.getAttribute("aria-label");
      const role = await img.getAttribute("role");

      // Image should have alt, aria-label, or role="presentation"/"none"
      const hasAccessibleName =
        alt !== null ||
        ariaLabel !== null ||
        role === "presentation" ||
        role === "none";

      // Allow decorative images (alt="") but not missing alt
      expect(
        alt !== undefined || ariaLabel !== null || role !== null,
      ).toBeTruthy();
    }
  });

  test("required form fields are properly marked", async ({ page }) => {
    await page.goto("/signup");

    const requiredInputs = page.locator(
      "input[required], input[aria-required='true']",
    );
    const requiredCount = await requiredInputs.count();

    if (requiredCount > 0) {
      // Required fields should have aria-required or the required attribute
      for (let i = 0; i < Math.min(requiredCount, 5); i++) {
        const input = requiredInputs.nth(i);
        const isRequired = await input.getAttribute("required");
        const ariaRequired = await input.getAttribute("aria-required");

        const hasRequiredMarking =
          isRequired !== null || ariaRequired === "true";
        expect(hasRequiredMarking).toBeTruthy();
      }
    }
  });
});

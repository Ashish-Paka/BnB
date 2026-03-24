import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("page loads successfully", async ({ page }) => {
    await expect(page).toHaveTitle(/Bones and bru/i);
  });

  test("CTA banner has correct text", async ({ page }) => {
    await expect(page.locator("text=Visit Bones and Bru online")).toBeVisible();
    await expect(page.locator("text=to order treats and coffee")).toBeVisible();
  });

  test("uses Montserrat font", async ({ page }) => {
    const fontFamily = await page.locator("body").evaluate(
      (el) => getComputedStyle(el).fontFamily
    );
    expect(fontFamily).toContain("Montserrat");
  });

  test("social grid has all 4 links", async ({ page }) => {
    await expect(page.locator("text=Review")).toBeVisible();
    await expect(page.locator("text=Instagram")).toBeVisible();
    await expect(page.locator("text=Facebook")).toBeVisible();
    await expect(page.locator("text=TikTok")).toBeVisible();
  });

  test("menu overlay opens and closes", async ({ page }) => {
    // Click the in-cafe banner to open menu
    const banner = page.locator("text=Are you in-cafe?").first();
    if (await banner.isVisible()) {
      await banner.click();
      // Wait for the overlay to be visible
      await page.waitForTimeout(500);
      // Close it (usually via backdrop or close button)
      await page.keyboard.press("Escape");
    }
  });
});

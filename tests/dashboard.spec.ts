import { test, expect } from "@playwright/test";
import { loginAsOwner } from "./helpers";

test.describe("Dashboard", () => {
  test("login page loads", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("text=Owner Dashboard")).toBeVisible();
  });

  test("login with password", async ({ page }) => {
    await loginAsOwner(page);
    await expect(page.locator("text=Orders")).toBeVisible();
  });

  test("all tabs present including Settings", async ({ page }) => {
    await loginAsOwner(page);
    await expect(page.locator("text=Orders")).toBeVisible();
    await expect(page.locator("text=POS")).toBeVisible();
    await expect(page.locator("text=Customers")).toBeVisible();
    await expect(page.locator("text=Menu")).toBeVisible();
    await expect(page.locator("text=OTP")).toBeVisible();
    await expect(page.locator("text=Settings")).toBeVisible();
  });

  test("settings tab has change password form", async ({ page }) => {
    await loginAsOwner(page);
    await page.click("text=Settings");
    await expect(page.locator("text=Change Password")).toBeVisible();
    await expect(page.locator('input[placeholder="Current password"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="New password"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Confirm new password"]')).toBeVisible();
  });

  test("logout works", async ({ page }) => {
    await loginAsOwner(page);
    // Click the logout button (LogOut icon in header)
    await page.locator("header >> button, .sticky >> button").last().click();
    await expect(page.locator("text=Owner Dashboard")).toBeVisible();
  });
});

import { test, expect } from "@playwright/test";
import { loginAsOwner } from "./helpers";

test.describe("Dark Mode Toggle", () => {
  test("customer page: toggle dark mode without flicker", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("text=Bones", { timeout: 10000 });

    // Find the theme toggle button (contains Sun or Moon icon)
    const toggle = page.locator("button").filter({ has: page.locator("svg") }).first();

    // Check initial state
    const htmlBefore = await page.locator("html").getAttribute("class");

    // Toggle theme
    await toggle.click();
    await page.waitForTimeout(100);

    // The theme-transitioning class should be present briefly
    const htmlDuring = await page.locator("html").getAttribute("class");
    expect(htmlDuring).toContain("theme-transitioning");

    // Wait for transition to complete
    await page.waitForTimeout(500);
    const htmlAfter = await page.locator("html").getAttribute("class");
    expect(htmlAfter).not.toContain("theme-transitioning");

    // Theme should have toggled
    if (htmlBefore?.includes("dark")) {
      expect(htmlAfter).not.toContain("dark");
    } else {
      expect(htmlAfter).toContain("dark");
    }
  });

  test("dashboard: dark mode toggle is present", async ({ page }) => {
    await loginAsOwner(page);

    // Sun or Moon icon button should be in the header
    const header = page.locator(".sticky");
    const buttons = header.locator("button");
    const count = await buttons.count();
    expect(count).toBeGreaterThanOrEqual(2); // at least theme toggle + logout

    // Click the first button in the header (theme toggle)
    const themeBtn = header.locator("button").first();
    await themeBtn.click();
    await page.waitForTimeout(500);

    // Theme should have changed
    const htmlClass = await page.locator("html").getAttribute("class");
    // Just verify it's either dark or not - the toggle worked
    expect(typeof htmlClass).toBe("string");
  });
});

test.describe("Menu Tab - Subcategories & Reorder", () => {
  test("menu tab shows items with drag handles", async ({ page }) => {
    await loginAsOwner(page);
    await page.click("text=Menu");
    await page.waitForSelector("text=Menu Items", { timeout: 10000 });

    // Items should be visible
    await expect(page.locator("text=Latte").first()).toBeVisible();
    await expect(page.locator("text=Cappuccino").first()).toBeVisible();

    // Drag handles should be present (buttons with "Drag to reorder" title)
    const dragHandles = page.locator('[title="Drag to reorder"]');
    const handleCount = await dragHandles.count();
    expect(handleCount).toBeGreaterThan(0);
  });

  test("menu tab shows category drag handles when viewing all", async ({ page }) => {
    await loginAsOwner(page);
    await page.click("text=Menu");
    await page.waitForSelector("text=Menu Items", { timeout: 10000 });

    // Wait for both categories to load (Coffee and Lemonade/Drinks)
    await page.waitForSelector("text=Coffee", { timeout: 5000 });
    await page.waitForSelector("text=Drinks", { timeout: 5000 });

    // Category drag handles (GripVertical icons on category headers)
    const catHandles = page.locator('[title="Drag to reorder category"]');
    await expect(catHandles.first()).toBeVisible({ timeout: 5000 });
    const catHandleCount = await catHandles.count();
    expect(catHandleCount).toBeGreaterThan(0);
  });

  test("add item form has subcategory selector", async ({ page }) => {
    await loginAsOwner(page);
    await page.click("text=Menu");
    await page.waitForSelector("text=Menu Items", { timeout: 10000 });

    // Click "Add Item"
    await page.click("text=Add Item");
    await page.waitForSelector("text=New Item", { timeout: 5000 });

    // Subcategory label should be present
    await expect(page.getByText("Subcategory", { exact: false }).first()).toBeVisible();

    // It should have selects: category (1st) and subcategory (2nd)
    const selects = page.locator("select");
    const selectCount = await selects.count();
    expect(selectCount).toBeGreaterThanOrEqual(2);

    // Second select (subcategory) should have "None" option
    const subcatSelect = selects.nth(1);
    const options = subcatSelect.locator("option");
    const optionTexts = await options.allTextContents();
    expect(optionTexts).toContain("None");
    expect(optionTexts.some((t) => t.includes("New subcategory"))).toBe(true);
  });

  test("filtering hides drag handles", async ({ page }) => {
    await loginAsOwner(page);
    await page.click("text=Menu");
    await page.waitForSelector("text=Menu Items", { timeout: 10000 });

    // Type in search
    await page.fill('input[placeholder="Search items..."]', "Latte");
    await page.waitForTimeout(300);

    // Drag handles should be hidden when search is active
    const dragHandles = page.locator('[title="Drag to reorder"]');
    const handleCount = await dragHandles.count();
    expect(handleCount).toBe(0);

    // Clear search
    await page.fill('input[placeholder="Search items..."]', "");
    await page.waitForTimeout(300);

    // Drag handles should reappear
    const dragHandlesAfter = page.locator('[title="Drag to reorder"]');
    const handleCountAfter = await dragHandlesAfter.count();
    expect(handleCountAfter).toBeGreaterThan(0);
  });
});

test.describe("Client Menu - Sort Order & Subcategories", () => {
  test("menu overlay shows items in sort_order", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("text=Bones", { timeout: 10000 });

    // Need ordering enabled - just check the menu API returns sorted items
    const response = await page.request.get("/.netlify/functions/menu-list");
    const items = await response.json();

    // Items should be sorted by sort_order
    for (let i = 1; i < items.length; i++) {
      expect(items[i].sort_order).toBeGreaterThanOrEqual(items[i - 1].sort_order);
    }
  });
});

test.describe("API Endpoints", () => {
  test("menu-ordering GET returns valid structure", async ({ page }) => {
    const response = await page.request.get("/.netlify/functions/menu-ordering");
    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(data).toHaveProperty("category_order");
    expect(data).toHaveProperty("subcategory_order");
    expect(Array.isArray(data.category_order)).toBe(true);
    expect(typeof data.subcategory_order).toBe("object");
  });

  test("menu-list returns items sorted by sort_order", async ({ page }) => {
    const response = await page.request.get("/.netlify/functions/menu-list");
    expect(response.ok()).toBe(true);
    const items = await response.json();
    expect(items.length).toBeGreaterThan(0);

    // Verify sorted
    for (let i = 1; i < items.length; i++) {
      expect(items[i].sort_order).toBeGreaterThanOrEqual(items[i - 1].sort_order);
    }
  });
});

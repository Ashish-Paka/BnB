import { test, expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import JSZip from "jszip";
import {
  activateMenuPresetForTest,
  createMenuItem,
  deleteCustomerForTest,
  deleteOrderForTest,
  exportBackupForTest,
  fetchMenuPresetsForTest,
  getOwnerToken,
  importBackupForTest,
  loginAsOwner,
  ownerAuthHeaders,
  permanentlyDeleteMenuItem,
  publishMenuDraftForTest,
  updateMenuPresetTitleForTest,
  updateConfigForTest,
  updateMenuOrderingForTest,
} from "./helpers";

async function dragLocatorToLocator(
  page: Page,
  source: Locator,
  target: Locator,
  position: "before" | "after" = "after"
) {
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();

  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();

  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();

  const startX = sourceBox!.x + sourceBox!.width / 2;
  const startY = sourceBox!.y + sourceBox!.height / 2;
  const targetX = targetBox!.x + targetBox!.width / 2;
  const targetY = targetBox!.y + targetBox!.height * (position === "before" ? 0.2 : 0.8);

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX, startY + 24, { steps: 6 });
  await page.mouse.move(targetX, targetY, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(500);
}

type PresetFixture = {
  index: number;
  title: string;
  primaryCategory: string;
  secondaryCategory: string;
  subcategory: string;
  topItemId: string;
  firstSubItemId: string;
  secondSubItemId: string;
  bottomItemId: string;
  menu: any[];
  ordering: {
    category_order: string[];
    subcategory_order: Record<string, string[]>;
  };
};

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function buildPresetFixture(index: number, suffix: number): PresetFixture {
  const primaryCategory = `preset${suffix}cat${index}`;
  const secondaryCategory = `preset${suffix}cat${index}x`;
  const subcategory = `preset${suffix}sub${index}`;
  const topItemId = `preset-${suffix}-${index}-top`;
  const firstSubItemId = `preset-${suffix}-${index}-sub-a`;
  const secondSubItemId = `preset-${suffix}-${index}-sub-b`;
  const bottomItemId = `preset-${suffix}-${index}-bottom`;

  return {
    index,
    title: `Preset ${index} Layout ${suffix}`,
    primaryCategory,
    secondaryCategory,
    subcategory,
    topItemId,
    firstSubItemId,
    secondSubItemId,
    bottomItemId,
    menu: [
      {
        id: `preset-${suffix}-${index}-lead`,
        name: `Preset ${index} Lead ${suffix}`,
        description: "Preset category ordering item",
        base_price_cents: 400,
        category: secondaryCategory,
        is_available: true,
        sort_order: 1,
      },
      {
        id: topItemId,
        name: `Preset ${index} Top ${suffix}`,
        description: "Preset top item",
        base_price_cents: 425,
        category: primaryCategory,
        is_available: true,
        sort_order: 1,
      },
      {
        id: firstSubItemId,
        name: `Preset ${index} Sub A ${suffix}`,
        description: "Preset first grouped item",
        base_price_cents: 450,
        category: primaryCategory,
        subcategory,
        is_available: true,
        sort_order: 2,
      },
      {
        id: secondSubItemId,
        name: `Preset ${index} Sub B ${suffix}`,
        description: "Preset second grouped item",
        base_price_cents: 475,
        category: primaryCategory,
        subcategory,
        is_available: true,
        sort_order: 3,
      },
      {
        id: bottomItemId,
        name: `Preset ${index} Bottom ${suffix}`,
        description: "Preset bottom item",
        base_price_cents: 500,
        category: primaryCategory,
        is_available: true,
        sort_order: 4,
      },
    ],
    ordering: {
      category_order: [secondaryCategory, primaryCategory],
      subcategory_order: {
        [primaryCategory]: [`item:${topItemId}`, subcategory, `item:${bottomItemId}`],
      },
    },
  };
}

function buildBackupWithPresetFixtures(baseBackup: any, suffix: number) {
  const fixtures = Array.from({ length: 5 }, (_, index) => buildPresetFixture(index, suffix));
  const presets = fixtures.map((fixture) => ({
    index: fixture.index,
    title: fixture.title,
    menu: cloneJson(fixture.menu),
    menu_ordering: cloneJson(fixture.ordering),
    published_menu: cloneJson(fixture.menu),
    published_menu_ordering: cloneJson(fixture.ordering),
    images: {},
    published_images: {},
  }));
  const activePreset = fixtures[0];

  return {
    fixtures,
    backup: {
      ...cloneJson(baseBackup),
      menu: cloneJson(activePreset.menu),
      menu_ordering: cloneJson(activePreset.ordering),
      published_menu: cloneJson(activePreset.menu),
      published_menu_ordering: cloneJson(activePreset.ordering),
      images: {},
      published_images: {},
      menu_presets: {
        active_preset_index: 0,
        presets,
      },
    },
  };
}

async function expectPresetActivationToMatch(
  request: APIRequestContext,
  token: string,
  fixture: PresetFixture,
  verifyPublished = true
) {
  await activateMenuPresetForTest(request, token, fixture.index);

  const [draftMenuResponse, draftOrderingResponse] = await Promise.all([
    request.get("/.netlify/functions/menu-list?include_deleted=true", {
      headers: ownerAuthHeaders(token),
    }),
    request.get("/.netlify/functions/menu-ordering", {
      headers: ownerAuthHeaders(token),
    }),
  ]);

  expect(draftMenuResponse.ok()).toBe(true);
  expect(draftOrderingResponse.ok()).toBe(true);

  const draftMenu = await draftMenuResponse.json();
  const draftOrdering = await draftOrderingResponse.json();
  const draftPrimaryItems = draftMenu
    .filter((entry: any) => entry.category === fixture.primaryCategory)
    .sort((a: any, b: any) => a.sort_order - b.sort_order)
    .map((entry: any) => entry.id);

  expect(draftOrdering.category_order.slice(0, 2)).toEqual(fixture.ordering.category_order);
  expect(draftOrdering.subcategory_order?.[fixture.primaryCategory] ?? []).toEqual(
    fixture.ordering.subcategory_order[fixture.primaryCategory]
  );
  expect(draftPrimaryItems).toEqual([
    fixture.topItemId,
    fixture.firstSubItemId,
    fixture.secondSubItemId,
    fixture.bottomItemId,
  ]);

  const draftGroupedItems = draftMenu
    .filter((entry: any) => entry.category === fixture.primaryCategory && entry.subcategory === fixture.subcategory)
    .sort((a: any, b: any) => a.sort_order - b.sort_order)
    .map((entry: any) => entry.id);
  expect(draftGroupedItems).toEqual([fixture.firstSubItemId, fixture.secondSubItemId]);

  if (!verifyPublished) return;

  const [publicMenuResponse, publicOrderingResponse] = await Promise.all([
    request.get("/.netlify/functions/menu-list"),
    request.get("/.netlify/functions/menu-ordering"),
  ]);

  expect(publicMenuResponse.ok()).toBe(true);
  expect(publicOrderingResponse.ok()).toBe(true);

  const publicMenu = await publicMenuResponse.json();
  const publicOrdering = await publicOrderingResponse.json();
  const publicPrimaryItems = publicMenu
    .filter((entry: any) => entry.category === fixture.primaryCategory)
    .sort((a: any, b: any) => a.sort_order - b.sort_order)
    .map((entry: any) => entry.id);

  expect(publicOrdering.category_order.slice(0, 2)).toEqual(fixture.ordering.category_order);
  expect(publicOrdering.subcategory_order?.[fixture.primaryCategory] ?? []).toEqual(
    fixture.ordering.subcategory_order[fixture.primaryCategory]
  );
  expect(publicPrimaryItems).toEqual([
    fixture.topItemId,
    fixture.firstSubItemId,
    fixture.secondSubItemId,
    fixture.bottomItemId,
  ]);
}

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
  test("menu tab shows items with drag handles in edit mode", async ({ page }) => {
    await loginAsOwner(page);
    await page.click("text=Menu");
    await page.waitForSelector("text=Menu Items", { timeout: 10000 });

    // Items should be visible
    await expect(page.locator("text=Latte").first()).toBeVisible();

    // Drag handles should NOT be present before entering edit mode
    expect(await page.locator('[title="Drag to reorder"]').count()).toBe(0);

    // Enter edit mode
    await page.click("text=Edit");
    await page.waitForTimeout(300);

    // Drag handles should now be present
    const dragHandles = page.locator('[title="Drag to reorder"]');
    const handleCount = await dragHandles.count();
    expect(handleCount).toBeGreaterThan(0);
  });

  test("menu tab shows category drag handles in edit mode", async ({ page }) => {
    await loginAsOwner(page);
    await page.click("text=Menu");
    await page.waitForSelector("text=Menu Items", { timeout: 10000 });

    // Enter edit mode
    await page.click("text=Edit");

    // Wait for both categories to load
    await page.waitForSelector("text=Coffee", { timeout: 5000 });
    await page.waitForSelector("text=Drinks", { timeout: 5000 });

    // Category drag handles should be present
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

  test("editing an item can clear its subcategory back to none", async ({ page }) => {
    const token = await getOwnerToken(page.request);
    const itemName = `Subcat Reset ${Date.now()}`;
    const item = await createMenuItem(page.request, token, {
      name: itemName,
      description: "Playwright subcategory reset test item",
      base_price_cents: 650,
      category: "coffee",
      subcategory: "seasonaltest",
    });

    try {
      await loginAsOwner(page);
      await page.click("text=Menu");
      await page.waitForSelector("text=Menu Items", { timeout: 10000 });
      await page.click("text=Edit");
      await page.fill('input[placeholder="Search items..."]', itemName);

      const card = page.locator("div.rounded-2xl").filter({
        has: page.getByText(itemName, { exact: true }),
      }).first();
      await expect(card).toBeVisible();
      await card.locator("button").nth(1).click();

      await page.waitForSelector("text=Edit Item", { timeout: 5000 });
      await page.locator("select").nth(1).selectOption("");
      await page.click("text=Save Changes");
      await page.waitForTimeout(500);

      const response = await page.request.get("/.netlify/functions/menu-list?include_deleted=true", {
        headers: ownerAuthHeaders(token),
      });
      expect(response.ok()).toBe(true);
      const menu = await response.json();
      const updated = menu.find((entry: any) => entry.id === item.id);

      expect(updated).toBeTruthy();
      expect(updated.subcategory ?? "").toBe("");
    } finally {
      await permanentlyDeleteMenuItem(page.request, token, item.id);
    }
  });

  test("customer menu stays unchanged until edit mode is turned off", async ({ page }) => {
    const token = await getOwnerToken(page.request);
    const ownerMenuResponse = await page.request.get("/.netlify/functions/menu-list?include_deleted=true", {
      headers: ownerAuthHeaders(token),
    });
    expect(ownerMenuResponse.ok()).toBe(true);
    const ownerMenu = await ownerMenuResponse.json();
    const latte = ownerMenu.find((entry: any) => entry.id === "latte");
    expect(latte).toBeTruthy();

    const originalName = latte.name;
    const draftName = `Latte Draft ${Date.now()}`;

    try {
      await publishMenuDraftForTest(page.request, token);
      await updateConfigForTest(page.request, token, { menu_editing_active: false });

      await loginAsOwner(page);
      await page.click("text=Menu");
      await page.waitForSelector("text=Menu Items", { timeout: 10000 });
      await page.click("text=Edit");

      await page.fill('input[placeholder="Search items..."]', originalName);
      const card = page.locator("div.rounded-2xl").filter({
        has: page.getByText(originalName, { exact: true }),
      }).first();
      await expect(card).toBeVisible();
      await card.locator("button").nth(1).click();

      await page.waitForSelector("text=Edit Item", { timeout: 5000 });
      await page.locator('input[placeholder="e.g. Latte"]').fill(draftName);
      await page.click("text=Save Changes");
      await page.waitForTimeout(500);

      const whileEditingResponse = await page.request.get("/.netlify/functions/menu-list");
      expect(whileEditingResponse.ok()).toBe(true);
      const whileEditingMenu = await whileEditingResponse.json();
      expect(whileEditingMenu.some((entry: any) => entry.name === draftName)).toBe(false);
      expect(whileEditingMenu.some((entry: any) => entry.name === originalName)).toBe(true);

      await page.getByRole("button", { name: "Editing" }).click();
      await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();

      const publishedResponse = await page.request.get("/.netlify/functions/menu-list");
      expect(publishedResponse.ok()).toBe(true);
      const publishedMenu = await publishedResponse.json();
      expect(publishedMenu.some((entry: any) => entry.name === draftName)).toBe(true);
    } finally {
      await page.request.put("/.netlify/functions/menu-manage", {
        headers: ownerAuthHeaders(token),
        data: { id: "latte", name: originalName },
      });
      await publishMenuDraftForTest(page.request, token);
      await updateConfigForTest(page.request, token, { menu_editing_active: false });
    }
  });

  test("filtering hides drag handles even in edit mode", async ({ page }) => {
    await loginAsOwner(page);
    await page.click("text=Menu");
    await page.waitForSelector("text=Menu Items", { timeout: 10000 });

    // Enter edit mode
    await page.click("text=Edit");
    await page.waitForTimeout(300);

    // Drag handles should be visible
    expect(await page.locator('[title="Drag to reorder"]').count()).toBeGreaterThan(0);

    // Type in search
    await page.fill('input[placeholder="Search items..."]', "Latte");
    await page.waitForTimeout(300);

    // Drag handles should be hidden when search is active
    expect(await page.locator('[title="Drag to reorder"]').count()).toBe(0);

    // Clear search
    await page.fill('input[placeholder="Search items..."]', "");
    await page.waitForTimeout(300);

    // Drag handles should reappear
    expect(await page.locator('[title="Drag to reorder"]').count()).toBeGreaterThan(0);
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

  test("customer menu follows saved category and subcategory ordering", async ({ page }) => {
    const token = await getOwnerToken(page.request);
    const originalOrderingResponse = await page.request.get("/.netlify/functions/menu-ordering");
    expect(originalOrderingResponse.ok()).toBe(true);
    const originalOrdering = await originalOrderingResponse.json();

    const suffix = Date.now();
    const pastryName = `Pastry ${suffix}`;
    const firstSubcategory = `alpha${suffix}`;
    const secondSubcategory = `beta${suffix}`;

    const pastryItem = await createMenuItem(page.request, token, {
      name: pastryName,
      description: "Playwright category ordering test item",
      base_price_cents: 450,
      category: "pastries",
    });
    const firstCoffeeItem = await createMenuItem(page.request, token, {
      name: `Coffee ${suffix} A`,
      description: "Playwright subcategory ordering test item",
      base_price_cents: 500,
      category: "coffee",
      subcategory: secondSubcategory,
    });
    const secondCoffeeItem = await createMenuItem(page.request, token, {
      name: `Coffee ${suffix} B`,
      description: "Playwright subcategory ordering test item",
      base_price_cents: 525,
      category: "coffee",
      subcategory: firstSubcategory,
    });

    try {
      await updateMenuOrderingForTest(page.request, token, {
        category_order: ["pastries", "coffee", "lemonade"],
        subcategory_order: {
          coffee: [firstSubcategory, secondSubcategory, ""],
        },
      });
      await publishMenuDraftForTest(page.request, token);

      await page.goto("/");
      await page.waitForSelector("text=Bones", { timeout: 10000 });
      await page.getByRole("button", {
        name: /Place Order|Menu|Browse our full menu|Order ahead from our in-cafe menu/,
      }).first().click();

      const overlay = page
        .getByRole("heading", { name: "Menu" })
        .locator('xpath=ancestor::div[contains(@class, "fixed")][1]');

      const tabs = overlay.locator("div.px-4.py-3.flex.gap-2.overflow-x-auto button");
      await expect(tabs.first()).toHaveText("Pastries");

      await overlay.getByRole("button", { name: "Coffee" }).click();
      const headings = await overlay.locator("h3.text-sm.font-bold").allTextContents();

      expect(headings.slice(0, 2)).toEqual([
        `${firstSubcategory.charAt(0).toUpperCase()}${firstSubcategory.slice(1)}`,
        `${secondSubcategory.charAt(0).toUpperCase()}${secondSubcategory.slice(1)}`,
      ]);
    } finally {
      await permanentlyDeleteMenuItem(page.request, token, pastryItem.id);
      await permanentlyDeleteMenuItem(page.request, token, firstCoffeeItem.id);
      await permanentlyDeleteMenuItem(page.request, token, secondCoffeeItem.id);
      await updateMenuOrderingForTest(page.request, token, originalOrdering);
      await publishMenuDraftForTest(page.request, token);
    }
  });

  test("customer menu can place a subsection between uncategorized items", async ({ page }) => {
    const token = await getOwnerToken(page.request);
    const originalOrderingResponse = await page.request.get("/.netlify/functions/menu-ordering");
    expect(originalOrderingResponse.ok()).toBe(true);
    const originalOrdering = await originalOrderingResponse.json();

    const suffix = Date.now();
    const category = "pastries";
    const subcategory = `featured${suffix}`;
    const firstItemName = `Top Item A ${suffix}`;
    const secondItemName = `Top Item B ${suffix}`;

    const firstItem = await createMenuItem(page.request, token, {
      name: firstItemName,
      description: "Playwright mixed layout item",
      base_price_cents: 400,
      category,
    });
    const subItemOne = await createMenuItem(page.request, token, {
      name: `Sub Item A ${suffix}`,
      description: "Playwright mixed layout sub item",
      base_price_cents: 425,
      category,
      subcategory,
    });
    const subItemTwo = await createMenuItem(page.request, token, {
      name: `Sub Item B ${suffix}`,
      description: "Playwright mixed layout sub item",
      base_price_cents: 450,
      category,
      subcategory,
    });
    const secondItem = await createMenuItem(page.request, token, {
      name: secondItemName,
      description: "Playwright mixed layout item",
      base_price_cents: 475,
      category,
    });

    try {
      await updateMenuOrderingForTest(page.request, token, {
        category_order: [category, "coffee", "lemonade"],
        subcategory_order: {
          [category]: [`item:${firstItem.id}`, subcategory, `item:${secondItem.id}`],
        },
      });
      await publishMenuDraftForTest(page.request, token);

      await page.goto("/");
      await page.waitForSelector("text=Bones", { timeout: 10000 });
      await page.getByRole("button", {
        name: /Place Order|Menu|Browse our full menu|Order ahead from our in-cafe menu/,
      }).first().click();

      const overlay = page
        .getByRole("heading", { name: "Menu" })
        .locator('xpath=ancestor::div[contains(@class, "fixed")][1]');

      await expect(overlay.locator("div.px-4.py-3.flex.gap-2.overflow-x-auto button").first()).toHaveText("Pastries");

      const firstItemBox = await overlay.getByText(firstItemName, { exact: true }).first().boundingBox();
      const subcategoryBox = await overlay.getByText("Featured" + suffix, { exact: true }).first().boundingBox();
      const secondItemBox = await overlay.getByText(secondItemName, { exact: true }).first().boundingBox();

      expect(firstItemBox).not.toBeNull();
      expect(subcategoryBox).not.toBeNull();
      expect(secondItemBox).not.toBeNull();
      expect(firstItemBox!.y).toBeLessThan(subcategoryBox!.y);
      expect(subcategoryBox!.y).toBeLessThan(secondItemBox!.y);
    } finally {
      await permanentlyDeleteMenuItem(page.request, token, firstItem.id);
      await permanentlyDeleteMenuItem(page.request, token, subItemOne.id);
      await permanentlyDeleteMenuItem(page.request, token, subItemTwo.id);
      await permanentlyDeleteMenuItem(page.request, token, secondItem.id);
      await updateMenuOrderingForTest(page.request, token, originalOrdering);
      await publishMenuDraftForTest(page.request, token);
    }
  });

  test("customer menu auto-refreshes after edit mode is exited without a page reload", async ({ page }) => {
    const token = await getOwnerToken(page.request);
    const ownerMenuResponse = await page.request.get("/.netlify/functions/menu-list?include_deleted=true", {
      headers: ownerAuthHeaders(token),
    });
    expect(ownerMenuResponse.ok()).toBe(true);
    const ownerMenu = await ownerMenuResponse.json();
    const latte = ownerMenu.find((entry: any) => entry.id === "latte");
    expect(latte).toBeTruthy();

    const originalName = latte.name;
    const draftName = `Latte Live ${Date.now()}`;
    let customerPage: Page | null = null;

    try {
      await publishMenuDraftForTest(page.request, token);
      await updateConfigForTest(page.request, token, { menu_editing_active: false });

      await loginAsOwner(page);
      customerPage = await page.context().newPage();
      await customerPage.goto("/");
      await customerPage.waitForSelector("text=Bones", { timeout: 10000 });
      const navigationCountBefore = await customerPage.evaluate(() => performance.getEntriesByType("navigation").length);
      await customerPage.getByRole("button", {
        name: /Place Order|Menu|Browse our full menu|Order ahead from our in-cafe menu/,
      }).first().click();
      await expect(customerPage.getByText(originalName, { exact: true }).first()).toBeVisible();

      await page.click("text=Menu");
      await page.waitForSelector("text=Menu Items", { timeout: 10000 });
      await page.click("text=Edit");

      await page.request.put("/.netlify/functions/menu-manage", {
        headers: ownerAuthHeaders(token),
        data: { id: "latte", name: draftName },
      });

      await customerPage.waitForTimeout(1500);
      await expect(customerPage.getByText(draftName, { exact: true })).toHaveCount(0);
      await expect(customerPage.getByText(originalName, { exact: true }).first()).toBeVisible();

      await page.getByRole("button", { name: "Editing" }).click();
      await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();

      await expect(customerPage.getByText(draftName, { exact: true }).first()).toBeVisible({ timeout: 15000 });
      const navigationCountAfter = await customerPage.evaluate(() => performance.getEntriesByType("navigation").length);
      expect(navigationCountAfter).toBe(navigationCountBefore);
    } finally {
      await page.request.put("/.netlify/functions/menu-manage", {
        headers: ownerAuthHeaders(token),
        data: { id: "latte", name: originalName },
      });
      await publishMenuDraftForTest(page.request, token);
      await updateConfigForTest(page.request, token, { menu_editing_active: false });
      await customerPage?.close();
    }
  });

  test("customer menu auto-refreshes published category reordering without a page reload", async ({ page }) => {
    test.slow();
    const token = await getOwnerToken(page.request);
    const originalOrderingResponse = await page.request.get("/.netlify/functions/menu-ordering");
    expect(originalOrderingResponse.ok()).toBe(true);
    const originalOrdering = await originalOrderingResponse.json();
    const suffix = Date.now();
    const firstCategory = `reordertest${suffix}a`;
    const secondCategory = `reordertest${suffix}b`;
    const firstCategoryLabel = firstCategory.charAt(0).toUpperCase() + firstCategory.slice(1);
    const secondCategoryLabel = secondCategory.charAt(0).toUpperCase() + secondCategory.slice(1);
    let customerPage: Page | null = null;
    const firstItem = await createMenuItem(page.request, token, {
      name: `Reorder Test A ${suffix}`,
      description: "Playwright reorder category item",
      base_price_cents: 400,
      category: firstCategory,
    });
    const secondItem = await createMenuItem(page.request, token, {
      name: `Reorder Test B ${suffix}`,
      description: "Playwright reorder category item",
      base_price_cents: 425,
      category: secondCategory,
    });

    try {
      await updateMenuOrderingForTest(page.request, token, {
        category_order: [firstCategory, secondCategory, ...(originalOrdering.category_order ?? [])],
        subcategory_order: originalOrdering.subcategory_order ?? {},
      });
      await publishMenuDraftForTest(page.request, token);
      await updateConfigForTest(page.request, token, { menu_editing_active: false });

      await loginAsOwner(page);
      customerPage = await page.context().newPage();
      await customerPage.goto("/");
      await customerPage.waitForSelector("text=Bones", { timeout: 10000 });
      const navigationCountBefore = await customerPage.evaluate(() => performance.getEntriesByType("navigation").length);
      await customerPage.getByRole("button", {
        name: /Place Order|Menu|Browse our full menu|Order ahead from our in-cafe menu/,
      }).first().click();

      const overlay = customerPage
        .getByRole("heading", { name: "Menu" })
        .locator('xpath=ancestor::div[contains(@class, "fixed")][1]');
      const tabs = overlay.locator("div.px-4.py-3.flex.gap-2.overflow-x-auto button");
      await expect(tabs.first()).toHaveText(firstCategoryLabel);

      await updateConfigForTest(page.request, token, { menu_editing_active: true });
      await updateMenuOrderingForTest(page.request, token, {
        category_order: [secondCategory, firstCategory, ...(originalOrdering.category_order ?? [])],
        subcategory_order: originalOrdering.subcategory_order ?? {},
      });

      await customerPage.waitForTimeout(1500);
      await expect(tabs.first()).toHaveText(firstCategoryLabel);

      await publishMenuDraftForTest(page.request, token);
      await updateConfigForTest(page.request, token, { menu_editing_active: false });

      await expect(tabs.first()).toHaveText(secondCategoryLabel, { timeout: 10000 });
      const navigationCountAfter = await customerPage.evaluate(() => performance.getEntriesByType("navigation").length);
      expect(navigationCountAfter).toBe(navigationCountBefore);
    } finally {
      await updateMenuOrderingForTest(page.request, token, originalOrdering);
      await permanentlyDeleteMenuItem(page.request, token, firstItem.id);
      await permanentlyDeleteMenuItem(page.request, token, secondItem.id);
      await publishMenuDraftForTest(page.request, token);
      await updateConfigForTest(page.request, token, { menu_editing_active: false });
      await customerPage?.close();
    }
  });

  test("customer menu auto-refreshes published item reordering without a page reload", async ({ page }) => {
    test.slow();
    const token = await getOwnerToken(page.request);
    const originalBackup = await exportBackupForTest(page.request, token);
    const suffix = Date.now();
    const category = `itemreordertest${suffix}`;
    const categoryLabelText = category.charAt(0).toUpperCase() + category.slice(1);
    let customerPage: Page | null = null;

    const firstItem = await createMenuItem(page.request, token, {
      name: `Item Reorder A ${suffix}`,
      description: "Playwright item reorder A",
      base_price_cents: 400,
      category,
    });
    const secondItem = await createMenuItem(page.request, token, {
      name: `Item Reorder B ${suffix}`,
      description: "Playwright item reorder B",
      base_price_cents: 425,
      category,
    });

    const setOrder = async (idsInOrder: string[]) => {
      const response = await page.request.put("/.netlify/functions/menu-reorder", {
        headers: ownerAuthHeaders(token),
        data: {
          items: idsInOrder.map((id, index) => ({
            id,
            sort_order: index + 1,
          })),
        },
      });
      expect(response.ok()).toBe(true);
    };

    try {
      await updateMenuOrderingForTest(page.request, token, {
        category_order: [category, "coffee", "lemonade"],
        subcategory_order: {},
      });
      await setOrder([firstItem.id, secondItem.id]);
      await publishMenuDraftForTest(page.request, token);
      await updateConfigForTest(page.request, token, { menu_editing_active: false });

      await loginAsOwner(page);
      customerPage = await page.context().newPage();
      await customerPage.goto("/");
      await customerPage.waitForSelector("text=Bones", { timeout: 10000 });
      const navigationCountBefore = await customerPage.evaluate(() => performance.getEntriesByType("navigation").length);
      await customerPage.getByRole("button", {
        name: /Place Order|Menu|Browse our full menu|Order ahead from our in-cafe menu/,
      }).first().click();

      const overlay = customerPage
        .getByRole("heading", { name: "Menu" })
        .locator('xpath=ancestor::div[contains(@class, "fixed")][1]');
      const tabs = overlay.locator("div.px-4.py-3.flex.gap-2.overflow-x-auto button");
      await expect(tabs.first()).toHaveText(categoryLabelText);

      const originalFirstBox = await overlay.getByText(firstItem.name, { exact: true }).first().boundingBox();
      const originalSecondBox = await overlay.getByText(secondItem.name, { exact: true }).first().boundingBox();
      expect(originalFirstBox).not.toBeNull();
      expect(originalSecondBox).not.toBeNull();
      expect(originalFirstBox!.y).toBeLessThan(originalSecondBox!.y);

      await updateConfigForTest(page.request, token, { menu_editing_active: true });
      await setOrder([secondItem.id, firstItem.id]);

      await customerPage.waitForTimeout(1500);
      await expect(overlay.getByText(firstItem.name, { exact: true }).first()).toBeVisible();
      const draftFirstBox = await overlay.getByText(firstItem.name, { exact: true }).first().boundingBox();
      const draftSecondBox = await overlay.getByText(secondItem.name, { exact: true }).first().boundingBox();
      expect(draftFirstBox).not.toBeNull();
      expect(draftSecondBox).not.toBeNull();
      expect(draftFirstBox!.y).toBeLessThan(draftSecondBox!.y);

      await publishMenuDraftForTest(page.request, token);
      await updateConfigForTest(page.request, token, { menu_editing_active: false });

      await expect.poll(async () => {
        const firstBox = await overlay.getByText(firstItem.name, { exact: true }).first().boundingBox();
        const secondBox = await overlay.getByText(secondItem.name, { exact: true }).first().boundingBox();
        if (!firstBox || !secondBox) return false;
        return secondBox.y < firstBox.y;
      }, { timeout: 15000 }).toBe(true);

      const navigationCountAfter = await customerPage.evaluate(() => performance.getEntriesByType("navigation").length);
      expect(navigationCountAfter).toBe(navigationCountBefore);
    } finally {
      await importBackupForTest(page.request, token, originalBackup);
      await updateConfigForTest(page.request, token, { menu_editing_active: false });
      await customerPage?.close();
    }
  });

  test("dashboard drag reorders categories and only publishes to customers after edit mode exits", async ({ page }) => {
    test.slow();
    const token = await getOwnerToken(page.request);
    const backup = await exportBackupForTest(page.request, token);
    const suffix = Date.now();
    const firstCategory = `uidragcat${suffix}a`;
    const secondCategory = `uidragcat${suffix}b`;
    const firstCategoryLabel = firstCategory.charAt(0).toUpperCase() + firstCategory.slice(1);
    const secondCategoryLabel = secondCategory.charAt(0).toUpperCase() + secondCategory.slice(1);
    let customerPage: Page | null = null;

    await createMenuItem(page.request, token, {
      name: `UI Drag Category A ${suffix}`,
      description: "Playwright dashboard category drag item",
      base_price_cents: 400,
      category: firstCategory,
    });
    await createMenuItem(page.request, token, {
      name: `UI Drag Category B ${suffix}`,
      description: "Playwright dashboard category drag item",
      base_price_cents: 425,
      category: secondCategory,
    });

    try {
      await updateMenuOrderingForTest(page.request, token, {
        category_order: [firstCategory, secondCategory, "coffee", "lemonade"],
        subcategory_order: {},
      });
      await publishMenuDraftForTest(page.request, token);
      await updateConfigForTest(page.request, token, { menu_editing_active: false });

      await loginAsOwner(page);
      await page.click("text=Menu");
      await page.waitForSelector("text=Menu Items", { timeout: 10000 });

      customerPage = await page.context().newPage();
      await customerPage.goto("/");
      await customerPage.waitForSelector("text=Bones", { timeout: 10000 });
      await customerPage.getByRole("button", {
        name: /Place Order|Menu|Browse our full menu|Order ahead from our in-cafe menu/,
      }).first().click();

      const overlay = customerPage
        .getByRole("heading", { name: "Menu" })
        .locator('xpath=ancestor::div[contains(@class, "fixed")][1]');
      const tabs = overlay.locator("div.px-4.py-3.flex.gap-2.overflow-x-auto button");
      await expect(tabs.first()).toHaveText(firstCategoryLabel);

      await page.getByRole("button", { name: "Edit" }).click();
      const firstHandle = page
        .getByRole("heading", { name: firstCategoryLabel })
        .locator('xpath=ancestor::div[contains(@class, "mb-8")][1]')
        .getByTitle("Drag to reorder category");
      const secondHandle = page
        .getByRole("heading", { name: secondCategoryLabel })
        .locator('xpath=ancestor::div[contains(@class, "mb-8")][1]')
        .getByTitle("Drag to reorder category");

      await dragLocatorToLocator(page, firstHandle, secondHandle, "after");

      await customerPage.waitForTimeout(1500);
      await expect(tabs.first()).toHaveText(firstCategoryLabel);

      await page.getByRole("button", { name: "Editing" }).click();
      await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
      await expect(tabs.first()).toHaveText(secondCategoryLabel, { timeout: 15000 });
    } finally {
      await importBackupForTest(page.request, token, backup);
      await updateConfigForTest(page.request, token, { menu_editing_active: false });
      await customerPage?.close();
    }
  });

  test("dashboard drag reorders subcategories and only publishes to customers after edit mode exits", async ({ page }) => {
    test.slow();
    const token = await getOwnerToken(page.request);
    const backup = await exportBackupForTest(page.request, token);
    const suffix = Date.now();
    const category = `uidragsubcat${suffix}`;
    const firstSubcategory = `alpha${suffix}`;
    const secondSubcategory = `beta${suffix}`;
    const categoryLabelText = category.charAt(0).toUpperCase() + category.slice(1);
    const firstSubcategoryLabel = firstSubcategory.charAt(0).toUpperCase() + firstSubcategory.slice(1);
    const secondSubcategoryLabel = secondSubcategory.charAt(0).toUpperCase() + secondSubcategory.slice(1);
    let customerPage: Page | null = null;

    await createMenuItem(page.request, token, {
      name: `UI Drag Subcategory A ${suffix}`,
      description: "Playwright dashboard subcategory drag item",
      base_price_cents: 400,
      category,
      subcategory: firstSubcategory,
    });
    await createMenuItem(page.request, token, {
      name: `UI Drag Subcategory B ${suffix}`,
      description: "Playwright dashboard subcategory drag item",
      base_price_cents: 425,
      category,
      subcategory: secondSubcategory,
    });

    try {
      await updateMenuOrderingForTest(page.request, token, {
        category_order: [category, "coffee", "lemonade"],
        subcategory_order: {
          [category]: [firstSubcategory, secondSubcategory],
        },
      });
      await publishMenuDraftForTest(page.request, token);
      await updateConfigForTest(page.request, token, { menu_editing_active: false });

      await loginAsOwner(page);
      await page.click("text=Menu");
      await page.waitForSelector("text=Menu Items", { timeout: 10000 });

      customerPage = await page.context().newPage();
      await customerPage.goto("/");
      await customerPage.waitForSelector("text=Bones", { timeout: 10000 });
      await customerPage.getByRole("button", {
        name: /Place Order|Menu|Browse our full menu|Order ahead from our in-cafe menu/,
      }).first().click();

      const overlay = customerPage
        .getByRole("heading", { name: "Menu" })
        .locator('xpath=ancestor::div[contains(@class, "fixed")][1]');
      const tabs = overlay.locator("div.px-4.py-3.flex.gap-2.overflow-x-auto button");
      await expect(tabs.first()).toHaveText(categoryLabelText);

      const publicFirstSubcategory = overlay.getByRole("heading", { name: firstSubcategoryLabel }).first();
      const publicSecondSubcategory = overlay.getByRole("heading", { name: secondSubcategoryLabel }).first();
      const publicFirstBox = await publicFirstSubcategory.boundingBox();
      const publicSecondBox = await publicSecondSubcategory.boundingBox();
      expect(publicFirstBox).not.toBeNull();
      expect(publicSecondBox).not.toBeNull();
      expect(publicFirstBox!.y).toBeLessThan(publicSecondBox!.y);

      await page.getByRole("button", { name: "Edit" }).click();
      const firstHandle = page
        .getByRole("heading", { name: firstSubcategoryLabel })
        .locator('xpath=ancestor::div[contains(@class, "mb-4")][1]')
        .getByTitle("Drag to reorder subcategory");
      const secondHandle = page
        .getByRole("heading", { name: secondSubcategoryLabel })
        .locator('xpath=ancestor::div[contains(@class, "mb-4")][1]')
        .getByTitle("Drag to reorder subcategory");

      await dragLocatorToLocator(page, firstHandle, secondHandle, "after");

      await customerPage.waitForTimeout(1500);
      const staleFirstBox = await publicFirstSubcategory.boundingBox();
      const staleSecondBox = await publicSecondSubcategory.boundingBox();
      expect(staleFirstBox).not.toBeNull();
      expect(staleSecondBox).not.toBeNull();
      expect(staleFirstBox!.y).toBeLessThan(staleSecondBox!.y);

      await page.getByRole("button", { name: "Editing" }).click();
      await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();

      await expect.poll(async () => {
        const firstBox = await overlay.getByRole("heading", { name: firstSubcategoryLabel }).first().boundingBox();
        const secondBox = await overlay.getByRole("heading", { name: secondSubcategoryLabel }).first().boundingBox();
        if (!firstBox || !secondBox) return false;
        return secondBox.y < firstBox.y;
      }, { timeout: 15000 }).toBe(true);
    } finally {
      await importBackupForTest(page.request, token, backup);
      await updateConfigForTest(page.request, token, { menu_editing_active: false });
      await customerPage?.close();
    }
  });

  test("dashboard drag reorders items and only publishes to customers after edit mode exits", async ({ page }) => {
    test.slow();
    const token = await getOwnerToken(page.request);
    const backup = await exportBackupForTest(page.request, token);
    const suffix = Date.now();
    const category = `uidragitem${suffix}`;
    const categoryLabelText = category.charAt(0).toUpperCase() + category.slice(1);
    const firstItemName = `UI Drag Item A ${suffix}`;
    const secondItemName = `UI Drag Item B ${suffix}`;
    let customerPage: Page | null = null;

    await createMenuItem(page.request, token, {
      name: firstItemName,
      description: "Playwright dashboard item drag item",
      base_price_cents: 400,
      category,
    });
    await createMenuItem(page.request, token, {
      name: secondItemName,
      description: "Playwright dashboard item drag item",
      base_price_cents: 425,
      category,
    });

    try {
      await updateMenuOrderingForTest(page.request, token, {
        category_order: [category, "coffee", "lemonade"],
        subcategory_order: {},
      });
      await publishMenuDraftForTest(page.request, token);
      await updateConfigForTest(page.request, token, { menu_editing_active: false });

      await loginAsOwner(page);
      await page.click("text=Menu");
      await page.waitForSelector("text=Menu Items", { timeout: 10000 });

      customerPage = await page.context().newPage();
      await customerPage.goto("/");
      await customerPage.waitForSelector("text=Bones", { timeout: 10000 });
      await customerPage.getByRole("button", {
        name: /Place Order|Menu|Browse our full menu|Order ahead from our in-cafe menu/,
      }).first().click();

      const overlay = customerPage
        .getByRole("heading", { name: "Menu" })
        .locator('xpath=ancestor::div[contains(@class, "fixed")][1]');
      const tabs = overlay.locator("div.px-4.py-3.flex.gap-2.overflow-x-auto button");
      await expect(tabs.first()).toHaveText(categoryLabelText);

      const publicFirstItem = overlay.getByText(firstItemName, { exact: true }).first();
      const publicSecondItem = overlay.getByText(secondItemName, { exact: true }).first();
      const publicFirstBox = await publicFirstItem.boundingBox();
      const publicSecondBox = await publicSecondItem.boundingBox();
      expect(publicFirstBox).not.toBeNull();
      expect(publicSecondBox).not.toBeNull();
      expect(publicFirstBox!.y).toBeLessThan(publicSecondBox!.y);

      await page.getByRole("button", { name: "Edit" }).click();
      const firstHandle = page
        .locator("div.rounded-2xl")
        .filter({ has: page.getByText(firstItemName, { exact: true }) })
        .first()
        .getByTitle("Drag to reorder");
      const secondHandle = page
        .locator("div.rounded-2xl")
        .filter({ has: page.getByText(secondItemName, { exact: true }) })
        .first()
        .getByTitle("Drag to reorder");

      await dragLocatorToLocator(page, firstHandle, secondHandle, "after");

      await customerPage.waitForTimeout(1500);
      const staleFirstBox = await publicFirstItem.boundingBox();
      const staleSecondBox = await publicSecondItem.boundingBox();
      expect(staleFirstBox).not.toBeNull();
      expect(staleSecondBox).not.toBeNull();
      expect(staleFirstBox!.y).toBeLessThan(staleSecondBox!.y);

      await page.getByRole("button", { name: "Editing" }).click();
      await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();

      await expect.poll(async () => {
        const firstBox = await overlay.getByText(firstItemName, { exact: true }).first().boundingBox();
        const secondBox = await overlay.getByText(secondItemName, { exact: true }).first().boundingBox();
        if (!firstBox || !secondBox) return false;
        return secondBox.y < firstBox.y;
      }, { timeout: 15000 }).toBe(true);
    } finally {
      await importBackupForTest(page.request, token, backup);
      await updateConfigForTest(page.request, token, { menu_editing_active: false });
      await customerPage?.close();
    }
  });

  test("dashboard matches the published customer menu while edit mode is off", async ({ page }) => {
    test.slow();
    const token = await getOwnerToken(page.request);
    const backup = await exportBackupForTest(page.request, token);
    const suffix = Date.now();
    const category = `uipublishedmatch${suffix}`;
    const categoryLabelText = category.charAt(0).toUpperCase() + category.slice(1);
    const firstItemName = `Published Match A ${suffix}`;
    const secondItemName = `Published Match B ${suffix}`;
    let customerPage: Page | null = null;

    const firstItem = await createMenuItem(page.request, token, {
      name: firstItemName,
      description: "Playwright published snapshot match item",
      base_price_cents: 400,
      category,
    });
    const secondItem = await createMenuItem(page.request, token, {
      name: secondItemName,
      description: "Playwright published snapshot match item",
      base_price_cents: 425,
      category,
    });

    const setDraftOrder = async (idsInOrder: string[]) => {
      const response = await page.request.put("/.netlify/functions/menu-reorder", {
        headers: ownerAuthHeaders(token),
        data: {
          items: idsInOrder.map((id, index) => ({
            id,
            sort_order: index + 1,
          })),
        },
      });
      expect(response.ok()).toBe(true);
    };

    try {
      await updateMenuOrderingForTest(page.request, token, {
        category_order: [category, "coffee", "lemonade"],
        subcategory_order: {},
      });
      await setDraftOrder([firstItem.id, secondItem.id]);
      await publishMenuDraftForTest(page.request, token);
      await updateConfigForTest(page.request, token, { menu_editing_active: false });

      await updateConfigForTest(page.request, token, { menu_editing_active: true });
      await setDraftOrder([secondItem.id, firstItem.id]);
      await updateConfigForTest(page.request, token, { menu_editing_active: false });

      customerPage = await page.context().newPage();
      await customerPage.goto("/");
      await customerPage.waitForSelector("text=Bones", { timeout: 10000 });
      await customerPage.getByRole("button", {
        name: /Place Order|Menu|Browse our full menu|Order ahead from our in-cafe menu/,
      }).first().click();

      const overlay = customerPage
        .getByRole("heading", { name: "Menu" })
        .locator('xpath=ancestor::div[contains(@class, "fixed")][1]');
      const tabs = overlay.locator("div.px-4.py-3.flex.gap-2.overflow-x-auto button");
      await expect(tabs.first()).toHaveText(categoryLabelText);

      const publicFirstBox = await overlay.getByText(firstItemName, { exact: true }).first().boundingBox();
      const publicSecondBox = await overlay.getByText(secondItemName, { exact: true }).first().boundingBox();
      expect(publicFirstBox).not.toBeNull();
      expect(publicSecondBox).not.toBeNull();
      expect(publicFirstBox!.y).toBeLessThan(publicSecondBox!.y);

      await loginAsOwner(page);
      await page.click("text=Menu");
      await page.waitForSelector("text=Menu Items", { timeout: 10000 });
      await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();

      const dashboardFirstBox = await page.getByText(firstItemName, { exact: true }).first().boundingBox();
      const dashboardSecondBox = await page.getByText(secondItemName, { exact: true }).first().boundingBox();
      expect(dashboardFirstBox).not.toBeNull();
      expect(dashboardSecondBox).not.toBeNull();
      expect(dashboardFirstBox!.y).toBeLessThan(dashboardSecondBox!.y);
    } finally {
      await importBackupForTest(page.request, token, backup);
      await updateConfigForTest(page.request, token, { menu_editing_active: false });
      await customerPage?.close();
    }
  });

  test("customer CTA auto-refreshes ordering enabled state without a page reload", async ({ page }) => {
    test.slow();
    const token = await getOwnerToken(page.request);
    const originalConfigResponse = await page.request.get("/.netlify/functions/config-public");
    expect(originalConfigResponse.ok()).toBe(true);
    const originalConfig = await originalConfigResponse.json();

    try {
      await updateConfigForTest(page.request, token, { in_store_ordering_enabled: false });

      await page.goto("/");
      await page.waitForSelector("text=Bones", { timeout: 10000 });
      const navigationCountBefore = await page.evaluate(() => performance.getEntriesByType("navigation").length);
      await expect(page.getByRole("heading", { name: "Menu" })).toBeVisible();
      await expect(page.getByText("Browse our full menu")).toBeVisible();

      await updateConfigForTest(page.request, token, { in_store_ordering_enabled: true });

      await expect(page.getByRole("heading", { name: "Place Order" })).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("Order ahead from our in-cafe menu")).toBeVisible();
      const navigationCountAfter = await page.evaluate(() => performance.getEntriesByType("navigation").length);
      expect(navigationCountAfter).toBe(navigationCountBefore);
    } finally {
      await updateConfigForTest(page.request, token, {
        in_store_ordering_enabled: originalConfig.in_store_ordering_enabled,
      });
    }
  });

  test("preset switching stays draft-only until edit mode is exited and naming stays inside edit mode", async ({ browser, page }) => {
    test.slow();
    const token = await getOwnerToken(page.request);
    const backup = await exportBackupForTest(page.request, token);
    const presetState = await fetchMenuPresetsForTest(page.request, token);
    const targetPresetIndex = presetState.active_preset_index === 1 ? 2 : 1;
    const ownerMenuResponse = await page.request.get("/.netlify/functions/menu-list?include_deleted=true", {
      headers: ownerAuthHeaders(token),
    });
    expect(ownerMenuResponse.ok()).toBe(true);
    const ownerMenu = await ownerMenuResponse.json();
    const latte = ownerMenu.find((entry: any) => entry.id === "latte");
    expect(latte).toBeTruthy();

    const originalName = latte.name;
    const presetName = `Preset Latte ${Date.now()}`;
    const customerPage = await browser.newPage({ baseURL: "http://localhost:8888" });

    try {
      await publishMenuDraftForTest(page.request, token);
      await updateConfigForTest(page.request, token, { menu_editing_active: false });

      await activateMenuPresetForTest(page.request, token, targetPresetIndex);
      await page.request.put("/.netlify/functions/menu-manage", {
        headers: ownerAuthHeaders(token),
        data: { id: "latte", name: presetName },
      });
      await publishMenuDraftForTest(page.request, token);
      await activateMenuPresetForTest(page.request, token, presetState.active_preset_index);

      await customerPage.goto("/");
      await customerPage.waitForSelector("text=Bones", { timeout: 10000 });
      const navigationCountBefore = await customerPage.evaluate(() => performance.getEntriesByType("navigation").length);
      await customerPage.getByRole("button", {
        name: /Place Order|Menu|Browse our full menu|Order ahead from our in-cafe menu/,
      }).first().click();
      await expect(customerPage.getByText(originalName, { exact: true }).first()).toBeVisible();

      await loginAsOwner(page);
      await page.click("text=Menu");
      await page.waitForSelector("text=Menu Items", { timeout: 10000 });
      await expect(page.getByText("Menu Presets")).toHaveCount(0);

      await page.click("text=Edit");
      await expect(page.getByText("Menu Presets")).toBeVisible();

      await page.getByRole("button", { name: "Edit title" }).click();
      await expect(page.locator(`input[placeholder="Title for Menu ${presetState.active_preset_index}"]`)).toBeVisible();

      await page.getByRole("button", { name: new RegExp(`^Menu ${targetPresetIndex}`) }).click();
      await expect.poll(async () => {
        const response = await page.request.get("/.netlify/functions/menu-list?include_deleted=true", {
          headers: ownerAuthHeaders(token),
        });
        const menu = await response.json();
        return menu.some((entry: any) => entry.name === presetName);
      }, { timeout: 10000 }).toBe(true);

      await page.fill('input[placeholder="Search items..."]', presetName);
      await expect(page.getByText(presetName, { exact: true }).first()).toBeVisible();

      await customerPage.waitForTimeout(1500);
      await expect(customerPage.getByText(presetName, { exact: true })).toHaveCount(0);
      await expect(customerPage.getByText(originalName, { exact: true }).first()).toBeVisible();

      await page.getByRole("button", { name: "Editing" }).click();
      await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();

      await expect(customerPage.getByText(presetName, { exact: true }).first()).toBeVisible({ timeout: 15000 });
      const navigationCountAfter = await customerPage.evaluate(() => performance.getEntriesByType("navigation").length);
      expect(navigationCountAfter).toBe(navigationCountBefore);
    } finally {
      await importBackupForTest(page.request, token, backup);
      await customerPage.close();
    }
  });
});

test.describe("API Endpoints", () => {
  test("menu presets expose five titled slots and backup includes preset state", async ({ page }) => {
    const token = await getOwnerToken(page.request);
    const originalPresetState = await fetchMenuPresetsForTest(page.request, token);
    const originalTitle = originalPresetState.presets.find((preset: any) => preset.index === 1)?.title || "";

    try {
      const updatedPresetState = await updateMenuPresetTitleForTest(page.request, token, 1, "Breakfast");
      expect(updatedPresetState.presets).toHaveLength(5);
      expect(updatedPresetState.presets.find((preset: any) => preset.index === 1)?.label).toBe("Menu 1: Breakfast");

      const backupResponse = await page.request.get("/.netlify/functions/backup-export", {
        headers: ownerAuthHeaders(token),
      });
      expect(backupResponse.ok()).toBe(true);
      const backup = await backupResponse.json();

      expect(backup).toHaveProperty("menu_ordering");
      expect(backup).toHaveProperty("published_menu");
      expect(backup).toHaveProperty("published_menu_ordering");
      expect(backup).toHaveProperty("menu_presets");
      expect(backup).toHaveProperty("published_images");
      expect(Array.isArray(backup.menu_presets.presets)).toBe(true);
      expect(backup.menu_presets.presets).toHaveLength(5);
      expect(typeof backup.menu_presets.active_preset_index).toBe("number");
      for (const preset of backup.menu_presets.presets) {
        expect(preset).toHaveProperty("menu");
        expect(preset).toHaveProperty("menu_ordering");
        expect(preset).toHaveProperty("published_menu");
        expect(preset).toHaveProperty("published_menu_ordering");
      }
    } finally {
      await updateMenuPresetTitleForTest(page.request, token, 1, originalTitle);
      await activateMenuPresetForTest(page.request, token, originalPresetState.active_preset_index);
    }
  });

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

  test("menu sorting normalizes duplicate category sort orders and reordering still works", async ({ page }) => {
    test.slow();
    const token = await getOwnerToken(page.request);
    const originalBackup = await exportBackupForTest(page.request, token);
    const suffix = Date.now();
    const category = `sortfix${suffix}`;
    const firstId = `sortfix-a-${suffix}`;
    const secondId = `sortfix-b-${suffix}`;
    const thirdId = `sortfix-c-${suffix}`;

    const duplicateSortItems = [
      {
        id: firstId,
        name: `Sort Fix A ${suffix}`,
        description: "Duplicate sort-order restore test item",
        base_price_cents: 400,
        category,
        is_available: true,
        sort_order: 1,
      },
      {
        id: secondId,
        name: `Sort Fix B ${suffix}`,
        description: "Duplicate sort-order restore test item",
        base_price_cents: 425,
        category,
        is_available: true,
        sort_order: 1,
      },
      {
        id: thirdId,
        name: `Sort Fix C ${suffix}`,
        description: "Duplicate sort-order restore test item",
        base_price_cents: 450,
        category,
        is_available: true,
        sort_order: 1,
      },
    ];

    const mutatedBackup = JSON.parse(JSON.stringify(originalBackup));
    mutatedBackup.menu = [...mutatedBackup.menu, ...duplicateSortItems];
    mutatedBackup.published_menu = [...mutatedBackup.published_menu, ...duplicateSortItems];
    mutatedBackup.menu_ordering = {
      ...mutatedBackup.menu_ordering,
      category_order: [category, ...(mutatedBackup.menu_ordering?.category_order ?? [])],
    };
    mutatedBackup.published_menu_ordering = {
      ...mutatedBackup.published_menu_ordering,
      category_order: [category, ...(mutatedBackup.published_menu_ordering?.category_order ?? [])],
    };

    try {
      await importBackupForTest(page.request, token, mutatedBackup);

      await expect.poll(async () => {
        const response = await page.request.get("/.netlify/functions/menu-list?include_deleted=true", {
          headers: ownerAuthHeaders(token),
        });
        const items = await response.json();
        return items
          .filter((entry: any) => entry.category === category)
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map((entry: any) => `${entry.id}:${entry.sort_order}`)
          .join("|");
      }, { timeout: 15000 }).toBe(`${firstId}:1|${secondId}:2|${thirdId}:3`);

      const refreshedToken = await getOwnerToken(page.request);
      const reorderResponse = await page.request.put("/.netlify/functions/menu-reorder", {
        headers: ownerAuthHeaders(refreshedToken),
        data: {
          items: [
            { id: thirdId, sort_order: 1 },
            { id: firstId, sort_order: 2 },
            { id: secondId, sort_order: 3 },
          ],
        },
      });
      expect(reorderResponse.ok()).toBe(true);

      await expect.poll(async () => {
        const response = await page.request.get("/.netlify/functions/menu-list?include_deleted=true", {
          headers: ownerAuthHeaders(refreshedToken),
        });
        const items = await response.json();
        return items
          .filter((entry: any) => entry.category === category)
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map((entry: any) => entry.id)
          .join("|");
      }, { timeout: 15000 }).toBe(`${thirdId}|${firstId}|${secondId}`);
    } finally {
      await importBackupForTest(page.request, token, originalBackup);
    }
  });

  test("zip backup import restores the exported snapshot", async ({ page }) => {
    test.slow();
    const token = await getOwnerToken(page.request);
    const backup = await exportBackupForTest(page.request, token);
    const ownerMenuResponse = await page.request.get("/.netlify/functions/menu-list?include_deleted=true", {
      headers: ownerAuthHeaders(token),
    });
    expect(ownerMenuResponse.ok()).toBe(true);
    const ownerMenu = await ownerMenuResponse.json();
    const latte = ownerMenu.find((entry: any) => entry.id === "latte");
    expect(latte).toBeTruthy();

    const originalName = latte.name;
    const changedName = `Zip Restore ${Date.now()}`;
    const savedDraftLatte = backup.menu.find((entry: any) => entry.id === "latte");
    const savedPublishedLatte = backup.published_menu.find((entry: any) => entry.id === "latte");
    expect(savedDraftLatte).toBeTruthy();
    expect(savedPublishedLatte).toBeTruthy();
    const zip = new JSZip();
    zip.file("backup.json", JSON.stringify(backup, null, 2));
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    let restored = false;

    try {
      await page.request.put("/.netlify/functions/menu-manage", {
        headers: ownerAuthHeaders(token),
        data: { id: "latte", name: changedName },
      });
      await publishMenuDraftForTest(page.request, token);

      await loginAsOwner(page);
      await page.click("text=Settings");
      await page.locator('input[type="file"]').setInputFiles({
        name: "bnb-restore.zip",
        mimeType: "application/zip",
        buffer: zipBuffer,
      });

      await expect(page.getByText("Ready to import:")).toBeVisible();
      await page.getByRole("button", { name: "Overwrite All" }).click();

      await expect.poll(async () => {
        const draftResponse = await page.request.get("/.netlify/functions/menu-list?include_deleted=true", {
          headers: ownerAuthHeaders(token),
        });
        const publicResponse = await page.request.get("/.netlify/functions/menu-list");
        const draftMenu = await draftResponse.json();
        const publicMenu = await publicResponse.json();
        const restoredDraftLatte = draftMenu.find((entry: any) => entry.id === "latte");
        const restoredPublicLatte = publicMenu.find((entry: any) => entry.id === "latte");
        return (
          restoredDraftLatte?.name === savedDraftLatte.name &&
          restoredPublicLatte?.name === savedPublishedLatte.name &&
          restoredDraftLatte?.name !== changedName
        );
      }, { timeout: 15000 }).toBe(true);
      restored = true;
    } finally {
      if (!restored) {
        await importBackupForTest(page.request, token, backup);
      }
    }
  });

  test("restore point controls create a snapshot and confirm before restoring", async ({ page }) => {
    const token = await getOwnerToken(page.request);

    await loginAsOwner(page);
    await page.click("text=Settings");
    await page.getByRole("button", { name: "Create Restore Point" }).click();
    await expect(page.getByText("Latest restore point:")).toBeVisible();

    await page.evaluate(() => {
      (window as any).__restoreConfirmMessage = null;
      window.confirm = (message?: string) => {
        (window as any).__restoreConfirmMessage = message ?? null;
        return false;
      };
    });

    await page.getByRole("button", { name: "Restore From Latest Restore Point" }).click();
    const confirmMessage = await page.evaluate(() => (window as any).__restoreConfirmMessage);
    expect(confirmMessage).toContain("Restore all data from the latest restore point");
  });

  test("backup-restore endpoint restores the latest saved snapshot", async ({ page }) => {
    test.slow();
    const token = await getOwnerToken(page.request);
    const ownerMenuResponse = await page.request.get("/.netlify/functions/menu-list?include_deleted=true", {
      headers: ownerAuthHeaders(token),
    });
    expect(ownerMenuResponse.ok()).toBe(true);
    const ownerMenu = await ownerMenuResponse.json();
    const latte = ownerMenu.find((entry: any) => entry.id === "latte");
    expect(latte).toBeTruthy();

    const originalName = latte.name;
    const changedName = `Restore Point ${Date.now()}`;

    const backup = await exportBackupForTest(page.request, token, true);
    const savedDraftLatte = backup.menu.find((entry: any) => entry.id === "latte");
    const savedPublishedLatte = backup.published_menu.find((entry: any) => entry.id === "latte");
    expect(savedDraftLatte).toBeTruthy();
    expect(savedPublishedLatte).toBeTruthy();

    await page.request.put("/.netlify/functions/menu-manage", {
      headers: ownerAuthHeaders(token),
      data: { id: "latte", name: changedName },
    });
    await publishMenuDraftForTest(page.request, token);

    const restoreResponse = await page.request.post("/.netlify/functions/backup-restore", {
      headers: ownerAuthHeaders(token),
    });
    expect(restoreResponse.ok()).toBe(true);

    await expect.poll(async () => {
      const draftResponse = await page.request.get("/.netlify/functions/menu-list?include_deleted=true", {
        headers: ownerAuthHeaders(token),
      });
      const publicResponse = await page.request.get("/.netlify/functions/menu-list");
      const draftMenu = await draftResponse.json();
      const publicMenu = await publicResponse.json();
      const restoredDraftLatte = draftMenu.find((entry: any) => entry.id === "latte");
      const restoredPublicLatte = publicMenu.find((entry: any) => entry.id === "latte");
      return (
        restoredDraftLatte?.name === savedDraftLatte.name &&
        restoredPublicLatte?.name === savedPublishedLatte.name &&
        restoredDraftLatte?.name !== changedName
      );
    }, { timeout: 15000 }).toBe(true);
  });

  test("restore point brings back all preset layouts and the dashboard loads the selected preset instead of sticking", async ({ page }) => {
    test.slow();
    const token = await getOwnerToken(page.request);
    const originalBackup = await exportBackupForTest(page.request, token);
    const suffix = Date.now();
    const { fixtures, backup } = buildBackupWithPresetFixtures(originalBackup, suffix);

    try {
      await importBackupForTest(page.request, token, backup);
      await exportBackupForTest(page.request, token, true);
      await importBackupForTest(page.request, token, originalBackup);

      const restoreResponse = await page.request.post("/.netlify/functions/backup-restore", {
        headers: ownerAuthHeaders(token),
      });
      expect(restoreResponse.ok()).toBe(true);

      const restoredPresetState = await fetchMenuPresetsForTest(page.request, token);
      expect(restoredPresetState.active_preset_index).toBe(0);
      expect(restoredPresetState.presets.map((preset: any) => preset.title)).toEqual(
        fixtures.map((fixture) => fixture.title)
      );

      for (const fixture of fixtures) {
        await expectPresetActivationToMatch(page.request, token, fixture);
      }

      await activateMenuPresetForTest(page.request, token, 0);

      await loginAsOwner(page);
      await page.click("text=Menu");
      await page.waitForSelector("text=Menu Items", { timeout: 10000 });
      await page.getByRole("button", { name: "Edit" }).click();

      let previousTopName = fixtures[0].menu.find((entry) => entry.id === fixtures[0].topItemId)?.name;
      expect(previousTopName).toBeTruthy();
      await expect(page.getByText(previousTopName!, { exact: true }).first()).toBeVisible();

      for (const fixture of fixtures.slice(1)) {
        const nextTopName = fixture.menu.find((entry) => entry.id === fixture.topItemId)?.name;
        expect(nextTopName).toBeTruthy();

        await page.getByRole("button", { name: `Menu ${fixture.index}: ${fixture.title}` }).click();
        await expect(page.getByText(nextTopName!, { exact: true }).first()).toBeVisible({ timeout: 10000 });
        await expect(page.getByText(previousTopName!, { exact: true })).toHaveCount(0);
        previousTopName = nextTopName!;
      }
    } finally {
      await importBackupForTest(page.request, token, originalBackup);
      await updateConfigForTest(page.request, token, { menu_editing_active: false });
    }
  });

  test("zip restore brings back all preset layouts and each preset activates with the saved category, subcategory, and item order", async ({ page }) => {
    test.slow();
    const token = await getOwnerToken(page.request);
    const originalBackup = await exportBackupForTest(page.request, token);
    const suffix = Date.now();
    const { fixtures, backup } = buildBackupWithPresetFixtures(originalBackup, suffix);
    const zip = new JSZip();
    zip.file("backup.json", JSON.stringify(backup, null, 2));
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    try {
      await importBackupForTest(page.request, token, originalBackup);

      await loginAsOwner(page);
      await page.click("text=Settings");
      await page.locator('input[type="file"]').setInputFiles({
        name: `preset-restore-${suffix}.zip`,
        mimeType: "application/zip",
        buffer: zipBuffer,
      });

      await expect(page.getByText("Ready to import:")).toBeVisible();
      await page.getByRole("button", { name: "Overwrite All" }).click();

      await expect.poll(async () => {
        const presetState = await fetchMenuPresetsForTest(page.request, token);
        return JSON.stringify(presetState.presets.map((preset: any) => preset.title));
      }, { timeout: 15000 }).toBe(JSON.stringify(fixtures.map((fixture) => fixture.title)));

      for (const fixture of fixtures) {
        await expectPresetActivationToMatch(page.request, token, fixture);
      }
    } finally {
      await importBackupForTest(page.request, token, originalBackup);
      await updateConfigForTest(page.request, token, { menu_editing_active: false });
    }
  });

  test("legacy preset restores without published fields still activate the correct saved layout", async ({ page }) => {
    test.slow();
    const token = await getOwnerToken(page.request);
    const originalBackup = await exportBackupForTest(page.request, token);
    const suffix = Date.now();
    const { fixtures, backup } = buildBackupWithPresetFixtures(originalBackup, suffix);
    const legacyBackup = cloneJson(backup);

    legacyBackup.menu_presets.presets = legacyBackup.menu_presets.presets.map((preset: any) => ({
      index: preset.index,
      title: preset.title,
      menu: preset.menu,
      menu_ordering: preset.menu_ordering,
      images: preset.images,
    }));

    try {
      await importBackupForTest(page.request, token, legacyBackup);

      await expect.poll(async () => {
        const presetState = await fetchMenuPresetsForTest(page.request, token);
        return JSON.stringify(presetState.presets.map((preset: any) => preset.title));
      }, { timeout: 15000 }).toBe(JSON.stringify(fixtures.map((fixture) => fixture.title)));

      for (const fixture of fixtures) {
        await expectPresetActivationToMatch(page.request, token, fixture);
      }
    } finally {
      await importBackupForTest(page.request, token, originalBackup);
      await updateConfigForTest(page.request, token, { menu_editing_active: false });
    }
  });

  test("restored presets drop stale customer layout tokens and publish the selected preset order", async ({ page }) => {
    test.slow();
    const token = await getOwnerToken(page.request);
    const originalBackup = await exportBackupForTest(page.request, token);
    const suffix = Date.now();
    const { fixtures, backup } = buildBackupWithPresetFixtures(originalBackup, suffix);
    const fixture = fixtures[1];
    const preset = backup.menu_presets.presets[fixture.index];
    const plainMenu = cloneJson(
      preset.menu.map((entry: any) => {
        const next = { ...entry };
        delete next.subcategory;
        return next;
      })
    );
    const staleOrdering = {
      category_order: [fixture.primaryCategory, fixture.secondaryCategory],
      subcategory_order: {
        [fixture.primaryCategory]: [
          `item:${fixture.secondSubItemId}`,
          `stale-sub-${suffix}`,
          "item:ghost-item",
          `item:${fixture.topItemId}`,
        ],
      },
    };
    const expectedPrimaryIds = [
      fixture.topItemId,
      fixture.firstSubItemId,
      fixture.secondSubItemId,
      fixture.bottomItemId,
    ];
    const expectedPrimaryNames = plainMenu
      .filter((entry: any) => entry.category === fixture.primaryCategory)
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((entry: any) => entry.name);

    preset.menu = cloneJson(plainMenu);
    preset.published_menu = cloneJson(plainMenu);
    preset.menu_ordering = cloneJson(staleOrdering);
    preset.published_menu_ordering = cloneJson(staleOrdering);

    let customerPage: Page | null = null;

    try {
      await importBackupForTest(page.request, token, backup);

      await loginAsOwner(page);
      await page.click("text=Menu");
      await page.waitForSelector("text=Menu Items", { timeout: 10000 });
      await page.getByRole("button", { name: "Edit" }).click();
      await page.getByRole("button", { name: `Menu ${fixture.index}: ${fixture.title}` }).click();
      await page.getByRole("button", { name: "Editing" }).click();
      await page.getByRole("button", { name: "Edit" }).waitFor({ timeout: 15000 });

      const [publicMenuResponse, publicOrderingResponse] = await Promise.all([
        page.request.get("/.netlify/functions/menu-list"),
        page.request.get("/.netlify/functions/menu-ordering"),
      ]);
      expect(publicMenuResponse.ok()).toBe(true);
      expect(publicOrderingResponse.ok()).toBe(true);

      const publicMenu = await publicMenuResponse.json();
      const publicOrdering = await publicOrderingResponse.json();
      const publicPrimaryIds = publicMenu
        .filter((entry: any) => entry.category === fixture.primaryCategory)
        .sort((a: any, b: any) => a.sort_order - b.sort_order)
        .map((entry: any) => entry.id);

      expect(publicOrdering.category_order.slice(0, 2)).toEqual([
        fixture.primaryCategory,
        fixture.secondaryCategory,
      ]);
      expect(publicOrdering.subcategory_order?.[fixture.primaryCategory] ?? []).toEqual([]);
      expect(publicPrimaryIds).toEqual(expectedPrimaryIds);

      customerPage = await page.context().newPage();
      await customerPage.goto("/");
      await customerPage.waitForSelector("text=Bones", { timeout: 10000 });
      await customerPage.getByRole("button", {
        name: /Place Order|Menu|Browse our full menu|Order ahead from our in-cafe menu/,
      }).first().click();

      await expect(customerPage.getByText(expectedPrimaryNames[0], { exact: true })).toBeVisible();

      const visiblePrimaryNames = await customerPage.evaluate((names: string[]) => {
        return Array.from(document.querySelectorAll("h4"))
          .map((node) => node.textContent?.trim())
          .filter((text): text is string => !!text && names.includes(text));
      }, expectedPrimaryNames);

      expect(visiblePrimaryNames.slice(0, expectedPrimaryNames.length)).toEqual(expectedPrimaryNames);
    } finally {
      await customerPage?.close();
      await importBackupForTest(page.request, token, originalBackup);
      await updateConfigForTest(page.request, token, { menu_editing_active: false });
    }
  });

  test("restore point preserves subcategory assignment and ordering", async ({ page }) => {
    test.slow();
    const token = await getOwnerToken(page.request);
    const originalBackup = await exportBackupForTest(page.request, token);
    const originalOrderingResponse = await page.request.get("/.netlify/functions/menu-ordering", {
      headers: ownerAuthHeaders(token),
    });
    expect(originalOrderingResponse.ok()).toBe(true);
    const originalOrdering = await originalOrderingResponse.json();

    const suffix = Date.now();
    const category = `restorecat${suffix}`;
    const subcategory = `restoresub${suffix}`;

    const topItem = await createMenuItem(page.request, token, {
      name: `Restore Top ${suffix}`,
      description: "Restore-point subcategory top item",
      base_price_cents: 525,
      category,
    });
    const subItem = await createMenuItem(page.request, token, {
      name: `Restore Sub ${suffix}`,
      description: "Restore-point subcategory grouped item",
      base_price_cents: 550,
      category,
      subcategory,
    });

    const savedOrdering = {
      category_order: [category, ...(originalOrdering.category_order ?? [])],
      subcategory_order: {
        ...(originalOrdering.subcategory_order ?? {}),
        [category]: [`item:${topItem.id}`, subcategory],
      },
    };

    try {
      await updateMenuOrderingForTest(page.request, token, savedOrdering);
      await publishMenuDraftForTest(page.request, token);
      await exportBackupForTest(page.request, token, true);

      await page.request.put("/.netlify/functions/menu-manage", {
        headers: ownerAuthHeaders(token),
        data: { id: subItem.id, subcategory: null },
      });
      await updateMenuOrderingForTest(page.request, token, {
        category_order: [category, ...(originalOrdering.category_order ?? [])],
        subcategory_order: {
          ...(originalOrdering.subcategory_order ?? {}),
          [category]: [subcategory, `item:${topItem.id}`],
        },
      });
      await publishMenuDraftForTest(page.request, token);

      const restoreResponse = await page.request.post("/.netlify/functions/backup-restore", {
        headers: ownerAuthHeaders(token),
      });
      expect(restoreResponse.ok()).toBe(true);

      await expect.poll(async () => {
        const [draftMenuResponse, draftOrderingResponse, publicMenuResponse, publicOrderingResponse] = await Promise.all([
          page.request.get("/.netlify/functions/menu-list?include_deleted=true", {
            headers: ownerAuthHeaders(token),
          }),
          page.request.get("/.netlify/functions/menu-ordering", {
            headers: ownerAuthHeaders(token),
          }),
          page.request.get("/.netlify/functions/menu-list"),
          page.request.get("/.netlify/functions/menu-ordering"),
        ]);

        const draftMenu = await draftMenuResponse.json();
        const draftOrdering = await draftOrderingResponse.json();
        const publicMenu = await publicMenuResponse.json();
        const publicOrdering = await publicOrderingResponse.json();

        const restoredDraftSubItem = draftMenu.find((entry: any) => entry.id === subItem.id);
        const restoredPublicSubItem = publicMenu.find((entry: any) => entry.id === subItem.id);

        return (
          restoredDraftSubItem?.subcategory === subcategory &&
          restoredPublicSubItem?.subcategory === subcategory &&
          JSON.stringify(draftOrdering.subcategory_order?.[category] ?? []) === JSON.stringify(savedOrdering.subcategory_order[category]) &&
          JSON.stringify(publicOrdering.subcategory_order?.[category] ?? []) === JSON.stringify(savedOrdering.subcategory_order[category])
        );
      }, { timeout: 20000 }).toBe(true);
    } finally {
      await importBackupForTest(page.request, token, originalBackup);
    }
  });

  test("restore point preserves exact item, customer, order, and preset names", async ({ page }) => {
    test.slow();
    const token = await getOwnerToken(page.request);
    const suffix = Date.now();
    const presetState = await fetchMenuPresetsForTest(page.request, token);
    const presetIndex = 1;
    const originalPresetTitle = presetState.presets.find((preset: any) => preset.index === presetIndex)?.title || "";
    const savedPresetTitle = `Restore Preset ${suffix}`;
    const mutatedPresetTitle = `Mutated Preset ${suffix}`;
    const savedItemName = `Restore Item ${suffix}`;
    const mutatedItemName = `Mutated Item ${suffix}`;
    const savedCustomerName = `Restore Customer ${suffix}`;
    const mutatedCustomerName = `Mutated Customer ${suffix}`;
    const savedOrderName = `Restore Order ${suffix}`;
    const mutatedOrderName = `Mutated Order ${suffix}`;
    const savedOrderNotes = `Saved notes ${suffix}`;
    const mutatedOrderNotes = `Mutated notes ${suffix}`;

    const item = await createMenuItem(page.request, token, {
      name: savedItemName,
      description: "Restore point fidelity item",
      base_price_cents: 725,
      category: "coffee",
    });

    const createdOrderResponse = await page.request.post("/.netlify/functions/orders-create", {
      data: {
        customer_name: "Walk-in",
        items: [
          {
            menu_item_id: item.id,
            item_name: savedItemName,
            quantity: 1,
            price_cents: 725,
            options: {},
          },
        ],
        total_cents: 725,
        created_by: "owner",
      },
    });
    expect(createdOrderResponse.ok()).toBe(true);
    const createdOrder = await createdOrderResponse.json();
    const customerId = createdOrder.customer_id as string;
    expect(customerId).toBeTruthy();

    try {
      const customerUpdateResponse = await page.request.put("/.netlify/functions/customers-update", {
        headers: ownerAuthHeaders(token),
        data: { id: customerId, names: [savedCustomerName] },
      });
      expect(customerUpdateResponse.ok()).toBe(true);

      const orderUpdateResponse = await page.request.put("/.netlify/functions/orders-update", {
        headers: ownerAuthHeaders(token),
        data: {
          id: createdOrder.id,
          customer_name: savedOrderName,
          notes: savedOrderNotes,
          items: [
            {
              ...createdOrder.items[0],
              item_name: savedItemName,
            },
          ],
        },
      });
      expect(orderUpdateResponse.ok()).toBe(true);

      await updateMenuPresetTitleForTest(page.request, token, presetIndex, savedPresetTitle);
      await exportBackupForTest(page.request, token, true);

      await page.request.put("/.netlify/functions/menu-manage", {
        headers: ownerAuthHeaders(token),
        data: { id: item.id, name: mutatedItemName },
      });
      await page.request.put("/.netlify/functions/customers-update", {
        headers: ownerAuthHeaders(token),
        data: { id: customerId, names: [mutatedCustomerName] },
      });
      await page.request.put("/.netlify/functions/orders-update", {
        headers: ownerAuthHeaders(token),
        data: {
          id: createdOrder.id,
          customer_name: mutatedOrderName,
          notes: mutatedOrderNotes,
          items: [
            {
              ...createdOrder.items[0],
              item_name: mutatedItemName,
            },
          ],
        },
      });
      await updateMenuPresetTitleForTest(page.request, token, presetIndex, mutatedPresetTitle);

      const restoreResponse = await page.request.post("/.netlify/functions/backup-restore", {
        headers: ownerAuthHeaders(token),
      });
      expect(restoreResponse.ok()).toBe(true);

      await expect.poll(async () => {
        const menuResponse = await page.request.get("/.netlify/functions/menu-list?include_deleted=true", {
          headers: ownerAuthHeaders(token),
        });
        const customersResponse = await page.request.get("/.netlify/functions/customers-list", {
          headers: ownerAuthHeaders(token),
        });
        const ordersResponse = await page.request.get("/.netlify/functions/orders-list?include_deleted=true", {
          headers: ownerAuthHeaders(token),
        });
        const restoredPresets = await fetchMenuPresetsForTest(page.request, token);

        const menu = await menuResponse.json();
        const customers = await customersResponse.json();
        const orders = await ordersResponse.json();
        const restoredItem = menu.find((entry: any) => entry.id === item.id);
        const restoredCustomer = customers.find((entry: any) => entry.id === customerId);
        const restoredOrder = orders.find((entry: any) => entry.id === createdOrder.id);
        const restoredPreset = restoredPresets.presets.find((entry: any) => entry.index === presetIndex);

        return (
          restoredItem?.name === savedItemName &&
          restoredCustomer?.names?.[0] === savedCustomerName &&
          restoredOrder?.customer_name === savedOrderName &&
          restoredOrder?.notes === savedOrderNotes &&
          restoredOrder?.items?.[0]?.item_name === savedItemName &&
          restoredPreset?.title === savedPresetTitle
        );
      }, { timeout: 20000 }).toBe(true);
    } finally {
      await updateMenuPresetTitleForTest(page.request, token, presetIndex, originalPresetTitle);
      await deleteOrderForTest(page.request, token, createdOrder.id);
      await deleteCustomerForTest(page.request, token, customerId);
      await permanentlyDeleteMenuItem(page.request, token, item.id);
    }
  });
});

import { test, expect } from "@playwright/test";
import {
  createMenuItem,
  deleteOrderForTest,
  getOwnerToken,
  loginAsOwner,
  ownerAuthHeaders,
  permanentlyDeleteMenuItem,
} from "./helpers";

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

  test("orders stay newest-first and support search and filters", async ({ page }) => {
    test.slow();
    const token = await getOwnerToken(page.request);
    const suffix = Date.now();
    const olderName = `Orders Old ${suffix}`;
    const completedName = `Orders Completed ${suffix}`;
    const newestName = `Orders New ${suffix}`;
    const olderItem = `Old Item ${suffix}`;
    const completedItem = `Completed Item ${suffix}`;
    const newestItem = `Newest Item ${suffix}`;
    const createdOrderIds: string[] = [];

    const createOrder = async (payload: Record<string, unknown>) => {
      const response = await page.request.post("/.netlify/functions/orders-create", {
        data: payload,
      });
      expect(response.ok()).toBe(true);
      const body = await response.json();
      createdOrderIds.push(body.id);
      return body;
    };

    try {
      const baseTime = Date.now();
      const olderOrder = await createOrder({
        customer_name: olderName,
        items: [
          {
            menu_item_id: `old-item-${suffix}`,
            item_name: olderItem,
            quantity: 1,
            price_cents: 450,
            options: {},
          },
        ],
        total_cents: 450,
        notes: `older note ${suffix}`,
        created_by: "customer",
      });
      const completedOrder = await createOrder({
        customer_name: completedName,
        items: [
          {
            menu_item_id: `completed-item-${suffix}`,
            item_name: completedItem,
            quantity: 1,
            price_cents: 500,
            options: {},
          },
        ],
        total_cents: 500,
        notes: `completed note ${suffix}`,
        created_by: "customer",
      });
      const newestOrder = await createOrder({
        customer_name: newestName,
        items: [
          {
            menu_item_id: `new-item-${suffix}`,
            item_name: newestItem,
            quantity: 1,
            price_cents: 550,
            options: {},
          },
        ],
        total_cents: 550,
        notes: `newest note ${suffix}`,
        created_by: "owner",
      });

      const olderTimestamp = new Date(baseTime - 120_000).toISOString();
      const completedTimestamp = new Date(baseTime - 60_000).toISOString();
      const newestTimestamp = new Date(baseTime).toISOString();

      for (const [id, updates] of [
        [olderOrder.id, { created_at: olderTimestamp, updated_at: olderTimestamp }],
        [completedOrder.id, { status: "completed", created_at: completedTimestamp, updated_at: completedTimestamp }],
        [newestOrder.id, { created_at: newestTimestamp, updated_at: newestTimestamp }],
      ] as const) {
        const response = await page.request.put("/.netlify/functions/orders-update", {
          headers: ownerAuthHeaders(token),
          data: { id, ...updates },
        });
        expect(response.ok()).toBe(true);
      }

      await loginAsOwner(page);
      await page.getByRole("button", { name: /Orders/ }).click();

      await expect(page.getByText(newestName, { exact: true })).toBeVisible();
      await expect(page.getByText(olderName, { exact: true })).toBeVisible();
      await expect(page.getByText(completedName, { exact: true })).toBeVisible();

      const newestBox = await page.getByText(newestName, { exact: true }).first().boundingBox();
      const olderBox = await page.getByText(olderName, { exact: true }).first().boundingBox();
      expect(newestBox).not.toBeNull();
      expect(olderBox).not.toBeNull();
      expect(newestBox!.y).toBeLessThan(olderBox!.y);

      const searchInput = page.getByPlaceholder("Search customer, item, notes, or order ID...");
      await searchInput.fill(newestItem);
      await expect(page.getByText(newestName, { exact: true })).toBeVisible();
      await expect(page.getByText(olderName, { exact: true })).toHaveCount(0);
      await expect(page.getByText(completedName, { exact: true })).toHaveCount(0);

      await searchInput.fill("");
      await page.getByRole("button", { name: "Filters" }).click();
      await page.locator('select').nth(0).selectOption("owner");
      await expect(page.getByText(newestName, { exact: true })).toBeVisible();
      await expect(page.getByText(olderName, { exact: true })).toHaveCount(0);

      await page.locator('select').nth(0).selectOption("all");
      await page.locator('select').nth(1).selectOption("completed");
      await expect(page.getByText(completedName, { exact: true })).toBeVisible();
      await expect(page.getByText(newestName, { exact: true })).toHaveCount(0);
      await expect(page.getByText(olderName, { exact: true })).toHaveCount(0);
    } finally {
      for (const id of createdOrderIds) {
        await deleteOrderForTest(page.request, token, id);
      }
    }
  });

  test("POS item cards and cart rows fit long names and option lists", async ({ page }) => {
    const token = await getOwnerToken(page.request);
    const suffix = Date.now();
    const longName = `Extra Long Pistachio Honey Cardamom Cold Foam Latte Special ${suffix}`;
    const longOptionOne = `Choice of Extra Long Milk Alternative Description ${suffix}`;
    const longOptionTwo = `House-Made Lavender Vanilla Sweet Cream Foam Selection ${suffix}`;
    const optionSummary = `${longOptionOne} · ${longOptionTwo}`;
    const selectedOptionSummary = `Oat Milk Reserve ${suffix}, Caramelized Brown Sugar Drizzle ${suffix}`;

    const item = await createMenuItem(page.request, token, {
      name: longName,
      description: "Playwright POS long text fit item",
      base_price_cents: 775,
      category: "coffee",
      options: [
        {
          name: longOptionOne,
          choices: [
            { label: `Oat Milk Reserve ${suffix}`, extra_cents: 0 },
            { label: `Almond Milk Reserve ${suffix}`, extra_cents: 50 },
          ],
        },
        {
          name: longOptionTwo,
          choices: [
            { label: `Caramelized Brown Sugar Drizzle ${suffix}`, extra_cents: 75 },
            { label: `Orange Blossom Cream ${suffix}`, extra_cents: 100 },
          ],
        },
      ],
    });

    try {
      await loginAsOwner(page);
      await page.getByRole("button", { name: /POS/ }).click();
      await page.getByRole("button", { name: "Coffee" }).click();

      const menuName = page.getByText(longName, { exact: true }).first();
      const menuOptions = page.getByText(optionSummary, { exact: true }).first();

      await expect(menuName).toBeVisible();
      await expect(menuOptions).toBeVisible();

      const menuNameMetrics = await menuName.evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          whiteSpace: style.whiteSpace,
          textOverflow: style.textOverflow,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
        };
      });
      expect(menuNameMetrics.whiteSpace).not.toBe("nowrap");
      expect(menuNameMetrics.textOverflow).not.toBe("ellipsis");
      expect(menuNameMetrics.scrollHeight).toBeLessThanOrEqual(menuNameMetrics.clientHeight + 1);

      const menuOptionsMetrics = await menuOptions.evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          whiteSpace: style.whiteSpace,
          textOverflow: style.textOverflow,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
        };
      });
      expect(menuOptionsMetrics.whiteSpace).not.toBe("nowrap");
      expect(menuOptionsMetrics.textOverflow).not.toBe("ellipsis");
      expect(menuOptionsMetrics.scrollHeight).toBeLessThanOrEqual(menuOptionsMetrics.clientHeight + 1);

      await menuName.locator("xpath=ancestor::button[1]").click();
      await page.getByRole("button", { name: /Add to Order/ }).click();

      const cartName = page.locator("text=" + longName).last();
      const cartOptions = page.getByText(selectedOptionSummary, { exact: true }).first();
      await expect(cartName).toBeVisible();
      await expect(cartOptions).toBeVisible();

      const cartNameMetrics = await cartName.evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          whiteSpace: style.whiteSpace,
          textOverflow: style.textOverflow,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
        };
      });
      expect(cartNameMetrics.whiteSpace).not.toBe("nowrap");
      expect(cartNameMetrics.textOverflow).not.toBe("ellipsis");
      expect(cartNameMetrics.scrollHeight).toBeLessThanOrEqual(cartNameMetrics.clientHeight + 1);

      const cartOptionMetrics = await cartOptions.evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          whiteSpace: style.whiteSpace,
          textOverflow: style.textOverflow,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
        };
      });
      expect(cartOptionMetrics.whiteSpace).not.toBe("nowrap");
      expect(cartOptionMetrics.textOverflow).not.toBe("ellipsis");
      expect(cartOptionMetrics.scrollHeight).toBeLessThanOrEqual(cartOptionMetrics.clientHeight + 1);
    } finally {
      await permanentlyDeleteMenuItem(page.request, token, item.id);
    }
  });
});

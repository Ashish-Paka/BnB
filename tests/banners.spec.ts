import { test, expect } from "@playwright/test";

test.describe("Banner Styles", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("CTA banner uses green gradient classes", async ({ page }) => {
    const ctaBanner = page.locator("a[href='https://bonesandbru.com/']");
    const classes = await ctaBanner.getAttribute("class");
    expect(classes).toContain("from-brand-olive");
    expect(classes).toContain("via-emerald-500");
    expect(classes).toContain("to-brand-olive");
  });

  test("CTA Order Online button has no logo image", async ({ page }) => {
    const orderBtn = page.locator("text=Order Online").first();
    const parent = orderBtn.locator("..");
    const imgs = parent.locator("img");
    await expect(imgs).toHaveCount(0);
  });

  test("In-cafe banner uses orange/pink gradient classes", async ({ page }) => {
    const inCafeBanner = page.locator("button:has-text('in-cafe')").first();
    if (await inCafeBanner.isVisible()) {
      const classes = await inCafeBanner.getAttribute("class");
      expect(classes).toContain("from-brand-orange");
      expect(classes).toContain("via-brand-pink");
      expect(classes).toContain("to-brand-orange");
    }
  });

  test("TikTok uses an img element instead of icon", async ({ page }) => {
    const tiktokLink = page.locator("a:has-text('TikTok')");
    const img = tiktokLink.locator("img");
    await expect(img).toBeVisible();
    const src = await img.getAttribute("src");
    expect(src).toContain("tiktok");
  });
});

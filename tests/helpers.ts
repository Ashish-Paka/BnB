import { type Page } from "@playwright/test";

export async function loginAsOwner(page: Page) {
  await page.goto("/dashboard");
  await page.fill('input[placeholder="Password"]', "bonesandbru2024");
  await page.click('button[type="submit"]');
  await page.waitForSelector("text=Bones & Bru", { timeout: 10000 });
}

import { expect, type APIRequestContext, type Page } from "@playwright/test";

const OWNER_PASSWORD = "bonesandbru2024";

export async function loginAsOwner(page: Page) {
  const token = await getOwnerToken(page.request);
  await page.addInitScript((ownerToken) => {
    localStorage.setItem("owner_token", ownerToken);
  }, token);
  await page.goto("/dashboard");
  await expect(page.getByText("Owner Dashboard")).toHaveCount(0, { timeout: 20000 });
}

export async function getOwnerToken(request: APIRequestContext) {
  const response = await request.post("/.netlify/functions/auth-login", {
    data: { password: OWNER_PASSWORD },
  });

  expect(response.ok()).toBe(true);
  const body = await response.json();
  return body.token as string;
}

export function ownerAuthHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function createMenuItem(
  request: APIRequestContext,
  token: string,
  item: Record<string, unknown>
) {
  const response = await request.post("/.netlify/functions/menu-manage", {
    headers: ownerAuthHeaders(token),
    data: item,
  });

  expect(response.ok()).toBe(true);
  return response.json();
}

export async function permanentlyDeleteMenuItem(
  request: APIRequestContext,
  token: string,
  id: string
) {
  const response = await request.delete("/.netlify/functions/menu-manage?permanent=true", {
    headers: ownerAuthHeaders(token),
    data: { id },
  });

  expect(response.ok()).toBe(true);
}

export async function updateMenuOrderingForTest(
  request: APIRequestContext,
  token: string,
  ordering: Record<string, unknown>
) {
  const response = await request.put("/.netlify/functions/menu-ordering", {
    headers: ownerAuthHeaders(token),
    data: ordering,
  });

  expect(response.ok()).toBe(true);
  return response.json();
}

export async function updateConfigForTest(
  request: APIRequestContext,
  token: string,
  updates: Record<string, unknown>
) {
  const response = await request.put("/.netlify/functions/config-update", {
    headers: ownerAuthHeaders(token),
    data: updates,
  });

  expect(response.ok()).toBe(true);
  return response.json();
}

export async function publishMenuDraftForTest(
  request: APIRequestContext,
  token: string
) {
  const response = await request.post("/.netlify/functions/menu-publish", {
    headers: ownerAuthHeaders(token),
  });

  expect(response.ok()).toBe(true);
  return response.json();
}

export async function fetchMenuPresetsForTest(
  request: APIRequestContext,
  token: string
) {
  const response = await request.get("/.netlify/functions/menu-presets", {
    headers: ownerAuthHeaders(token),
  });

  expect(response.ok()).toBe(true);
  return response.json();
}

export async function updateMenuPresetTitleForTest(
  request: APIRequestContext,
  token: string,
  index: number,
  title: string
) {
  const response = await request.put("/.netlify/functions/menu-presets", {
    headers: ownerAuthHeaders(token),
    data: { index, title },
  });

  expect(response.ok()).toBe(true);
  return response.json();
}

export async function activateMenuPresetForTest(
  request: APIRequestContext,
  token: string,
  index: number,
  draftOnly = false
) {
  const response = await request.post("/.netlify/functions/menu-presets", {
    headers: ownerAuthHeaders(token),
    data: { index, draft_only: draftOnly },
  });

  expect(response.ok()).toBe(true);
  return response.json();
}

export async function exportBackupForTest(
  request: APIRequestContext,
  token: string,
  save = false
) {
  const response = await request.get(`/.netlify/functions/backup-export${save ? "?save=true" : ""}`, {
    headers: ownerAuthHeaders(token),
  });

  expect(response.ok()).toBe(true);
  return response.json();
}

export async function importBackupForTest(
  request: APIRequestContext,
  token: string,
  data: Record<string, unknown>,
  mode: "overwrite" | "combine" = "overwrite"
) {
  const response = await request.post("/.netlify/functions/backup-import", {
    headers: ownerAuthHeaders(token),
    data: { ...data, mode },
  });

  expect(response.ok()).toBe(true);
  return response.json();
}

export async function deleteOrderForTest(
  request: APIRequestContext,
  token: string,
  id: string
) {
  const response = await request.delete(`/.netlify/functions/orders-delete?id=${id}`, {
    headers: ownerAuthHeaders(token),
  });

  expect(response.ok()).toBe(true);
  return response.json();
}

export async function deleteCustomerForTest(
  request: APIRequestContext,
  token: string,
  id: string
) {
  const response = await request.delete(`/.netlify/functions/customers-delete?id=${id}`, {
    headers: ownerAuthHeaders(token),
  });

  expect(response.ok()).toBe(true);
  return response.json();
}

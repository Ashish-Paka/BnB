import type { MenuItem, MenuOrdering, MenuPresetState, Order, Customer, Visit, PersistentCode } from "./types";

const API_BASE = "/.netlify/functions";

interface RequestSettings {
  auth?: boolean;
}

async function request<T>(
  path: string,
  options?: RequestInit,
  settings?: RequestSettings
): Promise<T> {
  const useAuth = settings?.auth ?? true;
  const token = useAuth ? localStorage.getItem("owner_token") : null;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${API_BASE}/${path}`, {
    cache: "no-store",
    ...options,
    headers: { ...headers, ...options?.headers },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || res.statusText);
  }
  return res.json();
}

async function publicRequest<T>(path: string, options?: RequestInit): Promise<T> {
  return request<T>(path, options, { auth: false });
}

// Menu
export const fetchMenu = () => request<MenuItem[]>("menu-list");
export const fetchPublishedMenu = () => request<MenuItem[]>("menu-list?snapshot=published");
export const fetchPublicMenu = () => publicRequest<MenuItem[]>("menu-list");

export const getMenuImageUrl = (itemId: string) =>
  `${API_BASE}/menu-image?id=${itemId}`;

export async function uploadMenuImage(itemId: string, imageBlob: Blob, published = false): Promise<void> {
  const token = localStorage.getItem("owner_token");
  const qs = published ? `id=${itemId}&published=true` : `id=${itemId}`;
  const res = await fetch(`${API_BASE}/menu-image?${qs}`, {
    method: "POST",
    headers: {
      "Content-Type": imageBlob.type,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: imageBlob,
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function deleteMenuItemImage(itemId: string): Promise<void> {
  const token = localStorage.getItem("owner_token");
  const res = await fetch(`${API_BASE}/menu-image?id=${itemId}`, {
    method: "DELETE",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
}

type MenuItemMutation = Partial<Omit<MenuItem, "subcategory">> & {
  subcategory?: string | null;
};

export const manageMenuItem = (
  method: "POST" | "PUT" | "DELETE",
  item: MenuItemMutation
) => request<MenuItem>("menu-manage", { method, body: JSON.stringify(item) });

export const fetchMenuIncludeDeleted = () =>
  request<MenuItem[]>("menu-list?include_deleted=true");

export const restoreMenuItem = (id: string) =>
  request<MenuItem>("menu-manage", {
    method: "PUT",
    body: JSON.stringify({ id, deleted_at: null }),
  });

export const permanentlyDeleteMenuItem = (id: string) =>
  request<MenuItem>("menu-manage?permanent=true", {
    method: "DELETE",
    body: JSON.stringify({ id }),
  });

export const reorderMenuItems = (items: { id: string; sort_order: number }[]) =>
  request<MenuItem[]>("menu-reorder", {
    method: "PUT",
    body: JSON.stringify({ items }),
  });

export const fetchMenuOrdering = () =>
  request<MenuOrdering>("menu-ordering");
export const fetchPublishedMenuOrdering = () =>
  request<MenuOrdering>("menu-ordering?snapshot=published");
export const fetchPublicMenuOrdering = () =>
  publicRequest<MenuOrdering>("menu-ordering");

export const updateMenuOrdering = (ordering: MenuOrdering) =>
  request<MenuOrdering>("menu-ordering", {
    method: "PUT",
    body: JSON.stringify(ordering),
  });

// Orders
export const fetchOrders = (status?: string) =>
  request<Order[]>(`orders-list${status ? `?status=${status}` : ""}`);

export const createOrder = (order: {
  customer_id?: string | null;
  customer_name: string;
  items: Order["items"];
  total_cents: number;
  is_free_reward?: boolean;
  notes?: string;
  created_by: "customer" | "owner";
}) => publicRequest<Order>("orders-create", { method: "POST", body: JSON.stringify(order) });

export const updateOrder = (id: string, updates: Partial<Order>) =>
  request<Order>("orders-update", {
    method: "PUT",
    body: JSON.stringify({ id, ...updates }),
  });

export const deleteOrder = (id: string) =>
  request<Order>("orders-update", {
    method: "PUT",
    body: JSON.stringify({ id, deleted_at: new Date().toISOString() }),
  });

export const restoreOrder = (id: string) =>
  request<Order>("orders-update", {
    method: "PUT",
    body: JSON.stringify({ id, deleted_at: null }),
  });

export const fetchAllOrders = () =>
  request<Order[]>("orders-list?include_deleted=true");

export const permanentlyDeleteOrder = (id: string) =>
  request<{ success: boolean; id: string }>(`orders-delete?id=${id}`, {
    method: "DELETE",
  });

export const fetchOrderStatus = (id: string) =>
  publicRequest<{ status: string; customer_name: string; customer_id: string | null }>(
    `orders-status?id=${id}`
  );

export const fetchOrderHistory = (customerId: string) =>
  request<
    {
      id: string;
      items: { item_name: string; quantity: number; options: Record<string, string | string[]> }[];
      total_cents: number;
      status: string;
      is_free_reward: boolean;
      created_at: string;
    }[]
  >(`orders-history?customer_id=${customerId}`);

// Customers
export const fetchCustomers = () => request<Customer[]>("customers-list");

export const fetchCustomer = (id: string) =>
  request<{ customer: Customer; orders: Order[]; visits: Visit[] }>(
    `customers-get?id=${id}`
  );

export const updateCustomer = (id: string, updates: Partial<Customer>) =>
  request<Customer>("customers-update", {
    method: "PUT",
    body: JSON.stringify({ id, ...updates }),
  });

export const mergeCustomers = (primaryId: string, secondaryId: string) =>
  request<Customer>("customers-merge", {
    method: "POST",
    body: JSON.stringify({ primaryId, secondaryId }),
  });

export const deleteCustomer = (id: string) =>
  request<{ success: boolean }>(`customers-delete?id=${id}`, {
    method: "DELETE",
  });

// Rewards
export const checkRewards = (identifier: {
  phone?: string;
  email?: string;
  name?: string;
}) =>
  publicRequest<{ customer: Customer | null }>("rewards-check", {
    method: "POST",
    body: JSON.stringify(identifier),
  });

// TOTP
export const generateTotp = () =>
  request<{ code: string; remaining_seconds: number; qr_uri: string }>(
    "totp-generate"
  );

export const verifyTotp = (code: string, customerId: string, redeem?: boolean) =>
  request<{
    valid: boolean;
    visit_count: number;
    total_visits?: number;
    reward_earned: boolean;
    redeemed: boolean;
    rewards_remaining?: number;
    message: string;
  }>("totp-verify", {
    method: "POST",
    body: JSON.stringify({ code, customer_id: customerId, ...(redeem ? { redeem: true } : {}) }),
  });

// Config
export const fetchPublicConfig = () =>
  publicRequest<{ in_store_ordering_enabled: boolean; menu_editing_active: boolean }>("config-public");

export const updateConfig = (updates: {
  in_store_ordering_enabled?: boolean;
  menu_editing_active?: boolean;
}) =>
  request<{ in_store_ordering_enabled: boolean; menu_editing_active: boolean }>("config-update", {
    method: "PUT",
    body: JSON.stringify(updates),
  });

export const publishMenuDraft = () =>
  request<{ success: boolean; published_items: number; category_order: string[] }>("menu-publish", {
    method: "POST",
  });

export const fetchMenuPresets = () =>
  request<MenuPresetState>("menu-presets");

export const updateMenuPresetTitle = (index: number, title: string) =>
  request<MenuPresetState>("menu-presets", {
    method: "PUT",
    body: JSON.stringify({ index, title }),
  });

export const activateMenuPreset = (index: number, draftOnly = false) =>
  request<MenuPresetState>("menu-presets", {
    method: "POST",
    body: JSON.stringify({ index, draft_only: draftOnly }),
  });

// Backup
type BackupData = {
  menu: MenuItem[];
  menu_ordering?: MenuOrdering;
  published_menu?: MenuItem[];
  published_menu_ordering?: MenuOrdering;
  menu_presets?: any;
  customers: Customer[];
  orders: Order[];
  visits: Visit[];
  config: any;
  images: Record<string, { data: string; content_type: string }>;
  published_images?: Record<string, { data: string; content_type: string }>;
  exported_at: string;
};

export const exportBackup = () => request<BackupData>("backup-export");

export const exportBackupOnline = () => request<BackupData>("backup-export?save=true");

export const fetchBackupStatus = () =>
  request<{ has_backup: boolean; exported_at?: string }>("backup-status");

export const importBackup = (data: any, mode: "overwrite" | "combine" = "overwrite") =>
  request<{ success: boolean; mode: string; imported: Record<string, number | boolean> }>("backup-import", {
    method: "POST",
    body: JSON.stringify({ ...data, mode }),
  });

export const restoreLatestBackup = () =>
  request<{ success: boolean; mode: string; imported: Record<string, number | boolean>; restored_from?: string | null }>(
    "backup-restore",
    {
      method: "POST",
    }
  );

// Auth
export const ownerLogin = (password: string) =>
  request<{ token: string }>("auth-login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });

export const verifyAuth = () => request<{ valid: boolean }>("auth-verify");

export const googleLogin = (idToken: string) =>
  request<{ token: string }>("auth-google", {
    method: "POST",
    body: JSON.stringify({ id_token: idToken }),
  });

export const addGoogleAccount = (idToken: string, role?: "secondary" | "admin") =>
  request<{ success: boolean; google_accounts: { email: string; role: "primary" | "secondary" | "admin" }[] }>("auth-link-google", {
    method: "POST",
    body: JSON.stringify({ action: "add", id_token: idToken, ...(role ? { role } : {}) }),
  });

export const removeGoogleAccount = (email: string) =>
  request<{ success: boolean; google_accounts: { email: string; role: "primary" | "secondary" | "admin" }[] }>("auth-link-google", {
    method: "POST",
    body: JSON.stringify({ action: "remove", email }),
  });

export const setPrimaryAccount = (email: string) =>
  request<{ success: boolean; google_accounts: { email: string; role: "primary" | "secondary" | "admin" }[] }>("auth-link-google", {
    method: "POST",
    body: JSON.stringify({ action: "set_primary", email }),
  });

export const replaceGoogleAccount = (idToken: string, oldEmail: string) =>
  request<{ success: boolean; google_accounts: { email: string; role: "primary" | "secondary" | "admin" }[] }>("auth-link-google", {
    method: "POST",
    body: JSON.stringify({ action: "replace", id_token: idToken, old_email: oldEmail }),
  });

export const fetchSettings = () =>
  request<{
    google_accounts: { email: string; role: "primary" | "secondary" | "admin" }[];
    login_method: string;
    can_change_password: boolean;
    is_owner: boolean;
    is_admin: boolean;
    has_admin_password: boolean;
  }>("auth-settings");

export const changePassword = (current_password: string, new_password: string, password_type: "owner" | "admin" = "owner") =>
  request<{ success: boolean }>("auth-change-password", {
    method: "POST",
    body: JSON.stringify({ current_password, new_password, password_type }),
  });

// Persistent verification codes
export const fetchPersistentCodes = () =>
  request<PersistentCode[]>("persistent-codes-list");

export const updatePersistentCode = (id: string, updates: {
  label?: string;
  enabled?: boolean;
  regenerate?: boolean;
  custom_code?: string;
}) =>
  request<PersistentCode[]>("persistent-codes-update", {
    method: "PUT",
    body: JSON.stringify({ id, ...updates }),
  });

export const addPersistentCode = (label?: string) =>
  request<PersistentCode[]>("persistent-codes-update", {
    method: "PUT",
    body: JSON.stringify({ action: "add", label }),
  });

export const deletePersistentCode = (id: string) =>
  request<PersistentCode[]>("persistent-codes-update", {
    method: "PUT",
    body: JSON.stringify({ action: "delete", id }),
  });

// Analytics
export const trackVisit = (data: {
  visitor_id: string;
  page_path: string;
  device_type: string;
  referrer: string;
  is_new_visitor: boolean;
  screen_width: number;
}) =>
  publicRequest<{ success: boolean }>("analytics-track", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const fetchAnalyticsData = (from: string, to: string, granularity: string = "day") =>
  request<{
    total_views: number;
    unique_visitors: number;
    device_breakdown: { mobile: number; tablet: number; desktop: number };
    referrer_breakdown: Record<string, number>;
    referrer_raw: Record<string, number>;
    daily_views: { date: string; views: number; unique: number; returning: number; mobile: number; desktop: number }[];
    new_vs_returning: { new: number; returning: number };
  }>(`analytics-data?from=${from}&to=${to}&granularity=${granularity}`);

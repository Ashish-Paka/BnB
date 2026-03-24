import type { MenuItem, Order, Customer, Visit } from "./types";

const API_BASE = "/.netlify/functions";

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token = localStorage.getItem("owner_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(`${API_BASE}/${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || res.statusText);
  }
  return res.json();
}

// Menu
export const fetchMenu = () => request<MenuItem[]>("menu-list");

export const getMenuImageUrl = (itemId: string) =>
  `${API_BASE}/menu-image?id=${itemId}`;

export async function uploadMenuImage(itemId: string, imageBlob: Blob): Promise<void> {
  const token = localStorage.getItem("owner_token");
  const res = await fetch(`${API_BASE}/menu-image?id=${itemId}`, {
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

export const manageMenuItem = (
  method: "POST" | "PUT" | "DELETE",
  item: Partial<MenuItem>
) => request<MenuItem>("menu-manage", { method, body: JSON.stringify(item) });

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
}) => request<Order>("orders-create", { method: "POST", body: JSON.stringify(order) });

export const updateOrder = (id: string, updates: Partial<Order>) =>
  request<Order>("orders-update", {
    method: "PUT",
    body: JSON.stringify({ id, ...updates }),
  });

export const fetchOrderStatus = (id: string) =>
  request<{ status: string; customer_name: string; customer_id: string | null }>(
    `orders-status?id=${id}`
  );

export const fetchOrderHistory = (customerId: string) =>
  request<
    {
      id: string;
      items: { item_name: string; quantity: number; options: Record<string, string> }[];
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
  request<{ customer: Customer | null }>("rewards-check", {
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
  request<{ in_store_ordering_enabled: boolean }>("config-public");

export const updateConfig = (updates: { in_store_ordering_enabled: boolean }) =>
  request<{ in_store_ordering_enabled: boolean }>("config-update", {
    method: "PUT",
    body: JSON.stringify(updates),
  });

// Backup
type BackupData = {
  menu: MenuItem[];
  customers: Customer[];
  orders: Order[];
  visits: Visit[];
  config: any;
  images: Record<string, { data: string; content_type: string }>;
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

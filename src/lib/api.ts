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

// Auth
export const ownerLogin = (password: string) =>
  request<{ token: string }>("auth-login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });

export const verifyAuth = () => request<{ valid: boolean }>("auth-verify");

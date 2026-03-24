import { getStore } from "@netlify/blobs";
import type { MenuItem, Customer, Order, Visit, AppConfig } from "./types.js";

const STORE_NAME = "bnb-data";

function store() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

// Generic helpers
async function getJSON<T>(key: string, fallback: T): Promise<T> {
  const s = store();
  const raw = await s.get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function setJSON<T>(key: string, data: T): Promise<void> {
  const s = store();
  await s.set(key, JSON.stringify(data));
}

// Menu
export const getMenu = () => getJSON<MenuItem[]>("menu", []);
export const setMenu = (items: MenuItem[]) => setJSON("menu", items);

// Customers
export const getCustomers = () => getJSON<Customer[]>("customers", []);
export const setCustomers = (customers: Customer[]) =>
  setJSON("customers", customers);

// Orders
export const getOrders = () => getJSON<Order[]>("orders", []);
export const setOrders = (orders: Order[]) => setJSON("orders", orders);

// Visits
export const getVisits = () => getJSON<Visit[]>("visits", []);
export const setVisits = (visits: Visit[]) => setJSON("visits", visits);

// Config
const DEFAULT_CONFIG: AppConfig = {
  totp_secret: "",
  totp_period_seconds: 600, // 10 minutes
  owner_password_hash: "",
  unknown_customer_seq: 0,
  in_store_ordering_enabled: false,
  google_accounts: [],
};
export const getConfig = () => getJSON<AppConfig>("config", DEFAULT_CONFIG);
export const setConfig = (config: AppConfig) => setJSON("config", config);

// Backup
export const getBackup = () => getJSON<any>("backup", null);
export const setBackup = (data: any) => setJSON("backup", data);

// Menu images
export async function getMenuImage(itemId: string): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  const s = store();
  const result = await s.getWithMetadata(`menu-image-${itemId}`, { type: "arrayBuffer" });
  if (!result || !result.data) return null;
  return { data: result.data as ArrayBuffer, contentType: (result.metadata as any)?.content_type || "image/webp" };
}

export async function setMenuImage(itemId: string, data: ArrayBuffer, contentType: string): Promise<void> {
  const s = store();
  await s.set(`menu-image-${itemId}`, new Uint8Array(data), { metadata: { content_type: contentType } });
}

export async function deleteMenuImage(itemId: string): Promise<void> {
  const s = store();
  try { await s.delete(`menu-image-${itemId}`); } catch {}
}

/** Migrate single owner_google_email → google_accounts array */
export async function ensureMigrated(config: AppConfig): Promise<AppConfig> {
  if (config.owner_google_email && (!config.google_accounts || config.google_accounts.length === 0)) {
    config.google_accounts = [{ email: config.owner_google_email.toLowerCase(), role: "primary" }];
    delete config.owner_google_email;
    await setConfig(config);
  }
  if (!config.google_accounts) config.google_accounts = [];
  return config;
}

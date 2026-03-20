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
};
export const getConfig = () => getJSON<AppConfig>("config", DEFAULT_CONFIG);
export const setConfig = (config: AppConfig) => setJSON("config", config);

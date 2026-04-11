import { getStore } from "@netlify/blobs";
import type {
  MenuItem,
  Customer,
  Order,
  Visit,
  AppConfig,
  MenuOrdering,
  MenuPresetStore,
  PersistentCode,
  AnalyticsVisit,
  SiteProfile,
} from "./types.js";

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
export const getPublishedMenu = () => getJSON<MenuItem[] | null>("menu-published", null);
export const setPublishedMenu = (items: MenuItem[]) => setJSON("menu-published", items);

// Menu ordering
export const getMenuOrdering = () => getJSON<MenuOrdering>("menu-ordering", { category_order: [], subcategory_order: {} });
export const setMenuOrdering = (ordering: MenuOrdering) => setJSON("menu-ordering", ordering);
export const getPublishedMenuOrdering = () =>
  getJSON<MenuOrdering | null>("menu-ordering-published", null);
export const setPublishedMenuOrdering = (ordering: MenuOrdering) =>
  setJSON("menu-ordering-published", ordering);
export const getMenuPresetStore = () => getJSON<MenuPresetStore | null>("menu-presets", null);
export const setMenuPresetStore = (store: MenuPresetStore) => setJSON("menu-presets", store);

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
  menu_editing_active: false,
  google_accounts: [],
};
export const getConfig = () => getJSON<AppConfig>("config", DEFAULT_CONFIG);
export const setConfig = (config: AppConfig) => setJSON("config", config);

// Backup
export const getBackup = () => getJSON<any>("backup", null);
export const setBackup = (data: any) => setJSON("backup", data);
export const getBackupImages = () => getJSON<Record<string, { data: string; content_type: string }>>("backup-images", {});
export const setBackupImages = (images: Record<string, { data: string; content_type: string }>) => setJSON("backup-images", images);
export const getBackupPublishedImages = () => getJSON<Record<string, { data: string; content_type: string }>>("backup-published-images", {});
export const setBackupPublishedImages = (images: Record<string, { data: string; content_type: string }>) => setJSON("backup-published-images", images);

// Persistent verification codes
export const getPersistentCodes = () => getJSON<PersistentCode[]>("persistent-codes", []);
export const setPersistentCodes = (codes: PersistentCode[]) => setJSON("persistent-codes", codes);

// Analytics
export const getAnalytics = () => getJSON<AnalyticsVisit[]>("analytics", []);
export const setAnalytics = (visits: AnalyticsVisit[]) => setJSON("analytics", visits);

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

export async function getPublishedMenuImage(itemId: string): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  const s = store();
  const result = await s.getWithMetadata(`menu-image-published-${itemId}`, { type: "arrayBuffer" });
  if (!result || !result.data) return null;
  return { data: result.data as ArrayBuffer, contentType: (result.metadata as any)?.content_type || "image/webp" };
}

export async function setPublishedMenuImage(itemId: string, data: ArrayBuffer, contentType: string): Promise<void> {
  const s = store();
  await s.set(`menu-image-published-${itemId}`, new Uint8Array(data), { metadata: { content_type: contentType } });
}

// Site profile
const DEFAULT_SITE_PROFILE: SiteProfile = {
  carousel_images: ["/bg1.webp", "/coffeebar.jpeg", "/bru.webp", "/dogtreats.jpeg", "/shop.webp"],
  address_text: "410 W 1st St #104, Tempe, AZ 85281",
  address_link: "https://maps.app.goo.gl/Ztxx4ZxxPG5SRg33A",
  address_enabled: true,
  google_url: "https://share.google/ywUaCuyd8boFskL5d",
  google_enabled: true,
  instagram_url: "https://www.instagram.com/bonesandbru?igsh=NWY3Znc0OTZ4cmty",
  instagram_enabled: true,
  facebook_url: "https://www.facebook.com/share/14WviUCEUSy/",
  facebook_enabled: true,
  tiktok_url: "https://www.tiktok.com/@bonesandbru",
  tiktok_enabled: true,
  owner_names: "John | Charity | Bru",
  phone: "7605096910",
  email: "johngagne@bonesandbru.com",
  contact_enabled: true,
  shop_url: "https://bonesandbru.com/",
  shop_text: "Visit Bonesandbru.com",
  shop_enabled: true,
  walkthrough_enabled: true,
  review_page_url: "https://g.page/r/CUGEACVcA-PbEAE/review",
  review_page_enabled: true,
};
export const getSiteProfile = () => getJSON<SiteProfile>("site-profile", DEFAULT_SITE_PROFILE);
export const setSiteProfile = (profile: SiteProfile) => setJSON("site-profile", profile);

// Carousel images
export async function getCarouselImage(id: string): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  const s = store();
  const result = await s.getWithMetadata(`carousel-image-${id}`, { type: "arrayBuffer" });
  if (!result || !result.data) return null;
  return { data: result.data as ArrayBuffer, contentType: (result.metadata as any)?.content_type || "image/webp" };
}
export async function setCarouselImage(id: string, data: ArrayBuffer, contentType: string): Promise<void> {
  const s = store();
  await s.set(`carousel-image-${id}`, new Uint8Array(data), { metadata: { content_type: contentType } });
}
export async function deleteCarouselImage(id: string): Promise<void> {
  const s = store();
  try { await s.delete(`carousel-image-${id}`); } catch {}
}

// Logo image
export async function getLogoImage(): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  const s = store();
  const result = await s.getWithMetadata("logo-image", { type: "arrayBuffer" });
  if (!result || !result.data) return null;
  return { data: result.data as ArrayBuffer, contentType: (result.metadata as any)?.content_type || "image/webp" };
}
export async function setLogoImage(data: ArrayBuffer, contentType: string): Promise<void> {
  const s = store();
  await s.set("logo-image", new Uint8Array(data), { metadata: { content_type: contentType } });
}
export async function deleteLogoImage(): Promise<void> {
  const s = store();
  try { await s.delete("logo-image"); } catch {}
}

// Walkthrough video
export async function getWalkthroughVideo(): Promise<{ data: ArrayBuffer; contentType: string } | null> {
  const s = store();
  const result = await s.getWithMetadata("walkthrough-video", { type: "arrayBuffer" });
  if (!result || !result.data) return null;
  return { data: result.data as ArrayBuffer, contentType: (result.metadata as any)?.content_type || "video/mp4" };
}
export async function setWalkthroughVideo(data: ArrayBuffer, contentType: string): Promise<void> {
  const s = store();
  await s.set("walkthrough-video", new Uint8Array(data), { metadata: { content_type: contentType } });
}
export async function deleteWalkthroughVideo(): Promise<void> {
  const s = store();
  try { await s.delete("walkthrough-video"); } catch {}
}

// Backup blobs for profile media (stored separately to avoid size limits)
export const getBackupCarouselImages = () => getJSON<Record<string, { data: string; content_type: string }>>("backup-carousel-images", {});
export const setBackupCarouselImages = (images: Record<string, { data: string; content_type: string }>) => setJSON("backup-carousel-images", images);
export const getBackupLogoImage = () => getJSON<{ data: string; content_type: string } | null>("backup-logo-image", null);
export const setBackupLogoImage = (image: { data: string; content_type: string } | null) => setJSON("backup-logo-image", image);
export const getBackupWalkthroughVideo = () => getJSON<{ data: string; content_type: string } | null>("backup-walkthrough-video", null);
export const setBackupWalkthroughVideo = (video: { data: string; content_type: string } | null) => setJSON("backup-walkthrough-video", video);

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

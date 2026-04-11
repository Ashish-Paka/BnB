export interface MenuItemOption {
  name: string;
  choices: { label: string; extra_cents: number }[];
  min_selections?: number;
  max_selections?: number;
  show_requirement_label?: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  base_price_cents: number;
  category: string;
  subcategory?: string;
  is_available: boolean;
  sort_order: number;
  options?: MenuItemOption[];
  has_image?: boolean;
  deleted_at?: string | null;
}

export interface MenuOrdering {
  category_order: string[];
  subcategory_order: Record<string, string[]>;
}

export interface MenuPresetImage {
  data: string;
  content_type: string;
}

export interface MenuPreset {
  index: number;
  title: string;
  menu: MenuItem[];
  menu_ordering: MenuOrdering;
  published_menu: MenuItem[];
  published_menu_ordering: MenuOrdering;
  images: Record<string, MenuPresetImage>;
  published_images: Record<string, MenuPresetImage>;
}

export interface MenuPresetStore {
  active_preset_index: number;
  presets: MenuPreset[];
}

export interface BackupArchive {
  exported_at: string;
  zip_base64: string;
}

export interface Customer {
  id: string;
  names: string[];
  email: string | null;
  phone: string | null;
  visit_count: number;
  total_visits: number;
  rewards_earned: number;
  rewards_redeemed: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  menu_item_id: string;
  item_name: string;
  quantity: number;
  price_cents: number;
  options: Record<string, string | string[]>;
}

export interface Order {
  id: string;
  customer_id: string | null;
  customer_name: string;
  items: OrderItem[];
  total_cents: number;
  status: "pending" | "preparing" | "ready" | "completed" | "cancelled";
  is_free_reward: boolean;
  notes: string;
  created_by: "customer" | "owner";
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface Visit {
  id: string;
  customer_id: string;
  verified_at: string;
  totp_code_used: string;
  date: string;
}

export interface GoogleAccount {
  email: string;
  role: "primary" | "secondary" | "admin";
}

export interface AppConfig {
  totp_secret: string;
  totp_period_seconds: number;
  owner_password_hash: string;
  unknown_customer_seq: number;
  in_store_ordering_enabled: boolean;
  menu_editing_active?: boolean;
  admin_password_hash?: string;
  google_accounts?: GoogleAccount[];
  /** @deprecated — migrated to google_accounts */
  owner_google_email?: string;
}

export interface PersistentCode {
  id: string;
  label: string;
  code: string;
  enabled: boolean;
  created_at: string;
}

export interface SiteProfile {
  carousel_images: string[];
  address_text: string;
  address_link: string;
  address_enabled: boolean;
  google_url: string;
  google_enabled: boolean;
  instagram_url: string;
  instagram_enabled: boolean;
  facebook_url: string;
  facebook_enabled: boolean;
  tiktok_url: string;
  tiktok_enabled: boolean;
  owner_names: string;
  phone: string;
  email: string;
  contact_enabled: boolean;
  shop_url: string;
  shop_text: string;
  shop_enabled: boolean;
  walkthrough_enabled: boolean;
  review_page_url: string;
  review_page_enabled: boolean;
}

export interface AnalyticsVisit {
  visitor_id: string;
  timestamp: string;
  page_path: string;
  device_type: "mobile" | "tablet" | "desktop";
  referrer: string;
  is_new_visitor: boolean;
  screen_width: number;
}

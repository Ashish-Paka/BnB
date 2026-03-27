export interface MenuItemOption {
  name: string;
  choices: { label: string; extra_cents: number }[];
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  base_price_cents: number;
  category: string;
  is_available: boolean;
  sort_order: number;
  options?: MenuItemOption[];
  has_image?: boolean;
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
  options: Record<string, string>;
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
  admin_password_hash?: string;
  google_accounts?: GoogleAccount[];
  /** @deprecated — migrated to google_accounts */
  owner_google_email?: string;
}

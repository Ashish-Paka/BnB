export const REWARD_THRESHOLD = 10;

export const DEFAULT_CATEGORIES = ["coffee", "lemonade"];
export const DEFAULT_CATEGORY = "coffee";

export const CATEGORY_LABELS: Record<string, string> = {
  coffee: "Coffee",
  lemonade: "Drinks",
};

export function categoryLabel(slug: string): string {
  return CATEGORY_LABELS[slug] || slug.charAt(0).toUpperCase() + slug.slice(1);
}

export function deriveCategories(items: { category: string }[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const cat of DEFAULT_CATEGORIES) {
    if (items.some((i) => i.category === cat)) {
      seen.add(cat);
      ordered.push(cat);
    }
  }
  for (const item of items) {
    if (!seen.has(item.category)) {
      seen.add(item.category);
      ordered.push(item.category);
    }
  }
  return ordered;
}

export const ORDER_STATUS_FLOW = [
  "pending",
  "preparing",
  "ready",
  "completed",
] as const;

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

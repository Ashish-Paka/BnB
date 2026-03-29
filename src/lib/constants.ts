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

/**
 * Derive category order from items. If an explicit ordering is provided,
 * use it as the primary source, appending any categories not in the ordering.
 */
export function deriveCategories(
  items: { category: string }[],
  explicitOrder?: string[]
): string[] {
  const present = new Set(items.map((i) => i.category));

  if (explicitOrder && explicitOrder.length > 0) {
    const ordered: string[] = [];
    const seen = new Set<string>();
    // First: explicit order (only categories that have items)
    for (const cat of explicitOrder) {
      if (present.has(cat) && !seen.has(cat)) {
        seen.add(cat);
        ordered.push(cat);
      }
    }
    // Then: any remaining categories not in explicit order
    for (const cat of DEFAULT_CATEGORIES) {
      if (present.has(cat) && !seen.has(cat)) {
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

  // Fallback: DEFAULT_CATEGORIES first, then custom in order of first appearance
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

/**
 * Derive subcategories within a category from items.
 * If an explicit ordering is provided, use it as primary source.
 * Items without a subcategory are grouped under "" (empty string).
 */
export function deriveSubcategories(
  items: { category: string; subcategory?: string }[],
  category: string,
  explicitOrder?: string[]
): string[] {
  const catItems = items.filter((i) => i.category === category);
  const present = new Set(catItems.map((i) => i.subcategory || ""));

  if (explicitOrder && explicitOrder.length > 0) {
    const ordered: string[] = [];
    const seen = new Set<string>();
    for (const sub of explicitOrder) {
      if (present.has(sub) && !seen.has(sub)) {
        seen.add(sub);
        ordered.push(sub);
      }
    }
    // Append any remaining subcategories
    for (const item of catItems) {
      const sub = item.subcategory || "";
      if (!seen.has(sub)) {
        seen.add(sub);
        ordered.push(sub);
      }
    }
    return ordered;
  }

  // Fallback: "" first (uncategorized), then in order of first appearance
  const seen = new Set<string>();
  const ordered: string[] = [];
  // Put uncategorized first if present
  if (present.has("")) {
    seen.add("");
    ordered.push("");
  }
  for (const item of catItems) {
    const sub = item.subcategory || "";
    if (!seen.has(sub)) {
      seen.add(sub);
      ordered.push(sub);
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

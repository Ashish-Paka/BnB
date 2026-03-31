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

export const MENU_LAYOUT_ITEM_PREFIX = "item:";
const MENU_LAYOUT_SUBCATEGORY_PREFIX = "sub:";

export function menuLayoutItemToken(itemId: string): string {
  return `${MENU_LAYOUT_ITEM_PREFIX}${itemId}`;
}

export function isMenuLayoutItemToken(token: string): boolean {
  return token.startsWith(MENU_LAYOUT_ITEM_PREFIX);
}

export function menuLayoutItemIdFromToken(token: string): string {
  return token.slice(MENU_LAYOUT_ITEM_PREFIX.length);
}

export type CategoryLayoutEntry<T> =
  | { kind: "item"; id: string; token: string; item: T }
  | { kind: "subcategory"; id: string; token: string; subcategory: string; items: T[] };

export function deriveCategoryLayout<
  T extends { id: string; category: string; subcategory?: string; sort_order?: number }
>(
  items: T[],
  category: string,
  explicitOrder?: string[]
): CategoryLayoutEntry<T>[] {
  const catItems = [...items]
    .filter((item) => item.category === category)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const uncategorizedItems = catItems.filter((item) => !(item.subcategory || ""));
  const uncategorizedById = new Map(uncategorizedItems.map((item) => [item.id, item]));
  const subcategoryItems = new Map<string, T[]>();

  for (const item of catItems) {
    const subcategory = item.subcategory || "";
    if (!subcategory) continue;
    const existing = subcategoryItems.get(subcategory);
    if (existing) existing.push(item);
    else subcategoryItems.set(subcategory, [item]);
  }

  const entries: CategoryLayoutEntry<T>[] = [];
  const seenItemIds = new Set<string>();
  const seenSubcategories = new Set<string>();

  const appendItem = (item: T | undefined) => {
    if (!item || seenItemIds.has(item.id)) return;
    seenItemIds.add(item.id);
    entries.push({
      kind: "item",
      id: menuLayoutItemToken(item.id),
      token: menuLayoutItemToken(item.id),
      item,
    });
  };

  const appendSubcategory = (subcategory: string) => {
    const groupItems = subcategoryItems.get(subcategory);
    if (!groupItems || seenSubcategories.has(subcategory)) return;
    seenSubcategories.add(subcategory);
    entries.push({
      kind: "subcategory",
      id: `${MENU_LAYOUT_SUBCATEGORY_PREFIX}${subcategory}`,
      token: subcategory,
      subcategory,
      items: groupItems,
    });
  };

  const appendUncategorizedItems = () => {
    for (const item of uncategorizedItems) {
      appendItem(item);
    }
  };

  if (explicitOrder && explicitOrder.length > 0) {
    for (const token of explicitOrder) {
      const normalized = token === "__none__" ? "" : token;
      if (!normalized) {
        appendUncategorizedItems();
        continue;
      }
      if (isMenuLayoutItemToken(normalized)) {
        appendItem(uncategorizedById.get(menuLayoutItemIdFromToken(normalized)));
        continue;
      }
      appendSubcategory(normalized);
    }
  }

  for (const item of catItems) {
    const subcategory = item.subcategory || "";
    if (subcategory) appendSubcategory(subcategory);
    else appendItem(item);
  }

  return entries;
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
      const normalized = sub === "__none__" ? "" : sub;
      if (isMenuLayoutItemToken(normalized)) continue;
      if (present.has(normalized) && !seen.has(normalized)) {
        seen.add(normalized);
        ordered.push(normalized);
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

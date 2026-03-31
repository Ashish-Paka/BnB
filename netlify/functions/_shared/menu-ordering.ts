import type { MenuItem, MenuOrdering } from "./types.js";

const NONE_SUBCATEGORY_ID = "__none__";
const MENU_LAYOUT_ITEM_PREFIX = "item:";

export const EMPTY_MENU_ORDERING: MenuOrdering = {
  category_order: [],
  subcategory_order: {},
};

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const entry of value) {
    if (typeof entry !== "string" || seen.has(entry)) continue;
    seen.add(entry);
    normalized.push(entry);
  }

  return normalized;
}

function normalizeSubcategoryList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const entry of value) {
    if (typeof entry !== "string") continue;

    const token = entry === NONE_SUBCATEGORY_ID ? "" : entry;
    if (seen.has(token)) continue;

    seen.add(token);
    normalized.push(token);
  }

  return normalized;
}

export function normalizeMenuOrdering(value: unknown): MenuOrdering {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const rawSubcategoryOrder =
    raw.subcategory_order && typeof raw.subcategory_order === "object"
      ? raw.subcategory_order as Record<string, unknown>
      : {};

  const subcategory_order = Object.fromEntries(
    Object.entries(rawSubcategoryOrder).map(([category, list]) => [
      category,
      normalizeSubcategoryList(list),
    ])
  );

  return {
    category_order: normalizeStringList(raw.category_order),
    subcategory_order,
  };
}

export function sanitizeMenuOrdering(orderingValue: unknown, items: MenuItem[]): MenuOrdering {
  const ordering = normalizeMenuOrdering(orderingValue);
  const activeItems = items.filter((item) => !item.deleted_at);
  const category_order: string[] = [];
  const seenCategories = new Set<string>();

  for (const category of ordering.category_order) {
    if (!activeItems.some((item) => item.category === category) || seenCategories.has(category)) continue;
    seenCategories.add(category);
    category_order.push(category);
  }

  for (const item of activeItems) {
    if (seenCategories.has(item.category)) continue;
    seenCategories.add(item.category);
    category_order.push(item.category);
  }

  const subcategory_order: Record<string, string[]> = {};

  for (const category of category_order) {
    const categoryItems = activeItems.filter((item) => item.category === category);
    const namedSubcategories = new Set(
      categoryItems
        .map((item) => item.subcategory || "")
        .filter((subcategory) => !!subcategory)
    );

    // When a category has no named subcategories, its item order should come
    // exclusively from sort_order. Old item tokens from previous layouts create
    // "stuck" customer ordering across presets, so drop them here.
    if (namedSubcategories.size === 0) continue;

    const uncategorizedItemIds = new Set(
      categoryItems
        .filter((item) => !(item.subcategory || ""))
        .map((item) => item.id)
    );

    const tokens: string[] = [];
    const seenTokens = new Set<string>();

    for (const token of ordering.subcategory_order[category] ?? []) {
      if (token === "") {
        if (uncategorizedItemIds.size === 0 || seenTokens.has(token)) continue;
        seenTokens.add(token);
        tokens.push(token);
        continue;
      }

      if (token.startsWith(MENU_LAYOUT_ITEM_PREFIX)) {
        const itemId = token.slice(MENU_LAYOUT_ITEM_PREFIX.length);
        if (!uncategorizedItemIds.has(itemId) || seenTokens.has(token)) continue;
        seenTokens.add(token);
        tokens.push(token);
        continue;
      }

      if (!namedSubcategories.has(token) || seenTokens.has(token)) continue;
      seenTokens.add(token);
      tokens.push(token);
    }

    if (tokens.length > 0) {
      subcategory_order[category] = tokens;
    }
  }

  return { category_order, subcategory_order };
}

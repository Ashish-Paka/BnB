import type { MenuItem } from "./types.js";

export function getNextSortOrderForCategory(items: MenuItem[], category: string): number {
  return (
    items
      .filter((item) => item.category === category && !item.deleted_at)
      .reduce((max, item) => Math.max(max, item.sort_order ?? 0), 0) + 1
  );
}

export function normalizeMenuSortOrders(items: MenuItem[]): { items: MenuItem[]; changed: boolean } {
  const nextItems = items.map((item) => ({ ...item }));
  const itemsByCategory = new Map<string, { item: MenuItem; index: number }[]>();

  nextItems.forEach((item, index) => {
    const existing = itemsByCategory.get(item.category);
    if (existing) {
      existing.push({ item, index });
    } else {
      itemsByCategory.set(item.category, [{ item, index }]);
    }
  });

  let changed = false;

  for (const entries of itemsByCategory.values()) {
    entries
      .slice()
      .sort((a, b) => {
        const deletedA = a.item.deleted_at ? 1 : 0;
        const deletedB = b.item.deleted_at ? 1 : 0;
        if (deletedA !== deletedB) return deletedA - deletedB;
        const sortA = a.item.sort_order ?? 0;
        const sortB = b.item.sort_order ?? 0;
        if (sortA !== sortB) return sortA - sortB;
        return a.index - b.index;
      })
      .forEach(({ item }, index) => {
        const normalizedSortOrder = index + 1;
        if ((item.sort_order ?? 0) !== normalizedSortOrder) {
          item.sort_order = normalizedSortOrder;
          changed = true;
        }
      });
  }

  return { items: nextItems, changed };
}

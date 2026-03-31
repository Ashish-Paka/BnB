import type { Context } from "@netlify/functions";
import {
  getMenu,
  getMenuImage,
  getMenuOrdering,
  setMenu,
  setMenuOrdering,
  setPublishedMenuImage,
  setPublishedMenu,
  setPublishedMenuOrdering,
} from "./_shared/store.js";
import { requireOwner } from "./_shared/auth.js";
import { syncActiveMenuPreset } from "./_shared/menu-presets.js";
import { normalizeMenuSortOrders } from "./_shared/menu-sort.js";
import { sanitizeMenuOrdering } from "./_shared/menu-ordering.js";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const headers = Object.fromEntries(req.headers.entries());
  if (!requireOwner(headers)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [storedMenu, storedOrdering] = await Promise.all([getMenu(), getMenuOrdering()]);
  const normalized = normalizeMenuSortOrders(storedMenu);
  const menu = normalized.items;
  const ordering = sanitizeMenuOrdering(storedOrdering, menu);
  await Promise.all([
    normalized.changed ? setMenu(menu) : Promise.resolve(),
    JSON.stringify(storedOrdering) !== JSON.stringify(ordering) ? setMenuOrdering(ordering) : Promise.resolve(),
    setPublishedMenu(menu),
    setPublishedMenuOrdering(ordering),
  ]);

  await Promise.all(
    menu
      .filter((item) => item.has_image)
      .map(async (item) => {
        const image = await getMenuImage(item.id);
        if (!image) return;
        await setPublishedMenuImage(item.id, image.data, image.contentType);
      })
  );
  await syncActiveMenuPreset();

  return Response.json({
    success: true,
    published_items: menu.length,
    category_order: ordering.category_order,
  });
};

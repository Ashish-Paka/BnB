import type { Context } from "@netlify/functions";
import { requireOwner } from "./_shared/auth.js";
import {
  getMenu,
  getCustomers,
  getOrders,
  getVisits,
  getConfig,
  getMenuImage,
  getPublishedMenu,
  getPublishedMenuImage,
  getMenuOrdering,
  getPublishedMenuOrdering,
  getMenuPresetStore,
  setMenuOrdering,
  setPublishedMenuOrdering,
  setBackup,
} from "./_shared/store.js";
import { createBackupArchive } from "./_shared/backup-archive.js";
import { ensureMenuPresets } from "./_shared/menu-presets.js";
import { sanitizeMenuOrdering } from "./_shared/menu-ordering.js";

export default async (req: Request, _context: Context) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const headers = Object.fromEntries(req.headers.entries());
  if (!requireOwner(headers)) {
    return new Response("Unauthorized", { status: 401 });
  }

  await ensureMenuPresets();
  const [
    menu,
    menu_ordering,
    published_menu,
    published_menu_ordering,
    menu_presets,
    customers,
    orders,
    visits,
    config,
  ] = await Promise.all([
    getMenu(),
    getMenuOrdering(),
    getPublishedMenu(),
    getPublishedMenuOrdering(),
    getMenuPresetStore(),
    getCustomers(),
    getOrders(),
    getVisits(),
    getConfig(),
  ]);

  // Export menu images as base64
  const images: Record<string, { data: string; content_type: string }> = {};
  const itemsWithImages = menu.filter((m) => m.has_image);
  await Promise.all(
    itemsWithImages.map(async (item) => {
      try {
        const img = await getMenuImage(item.id);
        if (img) {
          const base64 = Buffer.from(img.data).toString("base64");
          images[item.id] = { data: base64, content_type: img.contentType };
        }
      } catch {}
    })
  );

  const published_images: Record<string, { data: string; content_type: string }> = {};
  const publishedItemsWithImages = (published_menu ?? menu).filter((m) => m.has_image);
  await Promise.all(
    publishedItemsWithImages.map(async (item) => {
      try {
        const img = await getPublishedMenuImage(item.id);
        if (img) {
          const base64 = Buffer.from(img.data).toString("base64");
          published_images[item.id] = { data: base64, content_type: img.contentType };
        }
      } catch {}
    })
  );

  const sanitizedMenuOrdering = sanitizeMenuOrdering(menu_ordering, menu);
  const resolvedPublishedMenu = published_menu ?? menu;
  const sanitizedPublishedOrdering = sanitizeMenuOrdering(
    published_menu_ordering ?? menu_ordering,
    resolvedPublishedMenu
  );

  await Promise.all([
    JSON.stringify(menu_ordering) !== JSON.stringify(sanitizedMenuOrdering)
      ? setMenuOrdering(sanitizedMenuOrdering)
      : Promise.resolve(),
    JSON.stringify(published_menu_ordering) !== JSON.stringify(sanitizedPublishedOrdering)
      ? setPublishedMenuOrdering(sanitizedPublishedOrdering)
      : Promise.resolve(),
  ]);

  const data = {
    menu,
    menu_ordering: sanitizedMenuOrdering,
    published_menu: resolvedPublishedMenu,
    published_menu_ordering: sanitizedPublishedOrdering,
    menu_presets,
    customers,
    orders,
    visits,
    config,
    images,
    published_images,
    exported_at: new Date().toISOString(),
  };

  // If ?save=true, store backup to blobs (online backup)
  const url = new URL(req.url);
  if (url.searchParams.get("save") === "true") {
    await setBackup(await createBackupArchive(data));
  }

  return Response.json(data);
};

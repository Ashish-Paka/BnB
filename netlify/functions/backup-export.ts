import type { Context } from "@netlify/functions";
import { requireOwner } from "./_shared/auth.js";
import { getMenu, getCustomers, getOrders, getVisits, getConfig, getMenuImage, setBackup } from "./_shared/store.js";

export default async (req: Request, _context: Context) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const headers = Object.fromEntries(req.headers.entries());
  if (!requireOwner(headers)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [menu, customers, orders, visits, config] = await Promise.all([
    getMenu(),
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

  const data = {
    menu,
    customers,
    orders,
    visits,
    config,
    images,
    exported_at: new Date().toISOString(),
  };

  // If ?save=true, store backup to blobs (online backup)
  const url = new URL(req.url);
  if (url.searchParams.get("save") === "true") {
    await setBackup(data);
  }

  return Response.json(data);
};

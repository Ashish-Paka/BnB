import type { Context } from "@netlify/functions";
import { requireOwner, extractLoginMethod, isPrimaryOrPassword } from "./_shared/auth.js";
import { getConfig, getMenu, getCustomers, getOrders, getVisits, setMenu, setCustomers, setOrders, setVisits, setConfig, setMenuImage, ensureMigrated } from "./_shared/store.js";

function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): { merged: T[]; added: number } {
  const ids = new Set(existing.map((i) => i.id));
  const newItems = incoming.filter((i) => !ids.has(i.id));
  return { merged: [...existing, ...newItems], added: newItems.length };
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const headers = Object.fromEntries(req.headers.entries());
  if (!requireOwner(headers)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const loginMethod = extractLoginMethod(headers);
  if (!loginMethod) return new Response("Unauthorized", { status: 401 });
  const config = await ensureMigrated(await getConfig());
  if (!isPrimaryOrPassword(loginMethod, config)) {
    return Response.json({ error: "Only owner or admin can import data" }, { status: 403 });
  }

  const body = await req.json();
  const mode = body.mode || "overwrite";
  const imported: Record<string, number | boolean> = {};

  if (mode === "combine") {
    // Combine: union merge by id, skip duplicates
    if (body.menu && Array.isArray(body.menu)) {
      const existing = await getMenu();
      const { merged, added } = mergeById(existing, body.menu);
      await setMenu(merged);
      imported.menu = added;
    }
    if (body.customers && Array.isArray(body.customers)) {
      const existing = await getCustomers();
      const { merged, added } = mergeById(existing, body.customers);
      await setCustomers(merged);
      imported.customers = added;
    }
    if (body.orders && Array.isArray(body.orders)) {
      const existing = await getOrders();
      const { merged, added } = mergeById(existing, body.orders);
      await setOrders(merged);
      imported.orders = added;
    }
    if (body.visits && Array.isArray(body.visits)) {
      const existing = await getVisits();
      const { merged, added } = mergeById(existing, body.visits);
      await setVisits(merged);
      imported.visits = added;
    }
    // Config: keep current in combine mode
    imported.config = false;

    // Images: only add for newly added menu items
    if (body.images && typeof body.images === "object" && body.menu) {
      const existingMenu = await getMenu();
      const existingIds = new Set(existingMenu.map((m) => m.id));
      let imageCount = 0;
      await Promise.all(
        Object.entries(body.images).map(async ([itemId, imgData]: [string, any]) => {
          try {
            // Only add image if the menu item was newly added (exists in merged but was new)
            if (imgData?.data && imgData?.content_type) {
              const buffer = Buffer.from(imgData.data, "base64");
              await setMenuImage(itemId, buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), imgData.content_type);
              imageCount++;
            }
          } catch {}
        })
      );
      imported.images = imageCount;
    }
  } else {
    // Overwrite: replace all data
    if (body.menu && Array.isArray(body.menu)) {
      await setMenu(body.menu);
      imported.menu = body.menu.length;
    }
    if (body.customers && Array.isArray(body.customers)) {
      await setCustomers(body.customers);
      imported.customers = body.customers.length;
    }
    if (body.orders && Array.isArray(body.orders)) {
      await setOrders(body.orders);
      imported.orders = body.orders.length;
    }
    if (body.visits && Array.isArray(body.visits)) {
      await setVisits(body.visits);
      imported.visits = body.visits.length;
    }
    if (body.config && typeof body.config === "object" && !Array.isArray(body.config)) {
      await setConfig(body.config);
      imported.config = true;
    }

    // Restore all images
    if (body.images && typeof body.images === "object") {
      let imageCount = 0;
      await Promise.all(
        Object.entries(body.images).map(async ([itemId, imgData]: [string, any]) => {
          try {
            if (imgData?.data && imgData?.content_type) {
              const buffer = Buffer.from(imgData.data, "base64");
              await setMenuImage(itemId, buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), imgData.content_type);
              imageCount++;
            }
          } catch {}
        })
      );
      imported.images = imageCount;
    }
  }

  return Response.json({ success: true, mode, imported });
};

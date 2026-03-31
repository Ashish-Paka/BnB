import {
  getCustomers,
  getMenu,
  getVisits,
  getOrders,
  setConfig,
  setCustomers,
  setMenu,
  setMenuImage,
  setMenuOrdering,
  setMenuPresetStore,
  setOrders,
  setPublishedMenu,
  setPublishedMenuImage,
  setPublishedMenuOrdering,
  setVisits,
  ensureMigrated,
  getConfig,
} from "./store.js";
import { ensureMenuPresets, syncActiveMenuPreset } from "./menu-presets.js";
import { normalizeMenuSortOrders } from "./menu-sort.js";
import { sanitizeMenuOrdering } from "./menu-ordering.js";

function mergeById<T extends { id: string }>(existing: T[], incoming: T[]): { merged: T[]; added: number } {
  const ids = new Set(existing.map((i) => i.id));
  const newItems = incoming.filter((i) => !ids.has(i.id));
  return { merged: [...existing, ...newItems], added: newItems.length };
}

async function restoreImages(
  images: Record<string, { data: string; content_type: string }> | undefined,
  published: boolean
): Promise<number> {
  if (!images || typeof images !== "object") return 0;

  let imageCount = 0;
  await Promise.all(
    Object.entries(images).map(async ([itemId, imgData]: [string, any]) => {
      try {
        if (!imgData?.data || !imgData?.content_type) return;
        const buffer = Buffer.from(imgData.data, "base64");
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        if (published) {
          await setPublishedMenuImage(itemId, arrayBuffer, imgData.content_type);
        } else {
          await setMenuImage(itemId, arrayBuffer, imgData.content_type);
        }
        imageCount++;
      } catch {}
    })
  );

  return imageCount;
}

export async function restoreBackupData(
  body: any,
  mode: "overwrite" | "combine" = "overwrite"
): Promise<Record<string, number | boolean>> {
  const imported: Record<string, number | boolean> = {};
  let normalizedMenu = body.menu && Array.isArray(body.menu) ? normalizeMenuSortOrders(body.menu).items : null;
  let normalizedPublishedMenu =
    body.published_menu && Array.isArray(body.published_menu)
      ? normalizeMenuSortOrders(body.published_menu).items
      : normalizedMenu;

  if (mode === "combine") {
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

    imported.config = false;
    imported.menu_presets = false;
    imported.menu_ordering = false;
    imported.published_menu = false;
    imported.published_menu_ordering = false;
    imported.published_images = false;
    imported.images = await restoreImages(body.images, false);
    await syncActiveMenuPreset();
    return imported;
  }

  if (body.menu && Array.isArray(body.menu)) {
    await setMenu(normalizedMenu);
    imported.menu = normalizedMenu.length;
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
    await setConfig(await ensureMigrated(body.config));
    imported.config = true;
  } else {
    await ensureMigrated(await getConfig());
  }
  if (body.menu_ordering && typeof body.menu_ordering === "object" && !Array.isArray(body.menu_ordering)) {
    await setMenuOrdering(sanitizeMenuOrdering(body.menu_ordering, normalizedMenu ?? await getMenu()));
    imported.menu_ordering = true;
  }
  if (body.published_menu && Array.isArray(body.published_menu)) {
    await setPublishedMenu(normalizedPublishedMenu);
    imported.published_menu = normalizedPublishedMenu.length;
  } else if (body.menu && Array.isArray(body.menu)) {
    await setPublishedMenu(normalizedMenu);
    imported.published_menu = normalizedMenu.length;
  }
  if (
    body.published_menu_ordering &&
    typeof body.published_menu_ordering === "object" &&
    !Array.isArray(body.published_menu_ordering)
  ) {
    await setPublishedMenuOrdering(
      sanitizeMenuOrdering(body.published_menu_ordering, normalizedPublishedMenu ?? normalizedMenu ?? await getMenu())
    );
    imported.published_menu_ordering = true;
  } else if (body.menu_ordering && typeof body.menu_ordering === "object" && !Array.isArray(body.menu_ordering)) {
    await setPublishedMenuOrdering(
      sanitizeMenuOrdering(body.menu_ordering, normalizedPublishedMenu ?? normalizedMenu ?? await getMenu())
    );
    imported.published_menu_ordering = true;
  }
  if (body.menu_presets && typeof body.menu_presets === "object" && !Array.isArray(body.menu_presets)) {
    await setMenuPresetStore(body.menu_presets);
    await ensureMenuPresets();
    imported.menu_presets = true;
  }

  imported.images = await restoreImages(body.images, false);
  imported.published_images = await restoreImages(body.published_images, true);

  if (!body.menu_presets) {
    await ensureMenuPresets();
  }

  return imported;
}

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
  getPublishedMenu,
  setPublishedMenu,
  setPublishedMenuImage,
  setPublishedMenuOrdering,
  setVisits,
  ensureMigrated,
  getConfig,
  setPersistentCodes,
  setAnalytics,
  getAnalytics,
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
  // Preserve exact sort_order values from the backup — don't re-number them.
  // normalizeMenuSortOrders is for edit-time housekeeping, not restore.
  let normalizedMenu = body.menu && Array.isArray(body.menu) ? body.menu : null;
  let normalizedPublishedMenu =
    body.published_menu && Array.isArray(body.published_menu)
      ? body.published_menu
      : normalizedMenu;

  if (mode === "combine") {
    if (body.menu && Array.isArray(body.menu)) {
      const existing = await getMenu();
      const existingIds = new Set(existing.map((i) => i.id));
      const newItems = (body.menu as any[]).filter((i) => !existingIds.has(i.id));
      if (newItems.length > 0) {
        // Insert restored items into the correct position by sort_order within their category
        const merged = [...existing];
        for (const item of newItems) {
          // Find the right insertion point: after the last item in the same category
          // with a lower sort_order, preserving the backup's ordering
          let insertIdx = merged.length;
          const sameCatItems = merged
            .map((m, i) => ({ m, i }))
            .filter(({ m }) => m.category === item.category);
          if (sameCatItems.length > 0) {
            // Find where this item fits by sort_order
            const afterItem = sameCatItems.find(({ m }) => (m.sort_order ?? 0) >= (item.sort_order ?? 0));
            insertIdx = afterItem ? afterItem.i : sameCatItems[sameCatItems.length - 1].i + 1;
          }
          merged.splice(insertIdx, 0, item);
        }
        await setMenu(merged);
        imported.menu = newItems.length;

        // Also restore menu_ordering from backup if items were added
        if (body.menu_ordering && typeof body.menu_ordering === "object") {
          await setMenuOrdering(body.menu_ordering);
          imported.menu_ordering = true;
        }
        if (body.published_menu_ordering && typeof body.published_menu_ordering === "object") {
          await setPublishedMenuOrdering(body.published_menu_ordering);
          imported.published_menu_ordering = true;
        }
        // Also restore published menu with re-added items
        if (body.published_menu && Array.isArray(body.published_menu)) {
          const existingPub = (await getPublishedMenu()) ?? existing;
          const pubIds = new Set(existingPub.map((i) => i.id));
          const newPubItems = (body.published_menu as any[]).filter((i) => !pubIds.has(i.id));
          if (newPubItems.length > 0) {
            const mergedPub = [...existingPub];
            for (const item of newPubItems) {
              let insertIdx = mergedPub.length;
              const sameCat = mergedPub.map((m, i) => ({ m, i })).filter(({ m }) => m.category === item.category);
              if (sameCat.length > 0) {
                const after = sameCat.find(({ m }) => (m.sort_order ?? 0) >= (item.sort_order ?? 0));
                insertIdx = after ? after.i : sameCat[sameCat.length - 1].i + 1;
              }
              mergedPub.splice(insertIdx, 0, item);
            }
            await setPublishedMenu(mergedPub);
            imported.published_menu = newPubItems.length;
          }
        }
      } else {
        imported.menu = 0;
      }
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

    if (body.analytics && Array.isArray(body.analytics)) {
      const existing = await getAnalytics();
      const existingKeys = new Set(existing.map((v) => `${v.visitor_id}-${v.timestamp}`));
      const newVisits = body.analytics.filter((v: any) => !existingKeys.has(`${v.visitor_id}-${v.timestamp}`));
      await setAnalytics([...existing, ...newVisits]);
      imported.analytics = newVisits.length;
    }

    imported.config = false;
    imported.menu_presets = false;
    if (!imported.menu_ordering) imported.menu_ordering = false;
    if (!imported.published_menu) imported.published_menu = false;
    if (!imported.published_menu_ordering) imported.published_menu_ordering = false;
    imported.published_images = false;
    imported.persistent_codes = false;
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
    // Restore ordering as-is from backup — don't sanitize/strip during restore
    await setMenuOrdering(body.menu_ordering);
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
    await setPublishedMenuOrdering(body.published_menu_ordering);
    imported.published_menu_ordering = true;
  } else if (body.menu_ordering && typeof body.menu_ordering === "object" && !Array.isArray(body.menu_ordering)) {
    await setPublishedMenuOrdering(body.menu_ordering);
    imported.published_menu_ordering = true;
  }
  if (body.menu_presets && typeof body.menu_presets === "object" && !Array.isArray(body.menu_presets)) {
    await setMenuPresetStore(body.menu_presets);
    await ensureMenuPresets(true);
    imported.menu_presets = true;
  }

  imported.images = await restoreImages(body.images, false);
  imported.published_images = await restoreImages(body.published_images, true);

  if (body.persistent_codes && Array.isArray(body.persistent_codes)) {
    await setPersistentCodes(body.persistent_codes);
    imported.persistent_codes = body.persistent_codes.length;
  }
  if (body.analytics && Array.isArray(body.analytics)) {
    await setAnalytics(body.analytics);
    imported.analytics = body.analytics.length;
  }

  if (!body.menu_presets) {
    await ensureMenuPresets(true);
  }

  return imported;
}

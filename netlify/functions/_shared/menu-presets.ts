import type { MenuItem, MenuOrdering, MenuPreset, MenuPresetImage, MenuPresetStore } from "./types.js";
import {
  getMenu,
  getMenuImage,
  getMenuOrdering,
  getPublishedMenu,
  getPublishedMenuImage,
  getPublishedMenuOrdering,
  getMenuPresetStore,
  setMenu,
  setMenuImage,
  setMenuOrdering,
  setPublishedMenu,
  setPublishedMenuImage,
  setPublishedMenuOrdering,
  setMenuPresetStore,
} from "./store.js";
import { normalizeMenuSortOrders } from "./menu-sort.js";
import { EMPTY_MENU_ORDERING, sanitizeMenuOrdering } from "./menu-ordering.js";

export const MENU_PRESET_COUNT = 5;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

async function captureImages(
  items: MenuItem[],
  published: boolean
): Promise<Record<string, MenuPresetImage>> {
  const images: Record<string, MenuPresetImage> = {};
  const withImages = items.filter((item) => item.has_image);

  await Promise.all(
    withImages.map(async (item) => {
      try {
        const image = published ? await getPublishedMenuImage(item.id) : await getMenuImage(item.id);
        if (!image) return;
        images[item.id] = {
          data: Buffer.from(image.data).toString("base64"),
          content_type: image.contentType,
        };
      } catch {}
    })
  );

  return images;
}

async function restoreImages(
  images: Record<string, MenuPresetImage>,
  published: boolean
): Promise<void> {
  await Promise.all(
    Object.entries(images).map(async ([itemId, image]) => {
      try {
        const buffer = Buffer.from(image.data, "base64");
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        if (published) {
          await setPublishedMenuImage(itemId, arrayBuffer, image.content_type);
        } else {
          await setMenuImage(itemId, arrayBuffer, image.content_type);
        }
      } catch {}
    })
  );
}

function presetLabel(index: number, title: string): string {
  return title.trim() ? `Menu ${index}: ${title.trim()}` : `Menu ${index}`;
}

function normalizePreset(
  preset: Partial<MenuPreset> | undefined,
  index: number,
  fallback: MenuPreset
): MenuPreset {
  const hasMenu = Array.isArray(preset?.menu);
  const hasMenuOrdering = !!(preset?.menu_ordering && typeof preset.menu_ordering === "object");
  const hasPublishedMenu = Array.isArray(preset?.published_menu);
  const hasPublishedOrdering = !!(
    preset?.published_menu_ordering && typeof preset.published_menu_ordering === "object"
  );
  const hasImages = !!(preset?.images && typeof preset.images === "object");
  const hasPublishedImages = !!(preset?.published_images && typeof preset.published_images === "object");

  const normalizedMenu = normalizeMenuSortOrders(
    hasMenu ? clone(preset!.menu as MenuItem[]) : clone(fallback.menu)
  ).items;
  const normalizedPublishedMenu = normalizeMenuSortOrders(
    hasPublishedMenu
      ? clone(preset!.published_menu as MenuItem[])
      : hasMenu
        ? clone(preset!.menu as MenuItem[])
        : clone(fallback.published_menu)
  ).items;

  const menuOrdering = sanitizeMenuOrdering(
    hasMenuOrdering
      ? clone(preset!.menu_ordering as MenuOrdering)
      : hasMenu
        ? clone(EMPTY_MENU_ORDERING)
        : clone(fallback.menu_ordering),
    normalizedMenu
  );
  const publishedMenuOrdering = sanitizeMenuOrdering(
    hasPublishedOrdering
      ? clone(preset!.published_menu_ordering as MenuOrdering)
      : hasMenuOrdering
        ? clone(preset!.menu_ordering as MenuOrdering)
        : hasMenu
          ? clone(menuOrdering)
          : clone(fallback.published_menu_ordering),
    normalizedPublishedMenu
  );
  const images =
    hasImages
      ? clone(preset!.images as Record<string, MenuPresetImage>)
      : hasMenu
        ? {}
        : clone(fallback.images);
  const publishedImages =
    hasPublishedImages
      ? clone(preset!.published_images as Record<string, MenuPresetImage>)
      : hasImages
        ? clone(preset!.images as Record<string, MenuPresetImage>)
        : hasMenu
          ? clone(images)
          : clone(fallback.published_images);

  return {
    index,
    title: typeof preset?.title === "string" ? preset.title : fallback.title,
    menu: normalizedMenu,
    menu_ordering: menuOrdering,
    published_menu: normalizedPublishedMenu,
    published_menu_ordering: publishedMenuOrdering,
    images,
    published_images: publishedImages,
  };
}

async function snapshotCurrentState(index: number, title = ""): Promise<MenuPreset> {
  const [menu, menuOrdering, publishedMenu, publishedOrdering] = await Promise.all([
    getMenu(),
    getMenuOrdering(),
    getPublishedMenu(),
    getPublishedMenuOrdering(),
  ]);

  const normalizedMenu = normalizeMenuSortOrders(menu).items;
  const resolvedPublishedMenu = normalizeMenuSortOrders(publishedMenu ?? normalizedMenu).items;
  const resolvedMenuOrdering = sanitizeMenuOrdering(menuOrdering, normalizedMenu);
  const resolvedPublishedOrdering = sanitizeMenuOrdering(publishedOrdering ?? menuOrdering, resolvedPublishedMenu);
  const [images, publishedImages] = await Promise.all([
    captureImages(normalizedMenu, false),
    captureImages(resolvedPublishedMenu, true),
  ]);

  return {
    index,
    title,
    menu: clone(normalizedMenu),
    menu_ordering: clone(resolvedMenuOrdering),
    published_menu: clone(resolvedPublishedMenu),
    published_menu_ordering: clone(resolvedPublishedOrdering),
    images,
    published_images: publishedImages,
  };
}

export async function ensureMenuPresets(): Promise<MenuPresetStore> {
  const existing = await getMenuPresetStore();
  const fallbackPreset = await snapshotCurrentState(0);

  if (!existing || !Array.isArray(existing.presets) || existing.presets.length === 0) {
    const presets = Array.from({ length: MENU_PRESET_COUNT }, (_, index) => ({
      ...clone(fallbackPreset),
      index,
      title: "",
    }));
    const store: MenuPresetStore = { active_preset_index: 0, presets };
    await setMenuPresetStore(store);
    return store;
  }

  const presets = Array.from({ length: MENU_PRESET_COUNT }, (_, index) =>
    normalizePreset(existing.presets[index], index, { ...clone(fallbackPreset), index, title: "" })
  );

  const active_preset_index =
    typeof existing.active_preset_index === "number" &&
    existing.active_preset_index >= 0 &&
    existing.active_preset_index < MENU_PRESET_COUNT
      ? existing.active_preset_index
      : 0;

  const normalized: MenuPresetStore = { active_preset_index, presets };
  if (JSON.stringify(existing) !== JSON.stringify(normalized)) {
    await setMenuPresetStore(normalized);
  }
  return normalized;
}

export async function syncActiveMenuPreset(): Promise<MenuPresetStore> {
  const store = await ensureMenuPresets();
  const activeIndex = store.active_preset_index;
  const currentTitle = store.presets[activeIndex]?.title || "";
  store.presets[activeIndex] = await snapshotCurrentState(activeIndex, currentTitle);
  await setMenuPresetStore(store);
  return store;
}

export async function activateMenuPreset(
  index: number,
  options: { publish?: boolean } = {}
): Promise<MenuPresetStore> {
  const publish = options.publish ?? true;
  const store = await syncActiveMenuPreset();
  if (index < 0 || index >= MENU_PRESET_COUNT) {
    throw new Error("Invalid preset index");
  }

  const preset = store.presets[index];
  const normalizedDraftMenu = normalizeMenuSortOrders(clone(preset.menu)).items;
  const normalizedPublishedMenu = normalizeMenuSortOrders(clone(preset.published_menu || preset.menu)).items;
  const draftOrdering = sanitizeMenuOrdering(preset.menu_ordering || EMPTY_MENU_ORDERING, normalizedDraftMenu);
  const publishedOrdering = sanitizeMenuOrdering(
    preset.published_menu_ordering || preset.menu_ordering || EMPTY_MENU_ORDERING,
    normalizedPublishedMenu
  );
  const operations: Promise<unknown>[] = [
    setMenu(normalizedDraftMenu),
    setMenuOrdering(clone(draftOrdering)),
    restoreImages(preset.images || {}, false),
  ];

  if (publish) {
    operations.push(
      setPublishedMenu(normalizedPublishedMenu),
      setPublishedMenuOrdering(clone(publishedOrdering)),
      restoreImages(preset.published_images || preset.images || {}, true)
    );
  }

  await Promise.all(operations);

  store.active_preset_index = index;
  await setMenuPresetStore(store);
  return store;
}

export async function updateMenuPresetTitle(index: number, title: string): Promise<MenuPresetStore> {
  const store = await ensureMenuPresets();
  if (index < 0 || index >= MENU_PRESET_COUNT) {
    throw new Error("Invalid preset index");
  }
  store.presets[index].title = title.trim();
  await setMenuPresetStore(store);
  return store;
}

export function summarizeMenuPresets(store: MenuPresetStore) {
  return {
    active_preset_index: store.active_preset_index,
    presets: store.presets.map((preset) => ({
      index: preset.index,
      title: preset.title,
      label: presetLabel(preset.index, preset.title),
    })),
  };
}

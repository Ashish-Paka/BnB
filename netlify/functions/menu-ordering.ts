import type { Context } from "@netlify/functions";
import {
  getConfig,
  getMenu,
  getPublishedMenu,
  getMenuOrdering,
  getPublishedMenuOrdering,
  setMenuOrdering,
  setPublishedMenuOrdering,
} from "./_shared/store.js";
import { requireOwner } from "./_shared/auth.js";
import { syncActiveMenuPreset } from "./_shared/menu-presets.js";
import { EMPTY_MENU_ORDERING, sanitizeMenuOrdering } from "./_shared/menu-ordering.js";

export default async (req: Request, context: Context) => {
  if (req.method === "GET") {
    const url = new URL(req.url);
    const snapshot = url.searchParams.get("snapshot");
    const headers = Object.fromEntries(req.headers.entries());
    const isOwner = requireOwner(headers);
    if (isOwner) {
      if (snapshot === "published") {
        const [publishedOrdering, draftOrdering, publishedMenu, draftMenu, config] = await Promise.all([
          getPublishedMenuOrdering(),
          getMenuOrdering(),
          getPublishedMenu(),
          getMenu(),
          getConfig(),
        ]);

        const sourceMenu = publishedMenu ?? (!config.menu_editing_active ? draftMenu : []);
        const sourceOrdering = publishedOrdering ?? (!config.menu_editing_active ? draftOrdering : EMPTY_MENU_ORDERING);
        const ordering = sanitizeMenuOrdering(sourceOrdering, sourceMenu);

        if (JSON.stringify(publishedOrdering) !== JSON.stringify(ordering)) {
          await setPublishedMenuOrdering(ordering);
        }

        return Response.json(ordering);
      }

      const [stored, menu] = await Promise.all([getMenuOrdering(), getMenu()]);
      const ordering = sanitizeMenuOrdering(stored, menu);
      if (JSON.stringify(stored) !== JSON.stringify(ordering)) {
        await setMenuOrdering(ordering);
      }
      return Response.json(ordering);
    }

    const [publishedOrdering, draftOrdering, publishedMenu, draftMenu, config] = await Promise.all([
      getPublishedMenuOrdering(),
      getMenuOrdering(),
      getPublishedMenu(),
      getMenu(),
      getConfig(),
    ]);

    if (publishedMenu || publishedOrdering || !config.menu_editing_active) {
      const sourceMenu = publishedMenu ?? (!config.menu_editing_active ? draftMenu : []);
      const sourceOrdering = publishedOrdering ?? (!config.menu_editing_active ? draftOrdering : EMPTY_MENU_ORDERING);
      const ordering = sanitizeMenuOrdering(sourceOrdering, sourceMenu);
      await setPublishedMenuOrdering(ordering);
      return Response.json(ordering);
    }

    return Response.json(EMPTY_MENU_ORDERING);
  }

  if (req.method === "PUT") {
    const headers = Object.fromEntries(req.headers.entries());
    if (!requireOwner(headers)) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const menu = await getMenu();
    const ordering = sanitizeMenuOrdering(body, menu);
    await setMenuOrdering(ordering);
    await syncActiveMenuPreset();
    return Response.json(ordering);
  }

  return new Response("Method not allowed", { status: 405 });
};

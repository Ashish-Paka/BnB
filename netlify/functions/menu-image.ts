import type { Context } from "@netlify/functions";
import {
  getMenu,
  setMenu,
  getMenuImage,
  getPublishedMenuImage,
  setMenuImage,
  setPublishedMenuImage,
  deleteMenuImage,
} from "./_shared/store.js";
import { requireOwner } from "./_shared/auth.js";
import { syncActiveMenuPreset } from "./_shared/menu-presets.js";
import { getConfig } from "./_shared/store.js";

export default async (req: Request, _context: Context) => {
  const url = new URL(req.url);
  const itemId = url.searchParams.get("id");
  if (!itemId) return new Response("Missing id", { status: 400 });
  const headers = Object.fromEntries(req.headers.entries());
  const isOwner = requireOwner(headers);

  // GET — public, serve image
  if (req.method === "GET") {
    const config = isOwner ? null : await getConfig();
    const publishedImage = isOwner ? null : await getPublishedMenuImage(itemId);
    const img = isOwner
      ? await getMenuImage(itemId)
      : publishedImage ?? (!(config?.menu_editing_active) ? await getMenuImage(itemId) : null);
    if (!img) return new Response("Not found", { status: 404 });
    return new Response(img.data, {
      headers: {
        "Content-Type": img.contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  // Auth required for POST/DELETE
  if (!isOwner) {
    return new Response("Unauthorized", { status: 401 });
  }

  // POST — upload image
  if (req.method === "POST") {
    const contentType = req.headers.get("content-type") || "image/webp";
    const buffer = await req.arrayBuffer();
    if (buffer.byteLength === 0) return new Response("Empty body", { status: 400 });
    if (buffer.byteLength > 500_000) return new Response("Image too large (max 500KB)", { status: 413 });

    const isPublished = url.searchParams.get("published") === "true";
    if (isPublished) {
      await setPublishedMenuImage(itemId, buffer, contentType);
      return Response.json({ success: true });
    }

    await setMenuImage(itemId, buffer, contentType);

    // Set has_image on the menu item
    const menu = await getMenu();
    const idx = menu.findIndex((m) => m.id === itemId);
    if (idx !== -1) {
      menu[idx].has_image = true;
      await setMenu(menu);
    }

    await syncActiveMenuPreset();

    return Response.json({ success: true });
  }

  // DELETE — remove image
  if (req.method === "DELETE") {
    await deleteMenuImage(itemId);

    const menu = await getMenu();
    const idx = menu.findIndex((m) => m.id === itemId);
    if (idx !== -1) {
      menu[idx].has_image = false;
      await setMenu(menu);
    }

    await syncActiveMenuPreset();

    return Response.json({ success: true });
  }

  return new Response("Method not allowed", { status: 405 });
};

import type { Context } from "@netlify/functions";
import { getMenu, setMenu, deleteMenuImage } from "./_shared/store.js";
import { requireOwner } from "./_shared/auth.js";
import type { MenuItem } from "./_shared/types.js";

export default async (req: Request, context: Context) => {
  const headers = Object.fromEntries(req.headers.entries());
  if (!requireOwner(headers)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const menu = await getMenu();
  const body = await req.json();

  if (req.method === "POST") {
    // Create
    const id = body.id || crypto.randomUUID();
    const item: MenuItem = {
      id,
      name: body.name,
      description: body.description || "",
      base_price_cents: body.base_price_cents,
      category: body.category || "coffee",
      subcategory: body.subcategory || undefined,
      is_available: body.is_available ?? true,
      sort_order: body.sort_order ?? menu.length + 1,
      options: body.options,
    };
    menu.push(item);
    await setMenu(menu);
    return Response.json(item, { status: 201 });
  }

  if (req.method === "PUT") {
    const idx = menu.findIndex((m) => m.id === body.id);
    if (idx === -1) return new Response("Not found", { status: 404 });
    menu[idx] = { ...menu[idx], ...body };
    await setMenu(menu);
    return Response.json(menu[idx]);
  }

  if (req.method === "DELETE") {
    const idx = menu.findIndex((m) => m.id === body.id);
    if (idx === -1) return new Response("Not found", { status: 404 });

    // Permanent delete if ?permanent=true or item already soft-deleted
    const url = new URL(req.url);
    const permanent = url.searchParams.get("permanent") === "true";

    if (permanent || menu[idx].deleted_at) {
      const [removed] = menu.splice(idx, 1);
      await setMenu(menu);
      if (removed.has_image) await deleteMenuImage(removed.id);
      return Response.json(removed);
    }

    // Soft delete
    menu[idx].deleted_at = new Date().toISOString();
    await setMenu(menu);
    return Response.json(menu[idx]);
  }

  return new Response("Method not allowed", { status: 405 });
};

import type { Context } from "@netlify/functions";
import { getMenu, setMenu, deleteMenuImage } from "./_shared/store.js";
import { requireOwner } from "./_shared/auth.js";
import type { MenuItem } from "./_shared/types.js";
import { syncActiveMenuPreset } from "./_shared/menu-presets.js";
import { getNextSortOrderForCategory, normalizeMenuSortOrders } from "./_shared/menu-sort.js";

export default async (req: Request, context: Context) => {
  const headers = Object.fromEntries(req.headers.entries());
  if (!requireOwner(headers)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const menu = await getMenu();
  const body = await req.json();
  const hasSubcategory = Object.prototype.hasOwnProperty.call(body, "subcategory");
  const normalizedSubcategory =
    typeof body.subcategory === "string" ? body.subcategory.trim() : body.subcategory;

  if (req.method === "POST") {
    // Create
    const id = body.id || crypto.randomUUID();
    const category = body.category || "coffee";
    const item: MenuItem = {
      id,
      name: body.name,
      description: body.description || "",
      base_price_cents: body.base_price_cents,
      category,
      subcategory: normalizedSubcategory || undefined,
      is_available: body.is_available ?? true,
      sort_order:
        typeof body.sort_order === "number"
          ? body.sort_order
          : getNextSortOrderForCategory(menu, category),
      options: body.options,
    };
    menu.push(item);
    const { items: normalizedMenu } = normalizeMenuSortOrders(menu);
    await setMenu(normalizedMenu);
    await syncActiveMenuPreset();
    return Response.json(
      normalizedMenu.find((entry) => entry.id === id) ?? item,
      { status: 201 }
    );
  }

  if (req.method === "PUT") {
    const idx = menu.findIndex((m) => m.id === body.id);
    if (idx === -1) return new Response("Not found", { status: 404 });
    const previous = menu[idx];
    const next = { ...previous, ...body };
    if (hasSubcategory) {
      next.subcategory = normalizedSubcategory || undefined;
    }
    if (
      typeof body.sort_order !== "number" &&
      typeof next.category === "string" &&
      next.category !== previous.category
    ) {
      next.sort_order = getNextSortOrderForCategory(
        menu.filter((_, index) => index !== idx),
        next.category
      );
    }
    menu[idx] = next;
    const { items: normalizedMenu } = normalizeMenuSortOrders(menu);
    await setMenu(normalizedMenu);
    await syncActiveMenuPreset();
    return Response.json(normalizedMenu.find((entry) => entry.id === body.id) ?? next);
  }

  if (req.method === "DELETE") {
    const idx = menu.findIndex((m) => m.id === body.id);
    if (idx === -1) return new Response("Not found", { status: 404 });

    // Permanent delete if ?permanent=true or item already soft-deleted
    const url = new URL(req.url);
    const permanent = url.searchParams.get("permanent") === "true";

    if (permanent || menu[idx].deleted_at) {
      const [removed] = menu.splice(idx, 1);
      const { items: normalizedMenu } = normalizeMenuSortOrders(menu);
      await setMenu(normalizedMenu);
      if (removed.has_image) await deleteMenuImage(removed.id);
      await syncActiveMenuPreset();
      return Response.json(removed);
    }

    // Soft delete
    menu[idx].deleted_at = new Date().toISOString();
    const { items: normalizedMenu } = normalizeMenuSortOrders(menu);
    await setMenu(normalizedMenu);
    await syncActiveMenuPreset();
    return Response.json(normalizedMenu.find((entry) => entry.id === body.id) ?? menu[idx]);
  }

  return new Response("Method not allowed", { status: 405 });
};

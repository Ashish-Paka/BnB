import type { Context } from "@netlify/functions";
import { getMenu, setMenu } from "./_shared/store.js";
import { requireOwner } from "./_shared/auth.js";

export default async (req: Request, context: Context) => {
  const headers = Object.fromEntries(req.headers.entries());
  if (!requireOwner(headers)) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (req.method !== "PUT") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.json();
  const updates: { id: string; sort_order: number }[] = body.items;

  if (!Array.isArray(updates)) {
    return new Response("Invalid body: expected { items: [{ id, sort_order }] }", { status: 400 });
  }

  const menu = await getMenu();
  const updateMap = new Map(updates.map((u) => [u.id, u.sort_order]));

  for (const item of menu) {
    if (updateMap.has(item.id)) {
      item.sort_order = updateMap.get(item.id)!;
    }
  }

  await setMenu(menu);
  menu.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return Response.json(menu);
};

import type { Context } from "@netlify/functions";
import { getOrders, setOrders } from "./_shared/store.js";
import { requireOwner } from "./_shared/auth.js";

export default async (req: Request, context: Context) => {
  if (req.method !== "DELETE") {
    return new Response("Method not allowed", { status: 405 });
  }

  const headers = Object.fromEntries(req.headers.entries());
  if (!requireOwner(headers)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response("Missing id parameter", { status: 400 });
  }

  const orders = await getOrders();
  const idx = orders.findIndex((o) => o.id === id);
  if (idx === -1) {
    return new Response("Not found", { status: 404 });
  }

  // Permanently remove from storage — does NOT affect visits/rewards
  orders.splice(idx, 1);
  await setOrders(orders);

  return Response.json({ success: true, id });
};

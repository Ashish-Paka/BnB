import type { Context } from "@netlify/functions";
import { getOrders } from "./_shared/store.js";
import { requireOwner } from "./_shared/auth.js";

export default async (req: Request, context: Context) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const headers = Object.fromEntries(req.headers.entries());
  if (!requireOwner(headers)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status");

  let orders = await getOrders();
  if (status) {
    orders = orders.filter((o) => o.status === status);
  }

  return Response.json(orders);
};

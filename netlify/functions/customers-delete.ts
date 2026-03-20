import type { Context } from "@netlify/functions";
import {
  getCustomers,
  setCustomers,
  getOrders,
  setOrders,
  getVisits,
  setVisits,
} from "./_shared/store.js";
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
    return Response.json({ error: "Missing customer id" }, { status: 400 });
  }

  const customers = await getCustomers();
  const idx = customers.findIndex((c) => c.id === id);
  if (idx === -1) {
    return Response.json({ error: "Customer not found" }, { status: 404 });
  }

  // Remove customer
  customers.splice(idx, 1);
  await setCustomers(customers);

  // Unlink orders (set customer_id to null, keep the orders)
  const orders = await getOrders();
  let ordersChanged = false;
  for (const order of orders) {
    if (order.customer_id === id) {
      order.customer_id = null;
      ordersChanged = true;
    }
  }
  if (ordersChanged) await setOrders(orders);

  // Remove visits
  const visits = await getVisits();
  const filtered = visits.filter((v) => v.customer_id !== id);
  if (filtered.length !== visits.length) await setVisits(filtered);

  return Response.json({ success: true });
};

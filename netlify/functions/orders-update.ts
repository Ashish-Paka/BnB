import type { Context } from "@netlify/functions";
import { getOrders, setOrders, getCustomers, setCustomers } from "./_shared/store.js";
import { requireOwner } from "./_shared/auth.js";

const REWARD_THRESHOLD = 10;

export default async (req: Request, context: Context) => {
  if (req.method !== "PUT") {
    return new Response("Method not allowed", { status: 405 });
  }

  const headers = Object.fromEntries(req.headers.entries());
  if (!requireOwner(headers)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const orders = await getOrders();
  const idx = orders.findIndex((o) => o.id === body.id);
  if (idx === -1) return new Response("Not found", { status: 404 });

  const oldStatus = orders[idx].status;
  const newStatus = body.status;

  orders[idx] = {
    ...orders[idx],
    ...body,
    updated_at: new Date().toISOString(),
  };
  await setOrders(orders);

  // Auto-increment rewards when a customer-created order is completed
  if (
    newStatus === "completed" &&
    oldStatus !== "completed" &&
    orders[idx].created_by === "customer" &&
    orders[idx].customer_id
  ) {
    const customers = await getCustomers();
    const customer = customers.find((c) => c.id === orders[idx].customer_id);
    if (customer) {
      customer.visit_count += 1;
      customer.total_visits += 1;
      if (customer.visit_count >= REWARD_THRESHOLD) {
        customer.visit_count = 0;
        customer.rewards_earned += 1;
      }
      customer.updated_at = new Date().toISOString();
      await setCustomers(customers);
    }
  }

  return Response.json(orders[idx]);
};

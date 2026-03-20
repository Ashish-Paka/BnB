import type { Context } from "@netlify/functions";
import { getCustomers, getOrders, getVisits } from "./_shared/store.js";
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
  const id = url.searchParams.get("id");
  if (!id) return new Response("id required", { status: 400 });

  const customers = await getCustomers();
  const customer = customers.find((c) => c.id === id);
  if (!customer) return new Response("Not found", { status: 404 });

  const orders = (await getOrders()).filter((o) => o.customer_id === id);
  const visits = (await getVisits()).filter((v) => v.customer_id === id);

  return Response.json({ customer, orders, visits });
};

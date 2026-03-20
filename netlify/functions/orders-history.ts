import type { Context } from "@netlify/functions";
import { getOrders } from "./_shared/store.js";

export default async (req: Request, context: Context) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const customerId = url.searchParams.get("customer_id");

  if (!customerId) {
    return new Response(
      JSON.stringify({ error: "Missing customer_id" }),
      { status: 400 }
    );
  }

  const orders = await getOrders();
  const customerOrders = orders
    .filter((o) => o.customer_id === customerId)
    .slice(0, 5)
    .map((o) => ({
      id: o.id,
      items: o.items.map((i) => ({
        item_name: i.item_name,
        quantity: i.quantity,
        options: i.options,
      })),
      total_cents: o.total_cents,
      status: o.status,
      is_free_reward: o.is_free_reward,
      created_at: o.created_at,
    }));

  return Response.json(customerOrders);
};

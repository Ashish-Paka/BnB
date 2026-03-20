import type { Context } from "@netlify/functions";
import { getOrders } from "./_shared/store.js";

export default async (req: Request, context: Context) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return new Response(
      JSON.stringify({ error: "Missing order id" }),
      { status: 400 }
    );
  }

  const orders = await getOrders();
  const order = orders.find((o) => o.id === id);

  if (!order) {
    return new Response(
      JSON.stringify({ error: "Order not found" }),
      { status: 404 }
    );
  }

  return Response.json({
    status: order.status,
    customer_name: order.customer_name,
    customer_id: order.customer_id,
  });
};

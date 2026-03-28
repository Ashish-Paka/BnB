import type { Context } from "@netlify/functions";
import { getOrders, setOrders, getCustomers, setCustomers, getConfig, setConfig } from "./_shared/store.js";
import type { Order, Customer } from "./_shared/types.js";

const REWARD_THRESHOLD = 10;

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.json();
  const now = new Date().toISOString();

  // If created_by owner and no customer_id, try to find or create customer
  let customerId = body.customer_id || null;
  const customers = await getCustomers();

  if (body.created_by === "owner" && !customerId && body.customer_name) {
    let found = customers.find(
      (c) =>
        (body.customer_phone && c.phone === body.customer_phone) ||
        (body.customer_email && c.email === body.customer_email)
    );
    if (!found && body.customer_name.startsWith("Walk-in")) {
      const config = await getConfig();
      config.unknown_customer_seq += 1;
      await setConfig(config);
      found = {
        id: crypto.randomUUID(),
        names: [`Walk-in #${config.unknown_customer_seq}`],
        email: null,
        phone: null,
        visit_count: 0,
        total_visits: 0,
        rewards_earned: 0,
        rewards_redeemed: 0,
        created_at: now,
        updated_at: now,
      };
      customers.push(found);
    }
    if (found) customerId = found.id;
  }

  // POS orders auto-increment visit count for known customers
  if (body.created_by === "owner" && customerId) {
    const customer = customers.find((c) => c.id === customerId);
    if (customer) {
      customer.total_visits += 1;
      if (customer.visit_count >= REWARD_THRESHOLD) {
        customer.visit_count = 1; // was at 10, start new cycle
      } else {
        customer.visit_count += 1;
      }
      if (customer.visit_count >= REWARD_THRESHOLD) {
        customer.rewards_earned += 1;
      }
      // Handle free drink redemption
      if (body.is_free_reward) {
        customer.rewards_redeemed += 1;
      }
      customer.updated_at = now;
    }
  }

  await setCustomers(customers);

  const order: Order = {
    id: crypto.randomUUID(),
    customer_id: customerId,
    customer_name: body.customer_name || "Guest",
    items: body.items || [],
    total_cents: body.total_cents || 0,
    status: "pending",
    is_free_reward: body.is_free_reward || false,
    notes: body.notes || "",
    created_by: body.created_by || "customer",
    created_at: now,
    updated_at: now,
  };

  const orders = await getOrders();
  orders.unshift(order);
  await setOrders(orders);

  return Response.json(order, { status: 201 });
};

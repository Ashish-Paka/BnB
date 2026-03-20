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
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const headers = Object.fromEntries(req.headers.entries());
  if (!requireOwner(headers)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { primaryId, secondaryId } = body;
  if (!primaryId || !secondaryId) {
    return Response.json(
      { error: "primaryId and secondaryId required" },
      { status: 400 }
    );
  }
  if (primaryId === secondaryId) {
    return Response.json(
      { error: "Cannot merge a customer with itself" },
      { status: 400 }
    );
  }

  const customers = await getCustomers();
  const primary = customers.find((c) => c.id === primaryId);
  const secondary = customers.find((c) => c.id === secondaryId);
  if (!primary || !secondary) {
    return Response.json(
      { error: `Customer not found: ${!primary ? primaryId : secondaryId}` },
      { status: 404 }
    );
  }

  // Merge names (unique)
  const allNames = [...new Set([...primary.names, ...secondary.names])];
  primary.names = allNames;

  // Merge contact (prefer non-null)
  primary.email = primary.email || secondary.email;
  primary.phone = primary.phone || secondary.phone;

  // Merge counts
  primary.visit_count += secondary.visit_count;
  primary.total_visits += secondary.total_visits;
  primary.rewards_earned += secondary.rewards_earned;
  primary.rewards_redeemed += secondary.rewards_redeemed;
  primary.updated_at = new Date().toISOString();

  // Reassign orders
  const orders = await getOrders();
  for (const order of orders) {
    if (order.customer_id === secondaryId) {
      order.customer_id = primaryId;
    }
  }
  await setOrders(orders);

  // Reassign visits
  const visits = await getVisits();
  for (const visit of visits) {
    if (visit.customer_id === secondaryId) {
      visit.customer_id = primaryId;
    }
  }
  await setVisits(visits);

  // Remove secondary, update primary
  const filtered = customers.filter((c) => c.id !== secondaryId);
  const idx = filtered.findIndex((c) => c.id === primaryId);
  filtered[idx] = primary;
  await setCustomers(filtered);

  return Response.json(primary);
};

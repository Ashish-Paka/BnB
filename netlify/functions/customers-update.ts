import type { Context } from "@netlify/functions";
import { getCustomers, setCustomers } from "./_shared/store.js";
import { requireOwner } from "./_shared/auth.js";

export default async (req: Request, context: Context) => {
  if (req.method !== "PUT") {
    return new Response("Method not allowed", { status: 405 });
  }

  const headers = Object.fromEntries(req.headers.entries());
  if (!requireOwner(headers)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const customers = await getCustomers();
  const idx = customers.findIndex((c) => c.id === body.id);
  if (idx === -1) return new Response("Not found", { status: 404 });

  const REWARD_THRESHOLD = 10;
  const prev = customers[idx];
  const updated = {
    ...prev,
    ...body,
    updated_at: new Date().toISOString(),
  };

  // Auto-award reward when visit_count is set to threshold and wasn't there before
  if (
    updated.visit_count >= REWARD_THRESHOLD &&
    prev.visit_count < REWARD_THRESHOLD &&
    (body.rewards_earned === undefined || body.rewards_earned === prev.rewards_earned)
  ) {
    updated.rewards_earned = (updated.rewards_earned ?? 0) + 1;
  }

  customers[idx] = updated;
  await setCustomers(customers);

  return Response.json(customers[idx]);
};

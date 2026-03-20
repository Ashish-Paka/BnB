import type { Context } from "@netlify/functions";
import { getCustomers, setCustomers } from "./_shared/store.js";
import { requireOwner } from "./_shared/auth.js";
import type { Customer } from "./_shared/types.js";

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const headers = Object.fromEntries(req.headers.entries());
  const isOwner = requireOwner(headers);

  const body = await req.json();
  const { phone, email, name } = body;

  // Validation: owner can create with name only; public requires name + (phone or email)
  if (isOwner) {
    if (!name) {
      return new Response(
        JSON.stringify({ error: "Name required" }),
        { status: 400 }
      );
    }
  } else {
    if (!phone && !email) {
      return new Response(
        JSON.stringify({ error: "Phone or email required" }),
        { status: 400 }
      );
    }
  }

  const customers = await getCustomers();

  let customer: Customer | undefined;

  if (isOwner && !phone && !email) {
    // Owner name-only lookup: find by exact name match
    customer = customers.find((c) =>
      c.names.some((n) => n.toLowerCase() === name.toLowerCase())
    );
  } else {
    // Lookup by phone or email
    customer = customers.find(
      (c) =>
        (phone && c.phone === phone) || (email && c.email === email)
    );
  }

  // Auto-create if not found and name provided
  if (!customer && name) {
    const now = new Date().toISOString();
    customer = {
      id: crypto.randomUUID(),
      names: [name],
      email: email || null,
      phone: phone || null,
      visit_count: 0,
      total_visits: 0,
      rewards_earned: 0,
      rewards_redeemed: 0,
      created_at: now,
      updated_at: now,
    };
    customers.push(customer);
    await setCustomers(customers);
  }

  // Backfill missing contact info and name aliases on existing customer
  if (customer) {
    let changed = false;
    if (name && !customer.names.includes(name)) {
      customer.names.push(name);
      changed = true;
    }
    if (phone && !customer.phone) {
      customer.phone = phone;
      changed = true;
    }
    if (email && !customer.email) {
      customer.email = email;
      changed = true;
    }
    if (changed) {
      customer.updated_at = new Date().toISOString();
      await setCustomers(customers);
    }
  }

  return Response.json({ customer: customer || null });
};

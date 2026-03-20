import type { Context } from "@netlify/functions";
import { verifyCode } from "./_shared/totp.js";
import {
  getCustomers,
  setCustomers,
  getVisits,
  setVisits,
} from "./_shared/store.js";

const REWARD_THRESHOLD = 10;

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.json();
  const { code, customer_id, redeem } = body;

  if (!code || !customer_id) {
    return new Response(
      JSON.stringify({ valid: false, message: "Code and customer_id required" }),
      { status: 400 }
    );
  }

  // Verify the TOTP code
  const isValid = await verifyCode(code);
  if (!isValid) {
    return Response.json({
      valid: false,
      visit_count: 0,
      reward_earned: false,
      redeemed: false,
      message: "Invalid or expired code",
    });
  }

  // Update customer
  const customers = await getCustomers();
  const customer = customers.find((c) => c.id === customer_id);
  if (!customer) {
    return new Response(
      JSON.stringify({ valid: false, message: "Customer not found" }),
      { status: 404 }
    );
  }

  // --- Redeem mode: use reward for a free drink ---
  if (redeem) {
    const available = customer.rewards_earned - customer.rewards_redeemed;
    if (available <= 0) {
      return Response.json({
        valid: false,
        visit_count: customer.visit_count,
        reward_earned: false,
        redeemed: false,
        message: "No rewards available to redeem.",
      });
    }
    customer.rewards_redeemed += 1;
    customer.updated_at = new Date().toISOString();
    await setCustomers(customers);

    const remaining = customer.rewards_earned - customer.rewards_redeemed;
    return Response.json({
      valid: true,
      visit_count: customer.visit_count,
      reward_earned: false,
      redeemed: true,
      rewards_remaining: remaining,
      message:
        remaining > 0
          ? `Free drink redeemed! You have ${remaining} more reward${remaining > 1 ? "s" : ""}.`
          : "Free drink redeemed! Enjoy!",
    });
  }

  // --- Visit mode: record a visit ---
  const today = new Date().toISOString().split("T")[0];
  const visits = await getVisits();
  const alreadyVerified = visits.some(
    (v) => v.customer_id === customer_id && v.date === today
  );
  if (alreadyVerified) {
    return Response.json({
      valid: true,
      visit_count: customer.visit_count,
      reward_earned: false,
      redeemed: false,
      message: "Already verified today! Come back tomorrow.",
    });
  }

  // Record the visit
  visits.push({
    id: crypto.randomUUID(),
    customer_id,
    verified_at: new Date().toISOString(),
    totp_code_used: code,
    date: today,
  });
  await setVisits(visits);

  customer.visit_count += 1;
  customer.total_visits += 1;
  customer.updated_at = new Date().toISOString();

  let rewardEarned = false;
  if (customer.visit_count >= REWARD_THRESHOLD) {
    customer.rewards_earned += 1;
    customer.visit_count = 0; // Reset for next cycle
    rewardEarned = true;
  }

  await setCustomers(customers);

  return Response.json({
    valid: true,
    visit_count: customer.visit_count,
    reward_earned: rewardEarned,
    redeemed: false,
    message: rewardEarned
      ? "Congratulations! You earned a free drink!"
      : `Visit recorded! ${REWARD_THRESHOLD - customer.visit_count} more to go.`,
  });
};

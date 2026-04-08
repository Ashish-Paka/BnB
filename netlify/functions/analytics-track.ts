import type { Context } from "@netlify/functions";
import { getAnalytics, setAnalytics } from "./_shared/store.js";
import type { AnalyticsVisit } from "./_shared/types.js";

const MAX_RECORDS = 10000;

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.json();
  const { visitor_id, page_path, device_type, referrer, is_new_visitor, screen_width } = body;

  if (!visitor_id || typeof visitor_id !== "string") {
    return new Response(JSON.stringify({ success: false }), { status: 400 });
  }

  const visits = await getAnalytics();

  // Dedup: ignore same visitor + page within 5 seconds
  const now = new Date();
  const fiveSecondsAgo = new Date(now.getTime() - 5000).toISOString();
  const isDup = visits.some(
    (v) =>
      v.visitor_id === visitor_id &&
      v.page_path === page_path &&
      v.timestamp > fiveSecondsAgo
  );
  if (isDup) {
    return Response.json({ success: true });
  }

  const visit: AnalyticsVisit = {
    visitor_id,
    timestamp: now.toISOString(),
    page_path: page_path || "/",
    device_type: device_type || "desktop",
    referrer: referrer || "",
    is_new_visitor: !!is_new_visitor,
    screen_width: screen_width || 0,
  };

  visits.push(visit);

  // Cap at MAX_RECORDS
  const trimmed = visits.length > MAX_RECORDS ? visits.slice(-MAX_RECORDS) : visits;
  await setAnalytics(trimmed);

  return Response.json({ success: true });
};

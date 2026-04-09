import type { Context } from "@netlify/functions";
import { getAnalytics } from "./_shared/store.js";
import { requireOwner } from "./_shared/auth.js";

const REFERRER_GROUPS: Record<string, string[]> = {
  Google: ["google.com", "google.co", "googleapis.com"],
  Instagram: ["instagram.com", "l.instagram.com"],
  Facebook: ["facebook.com", "fb.com", "l.facebook.com", "m.facebook.com"],
  Twitter: ["twitter.com", "t.co", "x.com"],
  TikTok: ["tiktok.com"],
  YouTube: ["youtube.com", "youtu.be"],
};

function groupReferrer(referrer: string): string {
  if (!referrer) return "Direct";
  try {
    const hostname = new URL(referrer).hostname.replace(/^www\./, "");
    for (const [group, domains] of Object.entries(REFERRER_GROUPS)) {
      if (domains.some((d) => hostname.includes(d))) return group;
    }
    return "Other";
  } catch {
    return "Other";
  }
}

function getRawDomain(referrer: string): string {
  if (!referrer) return "Direct";
  try {
    return new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return referrer;
  }
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const headers = Object.fromEntries(req.headers.entries());
  if (!requireOwner(headers)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const from = url.searchParams.get("from") || "2000-01-01";
  const to = url.searchParams.get("to") || "2099-12-31";

  const allVisits = await getAnalytics();

  // Filter by date range
  const visits = allVisits.filter((v) => {
    const date = v.timestamp.split("T")[0];
    return date >= from && date <= to;
  });

  const uniqueVisitors = new Set(visits.map((v) => v.visitor_id)).size;

  const device = { mobile: 0, tablet: 0, desktop: 0 };
  const referrerGrouped: Record<string, number> = {};
  const referrerRaw: Record<string, number> = {};
  const dailyMap: Record<string, { views: number; visitors: Set<string>; returning: number; mobile: number; desktop: number }> = {};
  let newCount = 0;
  let returningCount = 0;

  for (const v of visits) {
    // Device
    if (v.device_type in device) device[v.device_type as keyof typeof device] += 1;

    // Referrers
    const group = groupReferrer(v.referrer);
    referrerGrouped[group] = (referrerGrouped[group] || 0) + 1;

    const raw = getRawDomain(v.referrer);
    referrerRaw[raw] = (referrerRaw[raw] || 0) + 1;

    // Daily
    const date = v.timestamp.split("T")[0];
    if (!dailyMap[date]) dailyMap[date] = { views: 0, visitors: new Set(), returning: 0, mobile: 0, desktop: 0 };
    dailyMap[date].views += 1;
    dailyMap[date].visitors.add(v.visitor_id);
    if (!v.is_new_visitor) dailyMap[date].returning += 1;
    if (v.device_type === "mobile") dailyMap[date].mobile += 1;
    if (v.device_type === "desktop") dailyMap[date].desktop += 1;

    // New vs returning
    if (v.is_new_visitor) newCount++;
    else returningCount++;
  }

  const daily_views = Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, data]) => ({
      date,
      views: data.views,
      unique: data.visitors.size,
      returning: data.returning,
      mobile: data.mobile,
      desktop: data.desktop,
    }));

  return Response.json({
    total_views: visits.length,
    unique_visitors: uniqueVisitors,
    device_breakdown: device,
    referrer_breakdown: referrerGrouped,
    referrer_raw: referrerRaw,
    daily_views,
    new_vs_returning: { new: newCount, returning: returningCount },
  });
};

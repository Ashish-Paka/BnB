import type { Context } from "@netlify/functions";
import { getAnalytics, getOrders, getVisits } from "./_shared/store.js";
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
  const granularity = url.searchParams.get("granularity") || "day"; // hour | day | week | month

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
  function getBucketKey(timestamp: string): string {
    const d = new Date(timestamp);
    if (granularity === "hour") return timestamp.slice(0, 13); // "2026-04-08T14"
    if (granularity === "week") {
      // ISO week: find Monday of the week
      const day = d.getDay();
      const monday = new Date(d);
      monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      return monday.toISOString().split("T")[0];
    }
    if (granularity === "month") return timestamp.slice(0, 7); // "2026-04"
    return timestamp.split("T")[0]; // day
  }

  function formatBucketLabel(key: string): string {
    if (granularity === "hour") {
      const h = parseInt(key.slice(11, 13), 10);
      return h === 0 ? "12am" : h < 12 ? h + "am" : h === 12 ? "12pm" : (h - 12) + "pm";
    }
    if (granularity === "week") return "W " + key.slice(5); // "W 04-07"
    if (granularity === "month") {
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const m = parseInt(key.slice(5, 7), 10);
      return months[m - 1] + " " + key.slice(0, 4);
    }
    return key.slice(5); // "04-08"
  }

  type Bucket = { views: number; visitors: Set<string>; returning: number; mobile: number; desktop: number; referrers: number; orders: number; verifications: number; label: string };
  const bucketMap: Record<string, Bucket> = {};
  const makeBucket = (key: string): Bucket => ({ views: 0, visitors: new Set(), returning: 0, mobile: 0, desktop: 0, referrers: 0, orders: 0, verifications: 0, label: formatBucketLabel(key) });

  let newCount = 0;
  let returningCount = 0;

  for (const v of visits) {
    if (v.device_type in device) device[v.device_type as keyof typeof device] += 1;

    const group = groupReferrer(v.referrer);
    referrerGrouped[group] = (referrerGrouped[group] || 0) + 1;
    const raw = getRawDomain(v.referrer);
    referrerRaw[raw] = (referrerRaw[raw] || 0) + 1;

    const key = getBucketKey(v.timestamp);
    if (!bucketMap[key]) bucketMap[key] = makeBucket(key);
    bucketMap[key].views += 1;
    bucketMap[key].visitors.add(v.visitor_id);
    if (!v.is_new_visitor) bucketMap[key].returning += 1;
    if (v.device_type === "mobile") bucketMap[key].mobile += 1;
    if (v.device_type === "desktop") bucketMap[key].desktop += 1;
    if (v.referrer) bucketMap[key].referrers += 1;

    if (v.is_new_visitor) newCount++;
    else returningCount++;
  }

  // Add orders into buckets
  const allOrders = await getOrders();
  let totalOrders = 0;
  for (const o of allOrders) {
    if (o.deleted_at) continue;
    const date = o.created_at?.split("T")[0];
    if (!date || date < from || date > to) continue;
    totalOrders++;
    const key = getBucketKey(o.created_at);
    if (!bucketMap[key]) bucketMap[key] = makeBucket(key);
    bucketMap[key].orders += 1;
  }

  // Add verifications (visit records) into buckets
  const allVerifications = await getVisits();
  let totalVerifications = 0;
  for (const vr of allVerifications) {
    const date = vr.verified_at?.split("T")[0] || vr.date;
    if (!date || date < from || date > to) continue;
    totalVerifications++;
    const key = getBucketKey(vr.verified_at || vr.date + "T00:00:00Z");
    if (!bucketMap[key]) bucketMap[key] = makeBucket(key);
    bucketMap[key].verifications += 1;
  }

  const daily_views = Object.entries(bucketMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, data]) => ({
      date: data.label,
      views: data.views,
      unique: data.visitors.size,
      returning: data.returning,
      mobile: data.mobile,
      desktop: data.desktop,
      referrers: data.referrers,
      orders: data.orders,
      verifications: data.verifications,
    }));

  return Response.json({
    total_views: visits.length,
    unique_visitors: uniqueVisitors,
    device_breakdown: device,
    referrer_breakdown: referrerGrouped,
    referrer_raw: referrerRaw,
    daily_views,
    new_vs_returning: { new: newCount, returning: returningCount },
    total_orders: totalOrders,
    total_verifications: totalVerifications,
    total_referrers: Object.values(referrerGrouped).reduce((a, b) => a + b, 0),
  });
};

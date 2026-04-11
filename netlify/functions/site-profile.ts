import type { Context } from "@netlify/functions";
import { getSiteProfile, setSiteProfile } from "./_shared/store.js";
import { requireOwner } from "./_shared/auth.js";

export default async (req: Request, context: Context) => {
  if (req.method === "GET") {
    const profile = await getSiteProfile();
    return Response.json(profile);
  }

  if (req.method === "PUT") {
    const headers = Object.fromEntries(req.headers.entries());
    if (!requireOwner(headers)) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const profile = await getSiteProfile();

    // Merge only known fields
    const keys: (keyof typeof profile)[] = [
      "carousel_images", "address_text", "address_link", "address_enabled",
      "google_url", "google_enabled", "instagram_url", "instagram_enabled",
      "facebook_url", "facebook_enabled", "tiktok_url", "tiktok_enabled",
      "owner_names", "phone", "email", "contact_enabled",
      "shop_url", "shop_text", "shop_enabled",
      "walkthrough_enabled",
      "review_page_url", "review_page_enabled",
    ];
    for (const key of keys) {
      if (key in body) {
        (profile as any)[key] = body[key];
      }
    }

    await setSiteProfile(profile);
    return Response.json(profile);
  }

  return new Response("Method not allowed", { status: 405 });
};

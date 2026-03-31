import type { Context } from "@netlify/functions";
import { getConfig } from "./_shared/store.js";

export default async (req: Request, context: Context) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const config = await getConfig();
  return Response.json({
    in_store_ordering_enabled: config.in_store_ordering_enabled ?? false,
    menu_editing_active: config.menu_editing_active ?? false,
  });
};

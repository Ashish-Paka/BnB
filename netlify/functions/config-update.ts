import type { Context } from "@netlify/functions";
import { getConfig, setConfig } from "./_shared/store.js";
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
  const config = await getConfig();

  if (typeof body.in_store_ordering_enabled === "boolean") {
    config.in_store_ordering_enabled = body.in_store_ordering_enabled;
  }
  if (typeof body.menu_editing_active === "boolean") {
    config.menu_editing_active = body.menu_editing_active;
  }

  await setConfig(config);

  return Response.json({
    in_store_ordering_enabled: config.in_store_ordering_enabled ?? false,
    menu_editing_active: config.menu_editing_active ?? false,
  });
};

import type { Context } from "@netlify/functions";
import { requireOwner } from "./_shared/auth.js";
import { getConfig } from "./_shared/store.js";
import {
  activateMenuPreset,
  ensureMenuPresets,
  summarizeMenuPresets,
  updateMenuPresetTitle,
} from "./_shared/menu-presets.js";

export default async (req: Request, _context: Context) => {
  const headers = Object.fromEntries(req.headers.entries());
  if (!requireOwner(headers)) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (req.method === "GET") {
    const store = await ensureMenuPresets();
    return Response.json(summarizeMenuPresets(store));
  }

  if (req.method === "PUT") {
    const body = await req.json();
    if (typeof body.index !== "number" || typeof body.title !== "string") {
      return new Response("Invalid body", { status: 400 });
    }

    const store = await updateMenuPresetTitle(body.index, body.title);
    return Response.json(summarizeMenuPresets(store));
  }

  if (req.method === "POST") {
    const body = await req.json();
    if (typeof body.index !== "number") {
      return new Response("Invalid body", { status: 400 });
    }

    const config = await getConfig();
    const draftOnly = body.draft_only === true;
    if (draftOnly && !config.menu_editing_active) {
      return new Response("Enter edit mode before switching draft presets", { status: 409 });
    }

    const store = await activateMenuPreset(body.index, { publish: !draftOnly });
    return Response.json(summarizeMenuPresets(store));
  }

  await ensureMenuPresets();
  return new Response("Method not allowed", { status: 405 });
};

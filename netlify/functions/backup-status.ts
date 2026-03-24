import type { Context } from "@netlify/functions";
import { requireOwner } from "./_shared/auth.js";
import { getBackup } from "./_shared/store.js";

export default async (req: Request, _context: Context) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const headers = Object.fromEntries(req.headers.entries());
  if (!requireOwner(headers)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const backup = await getBackup();
  if (backup && backup.exported_at) {
    return Response.json({ has_backup: true, exported_at: backup.exported_at });
  }

  return Response.json({ has_backup: false });
};

import type { Context } from "@netlify/functions";
import { getPersistentCodes, setPersistentCodes } from "./_shared/store.js";
import { requireOwner } from "./_shared/auth.js";
import type { PersistentCode } from "./_shared/types.js";

const DEFAULT_LABELS = ["Counter", "Drive-thru", "Mobile", "Backup 1", "Backup 2"];

function randomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const headers = Object.fromEntries(req.headers.entries());
  if (!requireOwner(headers)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let codes = await getPersistentCodes();

  // Auto-initialize on first access
  if (codes.length === 0) {
    const now = new Date().toISOString();
    codes = DEFAULT_LABELS.map((label) => ({
      id: crypto.randomUUID(),
      label,
      code: randomCode(),
      enabled: true,
      created_at: now,
    }));
    await setPersistentCodes(codes);
  }

  return Response.json(codes);
};

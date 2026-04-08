import type { Context } from "@netlify/functions";
import { getPersistentCodes, setPersistentCodes } from "./_shared/store.js";
import { requireOwner } from "./_shared/auth.js";

const MAX_CODES = 10;

function randomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export default async (req: Request, _context: Context) => {
  if (req.method !== "PUT") {
    return new Response("Method not allowed", { status: 405 });
  }

  const headers = Object.fromEntries(req.headers.entries());
  if (!requireOwner(headers)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const { action, id, label, enabled, regenerate, custom_code } = body;

  const codes = await getPersistentCodes();

  // Add a new code
  if (action === "add") {
    if (codes.length >= MAX_CODES) {
      return Response.json({ error: `Maximum ${MAX_CODES} codes allowed` }, { status: 400 });
    }
    codes.push({
      id: crypto.randomUUID(),
      label: label || `Code ${codes.length + 1}`,
      code: randomCode(),
      enabled: true,
      created_at: new Date().toISOString(),
    });
    await setPersistentCodes(codes);
    return Response.json(codes);
  }

  // Delete a code
  if (action === "delete") {
    if (!id) return new Response("Missing id", { status: 400 });
    const filtered = codes.filter((c) => c.id !== id);
    if (filtered.length === codes.length) {
      return new Response("Code not found", { status: 404 });
    }
    await setPersistentCodes(filtered);
    return Response.json(filtered);
  }

  // Update existing code
  if (!id) {
    return new Response("Missing id", { status: 400 });
  }

  const idx = codes.findIndex((c) => c.id === id);
  if (idx === -1) {
    return new Response("Code not found", { status: 404 });
  }

  if (typeof label === "string") {
    codes[idx].label = label;
  }
  if (typeof enabled === "boolean") {
    codes[idx].enabled = enabled;
  }
  if (regenerate) {
    codes[idx].code = randomCode();
  }
  if (custom_code && /^\d{6}$/.test(custom_code)) {
    codes[idx].code = custom_code;
  }

  await setPersistentCodes(codes);
  return Response.json(codes);
};

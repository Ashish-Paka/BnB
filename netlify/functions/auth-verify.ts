import type { Context } from "@netlify/functions";
import { requireOwner } from "./_shared/auth.js";

export default async (req: Request, context: Context) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const headers = Object.fromEntries(req.headers.entries());
  const valid = requireOwner(headers);

  return Response.json({ valid });
};

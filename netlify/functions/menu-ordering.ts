import type { Context } from "@netlify/functions";
import { getMenuOrdering, setMenuOrdering } from "./_shared/store.js";
import { requireOwner } from "./_shared/auth.js";

export default async (req: Request, context: Context) => {
  if (req.method === "GET") {
    const ordering = await getMenuOrdering();
    return Response.json(ordering);
  }

  if (req.method === "PUT") {
    const headers = Object.fromEntries(req.headers.entries());
    if (!requireOwner(headers)) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const ordering = {
      category_order: body.category_order || [],
      subcategory_order: body.subcategory_order || {},
    };
    await setMenuOrdering(ordering);
    return Response.json(ordering);
  }

  return new Response("Method not allowed", { status: 405 });
};

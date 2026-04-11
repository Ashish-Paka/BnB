import type { Context } from "@netlify/functions";
import { getCarouselImage, setCarouselImage, deleteCarouselImage } from "./_shared/store.js";
import { requireOwner } from "./_shared/auth.js";

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return new Response("Missing id", { status: 400 });

  if (req.method === "GET") {
    const img = await getCarouselImage(id);
    if (!img) return new Response("Not found", { status: 404 });
    return new Response(img.data, {
      headers: { "Content-Type": img.contentType, "Cache-Control": "public, max-age=300" },
    });
  }

  const headers = Object.fromEntries(req.headers.entries());
  if (!requireOwner(headers)) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (req.method === "POST") {
    const contentType = req.headers.get("content-type") || "image/webp";
    const data = await req.arrayBuffer();
    await setCarouselImage(id, data, contentType);
    return Response.json({ success: true, id });
  }

  if (req.method === "DELETE") {
    await deleteCarouselImage(id);
    return Response.json({ success: true });
  }

  return new Response("Method not allowed", { status: 405 });
};

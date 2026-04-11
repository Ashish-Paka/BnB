import type { Context } from "@netlify/functions";
import { getLogoImage, setLogoImage, deleteLogoImage } from "./_shared/store.js";
import { requireOwner } from "./_shared/auth.js";

export default async (req: Request, context: Context) => {
  if (req.method === "GET") {
    const img = await getLogoImage();
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
    await setLogoImage(data, contentType);
    return Response.json({ success: true });
  }

  if (req.method === "DELETE") {
    await deleteLogoImage();
    return Response.json({ success: true });
  }

  return new Response("Method not allowed", { status: 405 });
};

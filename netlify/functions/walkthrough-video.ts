import type { Context } from "@netlify/functions";
import { getWalkthroughVideo, setWalkthroughVideo, deleteWalkthroughVideo } from "./_shared/store.js";
import { requireOwner } from "./_shared/auth.js";

export default async (req: Request, context: Context) => {
  if (req.method === "GET") {
    const vid = await getWalkthroughVideo();
    if (!vid) return new Response("Not found", { status: 404 });
    return new Response(vid.data, {
      headers: { "Content-Type": vid.contentType, "Cache-Control": "public, max-age=300" },
    });
  }

  const headers = Object.fromEntries(req.headers.entries());
  if (!requireOwner(headers)) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (req.method === "POST") {
    const contentType = req.headers.get("content-type") || "video/mp4";
    const data = await req.arrayBuffer();
    await setWalkthroughVideo(data, contentType);
    return Response.json({ success: true });
  }

  if (req.method === "DELETE") {
    await deleteWalkthroughVideo();
    return Response.json({ success: true });
  }

  return new Response("Method not allowed", { status: 405 });
};

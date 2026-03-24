import type { Context } from "@netlify/functions";
import { compare, hash } from "bcryptjs";
import { requireOwner, extractLoginMethod, isOwnerPrimary, isAdmin } from "./_shared/auth.js";
import { getConfig, setConfig, ensureMigrated } from "./_shared/store.js";

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const headers = Object.fromEntries(req.headers.entries());
  if (!requireOwner(headers)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginMethod = extractLoginMethod(headers);
  if (!loginMethod) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await ensureMigrated(await getConfig());
  const isOwner = isOwnerPrimary(loginMethod, config);
  const isAdminUser = isAdmin(loginMethod, config);

  if (!isOwner && !isAdminUser) {
    return Response.json({ error: "Only owner or admin can change passwords" }, { status: 403 });
  }

  const { current_password, new_password, password_type } = await req.json();
  const targetType = password_type || "owner";

  if (!new_password || new_password.length < 8) {
    return Response.json({ error: "New password must be at least 8 characters" }, { status: 400 });
  }

  if (targetType === "owner") {
    // Only owner/primary can change the main password
    if (!isOwner) {
      return Response.json({ error: "Only the owner can change the main password" }, { status: 403 });
    }
    if (!current_password) {
      return Response.json({ error: "Current password is required" }, { status: 400 });
    }
    const valid = await compare(current_password, config.owner_password_hash);
    if (!valid) {
      return Response.json({ error: "Current password is incorrect" }, { status: 401 });
    }
    config.owner_password_hash = await hash(new_password, 10);
  } else if (targetType === "admin") {
    // Only admin can change admin password
    if (!isAdminUser) {
      return Response.json({ error: "Only admin can change the admin password" }, { status: 403 });
    }
    if (!current_password) {
      return Response.json({ error: "Current password is required" }, { status: 400 });
    }
    if (!config.admin_password_hash) {
      return Response.json({ error: "Admin password not set" }, { status: 400 });
    }
    const valid = await compare(current_password, config.admin_password_hash);
    if (!valid) {
      return Response.json({ error: "Current admin password is incorrect" }, { status: 401 });
    }
    config.admin_password_hash = await hash(new_password, 10);
  } else {
    return Response.json({ error: "Invalid password_type" }, { status: 400 });
  }

  await setConfig(config);
  return Response.json({ success: true });
};

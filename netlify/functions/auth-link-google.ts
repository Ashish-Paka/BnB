import type { Context } from "@netlify/functions";
import { getConfig, setConfig, ensureMigrated } from "./_shared/store.js";
import { requireOwner, extractLoginMethod, isPrimaryOrPassword, isOwnerPrimary, isAdmin } from "./_shared/auth.js";

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

  const body = await req.json();
  const action = body.action;
  let config = await ensureMigrated(await getConfig());
  const accounts = config.google_accounts || [];

  if (!isPrimaryOrPassword(loginMethod, config)) {
    return Response.json({ error: "Only the primary account can manage Google accounts" }, { status: 403 });
  }

  if (action === "add" || action === "link") {
    const { id_token } = body;
    if (!id_token) {
      return Response.json({ error: "id_token required" }, { status: 400 });
    }
    if (accounts.length >= 4) {
      return Response.json({ error: "Maximum 4 accounts allowed" }, { status: 400 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return Response.json({ error: "Google Sign-In not configured" }, { status: 500 });
    }

    const verifyRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(id_token)}`
    );
    if (!verifyRes.ok) {
      return Response.json({ error: "Invalid Google token" }, { status: 401 });
    }
    const payload = await verifyRes.json();
    if (payload.aud !== clientId || payload.email_verified !== "true") {
      return Response.json({ error: "Invalid Google token" }, { status: 401 });
    }

    const email = payload.email.toLowerCase();
    if (accounts.some((a) => a.email === email)) {
      return Response.json({ error: "Account already linked" }, { status: 400 });
    }

    const requestedRole = body.role || undefined;
    let role: "primary" | "secondary" | "admin";
    if (accounts.length === 0) {
      role = "primary";
    } else if (requestedRole === "admin") {
      if (!isAdmin(loginMethod, config)) {
        return Response.json({ error: "Only admin can add admin Google accounts" }, { status: 403 });
      }
      if (accounts.some((a) => a.email !== email && a.role === "admin")) {
        return Response.json({ error: "An admin account already exists" }, { status: 400 });
      }
      role = "admin";
    } else {
      role = "secondary";
    }
    accounts.push({ email, role });
    config.google_accounts = accounts;
    await setConfig(config);

    return Response.json({ success: true, google_accounts: accounts });
  }

  if (action === "remove" || action === "unlink") {
    const email = (body.email || "").toLowerCase();
    if (!email) {
      return Response.json({ error: "email required" }, { status: 400 });
    }
    const target = accounts.find((a) => a.email === email);
    if (!target) {
      return Response.json({ error: "Account not found" }, { status: 404 });
    }
    if (target.role === "primary") {
      return Response.json({ error: "Cannot remove the primary account. Change primary first." }, { status: 400 });
    }
    // Owner can't remove admin accounts; admin can remove any
    if (target.role === "admin" && !isAdmin(loginMethod, config)) {
      return Response.json({ error: "Only admin can manage admin accounts" }, { status: 403 });
    }
    config.google_accounts = accounts.filter((a) => a.email !== email);
    await setConfig(config);

    return Response.json({ success: true, google_accounts: config.google_accounts });
  }

  // Replace: change which Google account is linked for a slot
  // Primary can replace any account, secondary can replace their own
  if (action === "replace") {
    const { id_token, old_email } = body;
    const targetEmail = (old_email || "").toLowerCase();
    if (!id_token || !targetEmail) {
      return Response.json({ error: "id_token and old_email required" }, { status: 400 });
    }

    const target = accounts.find((a) => a.email === targetEmail);
    if (!target) {
      return Response.json({ error: "Account not found" }, { status: 404 });
    }

    // Secondary can only replace their own account
    if (!isPrimaryOrPassword(loginMethod, config) && loginMethod !== targetEmail) {
      return Response.json({ error: "You can only change your own account" }, { status: 403 });
    }
    // Owner can't replace admin accounts
    if (target.role === "admin" && !isAdmin(loginMethod, config)) {
      return Response.json({ error: "Only admin can manage admin accounts" }, { status: 403 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return Response.json({ error: "Google Sign-In not configured" }, { status: 500 });
    }

    const verifyRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(id_token)}`
    );
    if (!verifyRes.ok) {
      return Response.json({ error: "Invalid Google token" }, { status: 401 });
    }
    const payload = await verifyRes.json();
    if (payload.aud !== clientId || payload.email_verified !== "true") {
      return Response.json({ error: "Invalid Google token" }, { status: 401 });
    }

    const newEmail = payload.email.toLowerCase();
    if (newEmail !== targetEmail && accounts.some((a) => a.email === newEmail)) {
      return Response.json({ error: "This account is already linked" }, { status: 400 });
    }

    config.google_accounts = accounts.map((a) =>
      a.email === targetEmail ? { ...a, email: newEmail } : a
    );
    await setConfig(config);

    return Response.json({ success: true, google_accounts: config.google_accounts });
  }

  if (action === "set_primary") {
    const email = (body.email || "").toLowerCase();
    if (!email) {
      return Response.json({ error: "email required" }, { status: 400 });
    }
    if (!accounts.some((a) => a.email === email)) {
      return Response.json({ error: "Account not found" }, { status: 404 });
    }
    config.google_accounts = accounts.map((a) => {
      if (a.role === "admin") return a; // preserve admin role
      return { ...a, role: a.email === email ? "primary" as const : "secondary" as const };
    });
    await setConfig(config);

    return Response.json({ success: true, google_accounts: config.google_accounts });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
};

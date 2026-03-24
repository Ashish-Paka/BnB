import type { Context } from "@netlify/functions";
import { requireOwner, extractLoginMethod, isOwnerPrimary, isAdmin } from "./_shared/auth.js";
import { getConfig, ensureMigrated } from "./_shared/store.js";

export default async (req: Request, context: Context) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const headers = Object.fromEntries(req.headers.entries());
  if (!requireOwner(headers)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await ensureMigrated(await getConfig());
  const loginMethod = extractLoginMethod(headers) || "password";
  const isOwner = isOwnerPrimary(loginMethod, config);
  const isAdminUser = isAdmin(loginMethod, config);

  // Filter visible accounts by role
  let visibleAccounts = config.google_accounts || [];
  if (isAdminUser) {
    // Admin sees ALL accounts
  } else if (isOwner) {
    // Owner sees primary + secondary only (NOT admin)
    visibleAccounts = visibleAccounts.filter((a) => a.role !== "admin");
  } else {
    // Secondary sees only their own account
    visibleAccounts = visibleAccounts.filter((a) => a.email === loginMethod);
  }

  return Response.json({
    google_accounts: visibleAccounts,
    login_method: loginMethod,
    can_change_password: isOwner || isAdminUser,
    is_owner: isOwner,
    is_admin: isAdminUser,
    has_admin_password: !!config.admin_password_hash,
  });
};

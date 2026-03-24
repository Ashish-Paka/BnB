import type { Context } from "@netlify/functions";
import { getConfig, ensureMigrated } from "./_shared/store.js";
import { createToken } from "./_shared/auth.js";

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { id_token } = await req.json();
  if (!id_token) {
    return Response.json({ error: "id_token required" }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return Response.json({ error: "Google Sign-In not configured" }, { status: 500 });
  }

  // Verify the token with Google
  const verifyRes = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(id_token)}`
  );
  if (!verifyRes.ok) {
    return Response.json({ error: "Invalid Google token" }, { status: 401 });
  }

  const payload = await verifyRes.json();

  if (payload.aud !== clientId) {
    return Response.json({ error: "Token audience mismatch" }, { status: 401 });
  }
  if (payload.email_verified !== "true") {
    return Response.json({ error: "Email not verified" }, { status: 401 });
  }

  const config = await ensureMigrated(await getConfig());
  const email = payload.email.toLowerCase();
  const accounts = config.google_accounts || [];

  if (accounts.length === 0) {
    return Response.json(
      { error: "No Google accounts linked. Link one in Settings first." },
      { status: 403 }
    );
  }

  const match = accounts.find((a) => a.email === email);
  if (!match) {
    return Response.json({ error: "This Google account is not authorized" }, { status: 403 });
  }

  const token = createToken(email);
  return Response.json({ token });
};

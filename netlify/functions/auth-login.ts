import type { Context } from "@netlify/functions";
import { compare, hash } from "bcryptjs";
import { getConfig, setConfig } from "./_shared/store.js";
import { createToken } from "./_shared/auth.js";
import * as OTPAuth from "otpauth";

const DEFAULT_PASSWORD = "bonesandbru2024";
const DEFAULT_ADMIN_PASSWORD = "bonesandbruadmin";

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.json();
  const { password } = body;

  if (!password) {
    return new Response(JSON.stringify({ error: "Password required" }), {
      status: 400,
    });
  }

  const config = await getConfig();

  // First-time setup: hash default password and generate TOTP secret
  if (!config.owner_password_hash) {
    config.owner_password_hash = await hash(DEFAULT_PASSWORD, 10);
    const secret = new OTPAuth.Secret({ size: 20 });
    config.totp_secret = secret.base32;
    await setConfig(config);
  }

  // Try owner password first
  const validOwner = await compare(password, config.owner_password_hash);
  if (validOwner) {
    const token = createToken("password");
    return Response.json({ token });
  }

  // Bootstrap admin password on first admin login attempt
  if (!config.admin_password_hash) {
    config.admin_password_hash = await hash(DEFAULT_ADMIN_PASSWORD, 10);
    await setConfig(config);
  }

  // Try admin password
  const validAdmin = await compare(password, config.admin_password_hash);
  if (validAdmin) {
    const token = createToken("admin");
    return Response.json({ token });
  }

  return new Response(JSON.stringify({ error: "Invalid password" }), {
    status: 401,
  });
};

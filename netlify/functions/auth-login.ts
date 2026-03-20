import type { Context } from "@netlify/functions";
import { compare, hash } from "bcryptjs";
import { getConfig, setConfig } from "./_shared/store.js";
import { createToken } from "./_shared/auth.js";
import * as OTPAuth from "otpauth";

const DEFAULT_PASSWORD = "bonesandbru2024";

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

  const valid = await compare(password, config.owner_password_hash);
  if (!valid) {
    return new Response(JSON.stringify({ error: "Invalid password" }), {
      status: 401,
    });
  }

  const token = createToken();
  return Response.json({ token });
};

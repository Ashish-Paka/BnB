import type { Context } from "@netlify/functions";
import { requireOwner } from "./_shared/auth.js";
import { generateCode } from "./_shared/totp.js";
import { getConfig, setConfig } from "./_shared/store.js";
import * as OTPAuth from "otpauth";

export default async (req: Request, context: Context) => {
  if (req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const headers = Object.fromEntries(req.headers.entries());
  if (!requireOwner(headers)) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Ensure TOTP secret exists
  const config = await getConfig();
  if (!config.totp_secret) {
    const secret = new OTPAuth.Secret({ size: 20 });
    config.totp_secret = secret.base32;
    await setConfig(config);
  }

  const result = await generateCode();
  return Response.json(result);
};

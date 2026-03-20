import * as OTPAuth from "otpauth";
import { getConfig } from "./store.js";

export async function getTOTP(): Promise<OTPAuth.TOTP> {
  const config = await getConfig();
  return new OTPAuth.TOTP({
    issuer: "Bones & Bru",
    label: "Visit Verification",
    algorithm: "SHA1",
    digits: 6,
    period: config.totp_period_seconds || 600, // 10 minutes
    secret: config.totp_secret,
  });
}

export async function generateCode(): Promise<{
  code: string;
  remaining_seconds: number;
  qr_uri: string;
}> {
  const totp = await getTOTP();
  const code = totp.generate();
  const period = totp.period;
  const elapsed = Math.floor(Date.now() / 1000) % period;
  const remaining_seconds = period - elapsed;
  const qr_uri = totp.toString();

  return { code, remaining_seconds, qr_uri };
}

export async function verifyCode(code: string): Promise<boolean> {
  const totp = await getTOTP();
  // Allow current window and 1 previous window
  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}

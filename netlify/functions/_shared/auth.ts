import type { AppConfig } from "./types.js";

const SECRET = process.env.JWT_SECRET || "bnb-owner-secret-change-me";

// Simple token: base64(JSON{ exp, login_method }) + "." + base64(hmac)

export function createToken(loginMethod: string = "password"): string {
  const exp = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  const payload = Buffer.from(JSON.stringify({ exp, login_method: loginMethod })).toString("base64url");
  const sig = Buffer.from(simpleHash(payload + SECRET)).toString("base64url");
  return `${payload}.${sig}`;
}

export function verifyToken(token: string): boolean {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return false;
    const expectedSig = Buffer.from(simpleHash(payload + SECRET)).toString("base64url");
    if (sig !== expectedSig) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.exp > Date.now();
  } catch {
    return false;
  }
}

export function getTokenPayload(token: string): { exp: number; login_method: string } | null {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    const expectedSig = Buffer.from(simpleHash(payload + SECRET)).toString("base64url");
    if (sig !== expectedSig) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (data.exp <= Date.now()) return null;
    return { exp: data.exp, login_method: data.login_method || "password" };
  } catch {
    return null;
  }
}

export function extractLoginMethod(headers: Record<string, string>): string | null {
  const auth = headers["authorization"] || headers["Authorization"] || "";
  const token = auth.replace("Bearer ", "");
  const payload = getTokenPayload(token);
  return payload?.login_method || null;
}

export function isPrimaryOrPassword(loginMethod: string, config: AppConfig): boolean {
  if (loginMethod === "password") return true;
  if (loginMethod === "admin") return true;
  const account = config.google_accounts?.find((a) => a.email === loginMethod);
  return account?.role === "primary" || account?.role === "admin";
}

export function isOwnerPrimary(loginMethod: string, config: AppConfig): boolean {
  if (loginMethod === "password") return true;
  const account = config.google_accounts?.find((a) => a.email === loginMethod);
  return account?.role === "primary";
}

export function isAdmin(loginMethod: string, config: AppConfig): boolean {
  if (loginMethod === "admin") return true;
  const account = config.google_accounts?.find((a) => a.email === loginMethod);
  return account?.role === "admin";
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(36);
}

export function requireOwner(headers: Record<string, string>): boolean {
  const auth = headers["authorization"] || headers["Authorization"] || "";
  const token = auth.replace("Bearer ", "");
  return verifyToken(token);
}

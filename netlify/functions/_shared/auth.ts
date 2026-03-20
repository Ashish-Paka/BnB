import { getConfig } from "./store.js";

const SECRET = process.env.JWT_SECRET || "bnb-owner-secret-change-me";

// Simple token: base64(JSON{ exp }) + "." + base64(hmac)
// Not a full JWT, just enough for single-owner auth

export function createToken(): string {
  const exp = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  const sig = Buffer.from(
    simpleHash(payload + SECRET)
  ).toString("base64url");
  return `${payload}.${sig}`;
}

export function verifyToken(token: string): boolean {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return false;
    const expectedSig = Buffer.from(
      simpleHash(payload + SECRET)
    ).toString("base64url");
    if (sig !== expectedSig) return false;
    const data = JSON.parse(
      Buffer.from(payload, "base64url").toString()
    );
    return data.exp > Date.now();
  } catch {
    return false;
  }
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

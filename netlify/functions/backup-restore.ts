import type { Context } from "@netlify/functions";
import { requireOwner, extractLoginMethod, isPrimaryOrPassword } from "./_shared/auth.js";
import { getBackup, getConfig, ensureMigrated } from "./_shared/store.js";
import { extractBackupData } from "./_shared/backup-archive.js";
import { restoreBackupData } from "./_shared/backup-data.js";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const headers = Object.fromEntries(req.headers.entries());
  if (!requireOwner(headers)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const loginMethod = extractLoginMethod(headers);
  if (!loginMethod) return new Response("Unauthorized", { status: 401 });
  const config = await ensureMigrated(await getConfig());
  if (!isPrimaryOrPassword(loginMethod, config)) {
    return Response.json({ error: "Only owner or admin can restore data" }, { status: 403 });
  }

  const storedBackup = await getBackup();
  const backup = await extractBackupData(storedBackup);
  if (!backup) {
    return new Response("No restore point available", { status: 404 });
  }

  const imported = await restoreBackupData(backup, "overwrite");
  return Response.json({
    success: true,
    mode: "overwrite",
    imported,
    restored_from: storedBackup?.exported_at ?? backup.exported_at ?? null,
  });
};

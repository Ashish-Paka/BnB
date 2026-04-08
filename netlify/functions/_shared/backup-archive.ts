import JSZip from "jszip";
import type { BackupArchive } from "./types.js";

function flattenToCSV(data: any[]): string {
  if (data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const escape = (val: any): string => {
    if (val === null || val === undefined) return "";
    const str = typeof val === "object" ? JSON.stringify(val) : String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const rows = data.map((row) => headers.map((h) => escape(row[h])).join(","));
  return [headers.join(","), ...rows].join("\n");
}

export async function createBackupArchive(data: any): Promise<BackupArchive> {
  const zip = new JSZip();

  zip.file("backup.json", JSON.stringify(data, null, 2));
  if (data.menu) zip.file("menu.csv", flattenToCSV(data.menu));
  if (data.menu_ordering) zip.file("menu-ordering.json", JSON.stringify(data.menu_ordering, null, 2));
  if (data.published_menu) zip.file("published-menu.csv", flattenToCSV(data.published_menu));
  if (data.published_menu_ordering) {
    zip.file("published-menu-ordering.json", JSON.stringify(data.published_menu_ordering, null, 2));
  }
  if (data.menu_presets) zip.file("menu-presets.json", JSON.stringify(data.menu_presets, null, 2));
  if (data.customers) zip.file("customers.csv", flattenToCSV(data.customers));
  if (data.orders) zip.file("orders.csv", flattenToCSV(data.orders));
  if (data.visits) zip.file("visits.csv", flattenToCSV(data.visits));
  if (data.config) zip.file("config.csv", flattenToCSV([data.config]));
  if (data.persistent_codes) zip.file("persistent-codes.json", JSON.stringify(data.persistent_codes, null, 2));
  if (data.analytics) zip.file("analytics.json", JSON.stringify(data.analytics, null, 2));

  if (data.images) {
    const imageFolder = zip.folder("images");
    for (const [itemId, imgData] of Object.entries(data.images) as [string, any][]) {
      if (!imgData?.data) continue;
      const ext = imgData.content_type?.includes("jpeg") ? "jpg" : "webp";
      imageFolder?.file(`${itemId}.${ext}`, imgData.data, { base64: true });
    }
  }

  if (data.published_images) {
    const imageFolder = zip.folder("published-images");
    for (const [itemId, imgData] of Object.entries(data.published_images) as [string, any][]) {
      if (!imgData?.data) continue;
      const ext = imgData.content_type?.includes("jpeg") ? "jpg" : "webp";
      imageFolder?.file(`${itemId}.${ext}`, imgData.data, { base64: true });
    }
  }

  const zipBase64 = await zip.generateAsync({ type: "base64" });
  return {
    exported_at: data.exported_at ?? new Date().toISOString(),
    zip_base64: zipBase64,
  };
}

export async function extractBackupData(backup: any): Promise<any | null> {
  if (!backup) return null;
  if (typeof backup?.zip_base64 === "string") {
    const zip = await JSZip.loadAsync(backup.zip_base64, { base64: true });
    const entry = zip.file("backup.json");
    if (!entry) return null;
    return JSON.parse(await entry.async("text"));
  }
  return backup;
}

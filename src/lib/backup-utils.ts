/**
 * Flatten an array of objects to CSV string.
 * Nested objects/arrays are JSON-stringified.
 */
export function flattenToCSV(data: any[]): string {
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

/**
 * Generate a ZIP blob containing CSVs + images from backup data.
 */
export async function generateBackupZip(data: any): Promise<Blob> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  if (data.menu) zip.file("menu.csv", flattenToCSV(data.menu));
  if (data.customers) zip.file("customers.csv", flattenToCSV(data.customers));
  if (data.orders) zip.file("orders.csv", flattenToCSV(data.orders));
  if (data.visits) zip.file("visits.csv", flattenToCSV(data.visits));
  if (data.config) zip.file("config.csv", flattenToCSV([data.config]));

  // Add images
  if (data.images) {
    const imgFolder = zip.folder("images");
    for (const [itemId, imgData] of Object.entries(data.images) as [string, any][]) {
      if (imgData?.data) {
        const ext = imgData.content_type?.includes("jpeg") ? "jpg" : "webp";
        imgFolder?.file(`${itemId}.${ext}`, imgData.data, { base64: true });
      }
    }
  }

  return zip.generateAsync({ type: "blob" });
}

/**
 * Trigger a browser download for a blob.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Format a timestamp for filenames.
 */
export function formatBackupTimestamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Validate a backup JSON before import.
 */
export function validateBackupJSON(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Invalid JSON structure"] };
  }
  const d = data as any;
  if (d.menu && !Array.isArray(d.menu)) errors.push("menu should be an array");
  if (d.customers && !Array.isArray(d.customers)) errors.push("customers should be an array");
  if (d.orders && !Array.isArray(d.orders)) errors.push("orders should be an array");
  if (d.visits && !Array.isArray(d.visits)) errors.push("visits should be an array");
  if (d.config && (typeof d.config !== "object" || Array.isArray(d.config))) errors.push("config should be an object");
  if (!d.menu && !d.customers && !d.orders && !d.visits && !d.config) {
    errors.push("No recognizable data keys found (menu, customers, orders, visits, config)");
  }
  return { valid: errors.length === 0, errors };
}

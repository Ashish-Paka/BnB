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

  // Site profile data
  if (data.site_profile) zip.file("site-profile.json", JSON.stringify(data.site_profile, null, 2));
  if (data.carousel_images) {
    const carouselFolder = zip.folder("carousel-images");
    for (const [id, imgData] of Object.entries(data.carousel_images) as [string, any][]) {
      if (imgData?.data) {
        const ext = imgData.content_type?.includes("jpeg") ? "jpg" : "webp";
        carouselFolder?.file(`${id}.${ext}`, imgData.data, { base64: true });
      }
    }
  }
  if (data.logo_image?.data) {
    const ext = data.logo_image.content_type?.includes("jpeg") ? "jpg" : "webp";
    zip.file(`logo.${ext}`, data.logo_image.data, { base64: true });
  }
  if (data.walkthrough_video?.data) {
    const ext = data.walkthrough_video.content_type?.includes("mp4") ? "mp4" : "webm";
    zip.file(`walkthrough.${ext}`, data.walkthrough_video.data, { base64: true });
  }

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
  if (data.published_images) {
    const imgFolder = zip.folder("published-images");
    for (const [itemId, imgData] of Object.entries(data.published_images) as [string, any][]) {
      if (imgData?.data) {
        const ext = imgData.content_type?.includes("jpeg") ? "jpg" : "webp";
        imgFolder?.file(`${itemId}.${ext}`, imgData.data, { base64: true });
      }
    }
  }

  return zip.generateAsync({ type: "blob" });
}

/**
 * Read a backup from a JSON file or from a ZIP containing backup.json.
 */
export async function parseBackupFile(file: File): Promise<any> {
  const fileName = file.name.toLowerCase();
  if (fileName.endsWith(".zip")) {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const backupEntry = Object.values(zip.files).find(
      (entry) => !entry.dir && /(^|\/)backup\.json$/i.test(entry.name)
    );
    if (!backupEntry) {
      throw new Error("ZIP backup is missing backup.json");
    }
    return JSON.parse(await backupEntry.async("text"));
  }

  return JSON.parse(await file.text());
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
  if (d.menu_ordering && (typeof d.menu_ordering !== "object" || Array.isArray(d.menu_ordering))) {
    errors.push("menu_ordering should be an object");
  }
  if (d.published_menu && !Array.isArray(d.published_menu)) errors.push("published_menu should be an array");
  if (
    d.published_menu_ordering &&
    (typeof d.published_menu_ordering !== "object" || Array.isArray(d.published_menu_ordering))
  ) {
    errors.push("published_menu_ordering should be an object");
  }
  if (d.menu_presets && (typeof d.menu_presets !== "object" || Array.isArray(d.menu_presets))) {
    errors.push("menu_presets should be an object");
  }
  if (d.customers && !Array.isArray(d.customers)) errors.push("customers should be an array");
  if (d.orders && !Array.isArray(d.orders)) errors.push("orders should be an array");
  if (d.visits && !Array.isArray(d.visits)) errors.push("visits should be an array");
  if (d.config && (typeof d.config !== "object" || Array.isArray(d.config))) errors.push("config should be an object");
  if (d.images && (typeof d.images !== "object" || Array.isArray(d.images))) errors.push("images should be an object");
  if (d.published_images && (typeof d.published_images !== "object" || Array.isArray(d.published_images))) {
    errors.push("published_images should be an object");
  }
  if (d.persistent_codes && !Array.isArray(d.persistent_codes)) errors.push("persistent_codes should be an array");
  if (d.analytics && !Array.isArray(d.analytics)) errors.push("analytics should be an array");
  if (d.site_profile && (typeof d.site_profile !== "object" || Array.isArray(d.site_profile))) {
    errors.push("site_profile should be an object");
  }
  if (d.carousel_images && (typeof d.carousel_images !== "object" || Array.isArray(d.carousel_images))) {
    errors.push("carousel_images should be an object");
  }
  if (d.logo_image && (typeof d.logo_image !== "object" || Array.isArray(d.logo_image))) {
    errors.push("logo_image should be an object");
  }
  if (d.walkthrough_video && (typeof d.walkthrough_video !== "object" || Array.isArray(d.walkthrough_video))) {
    errors.push("walkthrough_video should be an object");
  }
  if (
    !d.menu &&
    !d.menu_ordering &&
    !d.published_menu &&
    !d.published_menu_ordering &&
    !d.menu_presets &&
    !d.customers &&
    !d.orders &&
    !d.visits &&
    !d.config &&
    !d.persistent_codes &&
    !d.analytics &&
    !d.site_profile
  ) {
    errors.push("No recognizable data keys found");
  }
  return { valid: errors.length === 0, errors };
}

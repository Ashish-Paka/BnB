import type { Context } from "@netlify/functions";
import { requireOwner, extractLoginMethod, isPrimaryOrPassword } from "./_shared/auth.js";
import {
  getBackup,
  getBackupImages,
  getBackupPublishedImages,
  getBackupCarouselImages,
  getBackupLogoImage,
  getBackupWalkthroughVideo,
  getConfig,
  ensureMigrated,
  setMenuImage,
  setPublishedMenuImage,
  setCarouselImage,
  setLogoImage,
  setWalkthroughVideo,
} from "./_shared/store.js";
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

  // Read data (without images) and images separately
  const backup = await getBackup();
  if (!backup) {
    return new Response("No restore point available", { status: 404 });
  }

  // Handle old-format backups that have zip_base64
  let data = backup;
  if (typeof backup?.zip_base64 === "string") {
    const { extractBackupData } = await import("./_shared/backup-archive.js");
    data = await extractBackupData(backup);
    if (!data) {
      return new Response("Failed to extract backup", { status: 500 });
    }
  }

  // Restore data (no images in the body — they're stored separately)
  const imported = await restoreBackupData(data, "overwrite");

  // Restore images individually from separate blob keys
  let imageCount = 0;
  try {
    const [images, publishedImages, carouselImages, logoImg, walkthroughVid] = await Promise.all([
      getBackupImages(),
      getBackupPublishedImages(),
      getBackupCarouselImages(),
      getBackupLogoImage(),
      getBackupWalkthroughVideo(),
    ]);

    for (const [itemId, imgData] of Object.entries(images)) {
      if (!imgData?.data || !imgData?.content_type) continue;
      try {
        const buffer = Buffer.from(imgData.data, "base64");
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        await setMenuImage(itemId, arrayBuffer, imgData.content_type);
        imageCount++;
      } catch {}
    }

    for (const [itemId, imgData] of Object.entries(publishedImages)) {
      if (!imgData?.data || !imgData?.content_type) continue;
      try {
        const buffer = Buffer.from(imgData.data, "base64");
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        await setPublishedMenuImage(itemId, arrayBuffer, imgData.content_type);
        imageCount++;
      } catch {}
    }

    // Restore carousel images
    for (const [id, imgData] of Object.entries(carouselImages)) {
      if (!imgData?.data || !imgData?.content_type) continue;
      try {
        const buffer = Buffer.from(imgData.data, "base64");
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        await setCarouselImage(id, arrayBuffer, imgData.content_type);
        imageCount++;
      } catch {}
    }

    // Restore logo
    if (logoImg?.data && logoImg?.content_type) {
      try {
        const buffer = Buffer.from(logoImg.data, "base64");
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        await setLogoImage(arrayBuffer, logoImg.content_type);
        imageCount++;
      } catch {}
    }

    // Restore walkthrough video
    if (walkthroughVid?.data && walkthroughVid?.content_type) {
      try {
        const buffer = Buffer.from(walkthroughVid.data, "base64");
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        await setWalkthroughVideo(arrayBuffer, walkthroughVid.content_type);
        imageCount++;
      } catch {}
    }
  } catch {}

  imported.images_restored = imageCount;

  return Response.json({
    success: true,
    mode: "overwrite",
    imported,
    restored_from: backup?.exported_at ?? data?.exported_at ?? null,
  });
};

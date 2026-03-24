/**
 * Resize an image file using Canvas API.
 * Returns a WebP blob (JPEG fallback) under ~200KB.
 */
export function resizeImage(file: File, maxDim = 800, quality = 0.7): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);

      // Try WebP first, fallback to JPEG
      canvas.toBlob(
        (blob) => {
          if (blob) return resolve(blob);
          // Fallback to JPEG
          canvas.toBlob(
            (jpegBlob) => {
              if (jpegBlob) resolve(jpegBlob);
              else reject(new Error("Failed to compress image"));
            },
            "image/jpeg",
            quality,
          );
        },
        "image/webp",
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

import { Attachment } from "./api";

// Read any file to a data-URL attachment.
function readAsDataUrl(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve({ name: file.name, type: file.type || "application/octet-stream", url: String(r.result) });
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// Re-encode a raster image to WebP via canvas (much smaller than PNG, and no
// worse than JPEG). Keeps the pixels, swaps the container.
function toWebp(file: File, quality = 0.85): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no 2d context");
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        const dataUrl = canvas.toDataURL("image/webp", quality);
        if (!dataUrl.startsWith("data:image/webp")) throw new Error("webp unsupported");
        const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
        resolve({ name, type: "image/webp", url: dataUrl });
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("decode failed")); };
    img.src = url;
  });
}

// PNG and other heavy raster formats are re-encoded to WebP to save disk space;
// JPEG/WebP are already compact and animated GIF / vector SVG are left as-is.
const KEEP_AS_IS = new Set(["image/jpeg", "image/webp", "image/gif", "image/svg+xml"]);

/** Save a data-URL (or any URL) image to disk via a synthetic <a download>. */
export function downloadImage(url: string, name: string) {
  const ext = /^data:image\/(\w+)/.exec(url)?.[1] || "png";
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function fileToAttachment(file: File): Promise<Attachment> {
  if (file.type.startsWith("image/") && !KEEP_AS_IS.has(file.type)) {
    try {
      return await toWebp(file);
    } catch {
      /* conversion unavailable — fall back to the original bytes */
    }
  }
  return readAsDataUrl(file);
}

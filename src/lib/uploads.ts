import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Local-disk image storage.
 *
 * Good enough for development and a single-server deploy. On a read-only or
 * multi-instance host (Vercel, containers behind a load balancer) swap this for
 * S3/R2 - the rest of the app only ever sees the returned URL string.
 */
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/avif", "avif"],
]);

export type UploadResult = { ok: true; url: string } | { ok: false; error: string };

/** Magic-number check: never trust the client-declared content type alone. */
function sniff(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "image/png";
  }
  const riff = String.fromCharCode(...bytes.slice(0, 4));
  const webp = String.fromCharCode(...bytes.slice(8, 12));
  if (riff === "RIFF" && webp === "WEBP") return "image/webp";
  const brand = String.fromCharCode(...bytes.slice(4, 12));
  if (brand.startsWith("ftypavif")) return "image/avif";
  return null;
}

export async function saveImage(file: File): Promise<UploadResult> {
  if (!file || file.size === 0) return { ok: false, error: "That file was empty." };
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Images must be 5 MB or smaller." };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = sniff(new Uint8Array(buffer.subarray(0, 16)));

  if (!detected || !ALLOWED.has(detected)) {
    return { ok: false, error: "Upload a JPEG, PNG, WebP, or AVIF image." };
  }

  const ext = ALLOWED.get(detected)!;
  const name = `${randomUUID()}.${ext}`;

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, name), buffer);

  return { ok: true, url: `/uploads/${name}` };
}

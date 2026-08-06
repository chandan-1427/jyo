import { createClient } from "@supabase/supabase-js";
import { fileTypeFromBuffer } from "file-type";
import crypto from "crypto";
import { env } from "../env.js";
import { logger } from "./logger.js";

const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY // bypasses RLS
);

// Only known-safe image types are allowed — uploads are served back from a
// public URL with this same content type, so accepting arbitrary types
// (e.g. image/svg+xml, text/html) would let someone host a stored-XSS
// payload. Detected from the file's actual magic bytes via `file-type`
// rather than trusting the client-supplied Content-Type/filename, which is
// just multipart metadata anyone can spoof — a renamed .html file claiming
// to be "image/jpeg" would otherwise sail through unchecked. The extension
// used for storage also comes from this detected type, so it can never
// smuggle anything unexpected.
const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heic-sequence": "heic",
};

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// A little above MAX_FILE_SIZE_BYTES to leave room for multipart boundary/
// header overhead — this is the request-level cap checked before the body
// is ever buffered into memory; the real per-file limit is still enforced
// below on the decoded buffer.
export const MAX_UPLOAD_REQUEST_BYTES = MAX_FILE_SIZE_BYTES + 1024 * 1024; // 6 MB

export async function uploadFile(
  buffer: Buffer,
  bucket: "food-photos" | "selfies" | "avatars"
): Promise<string> {
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error("File is too large. Maximum size is 5MB.");
  }

  const detected = await fileTypeFromBuffer(buffer);
  const ext = detected && ALLOWED_MIME_TYPES[detected.mime];

  if (!ext) {
    throw new Error(
      "Unsupported or unrecognized file type. Only JPEG, PNG, WEBP, and HEIC images are allowed."
    );
  }

  const filename = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filename, buffer, {
      contentType: detected.mime,
      upsert: false,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(filename);

  return data.publicUrl;
}

// Best-effort cleanup for when a row referencing an uploaded file is
// deleted outright (as opposed to just changing status) — the file's
// public URL is the only thing we ever stored, so the filename has to be
// recovered from it. Failures are logged, not thrown: a stuck storage
// object is a cheap cleanup job later, but failing the caller's delete
// over it would leave the DB and storage in a worse mismatch than before.
export async function deleteFile(
  publicUrl: string,
  bucket: "food-photos" | "selfies" | "avatars"
): Promise<void> {
  const filename = publicUrl.split("/").pop();
  if (!filename) return;

  const { error } = await supabase.storage.from(bucket).remove([filename]);
  if (error) {
    logger.error({ err: error, bucket, filename }, "Failed to delete storage file");
  }
}

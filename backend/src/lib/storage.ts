import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { env } from "../env.js";

const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY // bypasses RLS
);

// Only known-safe image types are allowed — uploads are served back from a
// public URL with this same content type, so accepting arbitrary types
// (e.g. image/svg+xml, text/html) would let someone host a stored-XSS
// payload. The extension is derived from this allowlist rather than the
// client-supplied filename, so it can never smuggle anything unexpected.
const ALLOWED_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function uploadFile(
  buffer: Buffer,
  mimetype: string,
  bucket: "food-photos" | "selfies"
): Promise<string> {
  const ext = ALLOWED_MIME_TYPES[mimetype];
  if (!ext) {
    throw new Error(
      `Unsupported file type "${mimetype}". Only JPEG, PNG, WEBP, and HEIC images are allowed.`
    );
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new Error("File is too large. Maximum size is 5MB.");
  }

  const filename = `${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(bucket)
    .upload(filename, buffer, {
      contentType: mimetype,
      upsert: false,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(filename);

  return data.publicUrl;
}

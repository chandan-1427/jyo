import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // bypasses RLS
);

export async function uploadFile(
  buffer: Buffer,
  filename: string,
  mimetype: string,
  bucket: "food-photos" | "selfies"
): Promise<string> {
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
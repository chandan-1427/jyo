import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export async function uploadImage(
  file: File,
  bucket: "food-photos" | "selfies"
): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const endpoint =
    bucket === "food-photos"
      ? "/posts/upload"
      : "/requests/upload-selfie";

  const res = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}`, {
    method: "POST",
    credentials: "include", // send auth cookie
    body: formData,         // no Content-Type header — browser sets it with boundary
  });

  const data = await res.json();

  if (!res.ok) throw new Error(data.error || "Upload failed");

  return data.url;
}

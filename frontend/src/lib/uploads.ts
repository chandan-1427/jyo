import { useCallback, useRef } from "react";
import type { Profile } from "@/lib/api/queries/auth";
import { apiFetch } from "@/lib/api/api";

type Bucket = "food-photos" | "selfies";

function formWith(file: File) {
  const form = new FormData();
  form.append("file", file);
  return form;
}

export async function uploadImage(file: File, bucket: Bucket): Promise<string> {
  const path = bucket === "food-photos" ? "/posts/photos" : "/requests/selfies";
  const data = await apiFetch(path, { method: "POST", body: formWith(file) });
  return data.url;
}

// For a form's photo: retrying a failed submit reuses the image already
// stored for that same file instead of uploading another copy.
export function useImageUpload(bucket: Bucket) {
  const last = useRef<{ file: File; url: string } | null>(null);
  return useCallback(
    async (file: File) => {
      if (last.current?.file === file) return last.current.url;
      const url = await uploadImage(file, bucket);
      last.current = { file, url };
      return url;
    },
    [bucket]
  );
}

export async function uploadAvatar(file: File): Promise<Profile> {
  const data = await apiFetch("/users/me/avatar", { method: "POST", body: formWith(file) });
  return data.user;
}

export async function removeAvatar(): Promise<Profile> {
  const data = await apiFetch("/users/me/avatar", { method: "DELETE" });
  return data.user;
}

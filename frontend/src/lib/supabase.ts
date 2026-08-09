import type { Profile } from "@/lib/api/queries/auth";

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

export async function uploadAvatar(file: File): Promise<Profile> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${import.meta.env.VITE_API_URL}/users/me/avatar`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  const data = await res.json();

  if (!res.ok) throw new Error(data.error || "Upload failed");

  return data.user;
}

export async function removeAvatar(): Promise<Profile> {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/users/me/avatar`, {
    method: "DELETE",
    credentials: "include",
  });

  const data = await res.json();

  if (!res.ok) throw new Error(data.error || "Failed to remove avatar");

  return data.user;
}

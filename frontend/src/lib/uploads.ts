import type { Profile } from "@/lib/api/queries/auth";
import { apiFetch } from "@/lib/api/api";

function formWith(file: File) {
  const form = new FormData();
  form.append("file", file);
  return form;
}

export async function uploadImage(file: File, bucket: "food-photos" | "selfies"): Promise<string> {
  const path = bucket === "food-photos" ? "/posts/photos" : "/requests/selfies";
  const data = await apiFetch(path, { method: "POST", body: formWith(file) });
  return data.url;
}

export async function uploadAvatar(file: File): Promise<Profile> {
  const data = await apiFetch("/users/me/avatar", { method: "POST", body: formWith(file) });
  return data.user;
}

export async function removeAvatar(): Promise<Profile> {
  const data = await apiFetch("/users/me/avatar", { method: "DELETE" });
  return data.user;
}

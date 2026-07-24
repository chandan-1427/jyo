import { apiFetch } from "@/lib/api";

export type Profile = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  locationText?: string | null;
  description?: string | null;
  createdAt?: string;
};

export const authMeKey = ["auth", "me"] as const;

export async function fetchAuthMe(): Promise<Profile | null> {
  try {
    const res = await apiFetch("/users/me");
    return res.user;
  } catch {
    return null;
  }
}

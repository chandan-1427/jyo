const BASE_URL = import.meta.env.VITE_API_URL;

export async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: "include", // sends cookies on every request
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Something went wrong");
  }

  return data;
}
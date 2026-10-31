export const BASE_URL = import.meta.env.VITE_API_URL;

const UNREACHABLE = "Can't reach Jyo right now. Check your connection and try again.";
const SERVER_TROUBLE = "Jyo is having trouble right now. Please try again in a moment.";

export class ApiError extends Error {
  // 0 when the server couldn't be reached at all.
  status: number;
  details?: Record<string, string[]>;

  constructor(message: string, status: number, details?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

// Every failure surfaces as an ApiError with a message fit to show: the
// server's own, or a fallback when it couldn't be reached or answered with
// something other than JSON (the host's error page while a deploy starts).
export async function apiFetch(path: string, options?: RequestInit) {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      credentials: "include",
      ...options,
      headers: {
        // A FormData body needs the browser's own multipart Content-Type.
        ...(options?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...options?.headers,
      },
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(UNREACHABLE, 0);
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const fallback = res.status >= 500 ? SERVER_TROUBLE : "Something went wrong";
    throw new ApiError(data?.error || fallback, res.status, data?.details);
  }
  if (data === null) throw new ApiError(SERVER_TROUBLE, res.status);

  return data;
}

import type { Context } from "hono";
import { createMiddleware } from "hono/factory";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { uploadFile, MAX_UPLOAD_REQUEST_BYTES } from "./storage.js";
import { UploadRejectedError } from "./errors.js";

type Parsed<T> = { ok: true; data: T } | { ok: false; response: Response };

const MAX_JSON_BODY_BYTES = 64 * 1024;

const jsonBodyLimit = bodyLimit({
  maxSize: MAX_JSON_BODY_BYTES,
  onError: (c) => c.json({ error: "Request body is too large" }, 413),
});

const uploadBodyLimit = bodyLimit({
  maxSize: MAX_UPLOAD_REQUEST_BYTES,
  onError: (c) => c.json({ error: "File is too large. Maximum size is 5MB." }, 413),
});

// Caps every request body before anything reads it: room for one photo in an
// upload, a few kilobytes of JSON otherwise. Applied app-wide so a new route
// can't be left without a limit.
export const limitBodySize = createMiddleware((c, next) =>
  c.req.header("content-type")?.toLowerCase().startsWith("multipart/form-data")
    ? uploadBodyLimit(c, next)
    : jsonBodyLimit(c, next)
);

// Reads a JSON body and validates it against `schema`. A body that isn't
// JSON at all (malformed, or missing) is the client's mistake, so it's a 400
// like any other bad input, not a thrown SyntaxError reaching app.onError as
// a reported 500.
export async function parseJsonBody<S extends z.ZodType>(c: Context, schema: S): Promise<Parsed<z.infer<S>>> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return { ok: false, response: c.json({ error: "Request body must be valid JSON" }, 400) };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      ok: false,
      response: c.json({ error: "Invalid input", details: z.flattenError(result.error).fieldErrors }, 400),
    };
  }
  return { ok: true, data: result.data };
}

// Validates the query string against `schema`, answering a 400 with field
// errors as parseJsonBody does for bodies.
export function parseQuery<S extends z.ZodType>(c: Context, schema: S): Parsed<z.infer<S>> {
  const result = schema.safeParse(c.req.query());
  if (!result.success) {
    return {
      ok: false,
      response: c.json({ error: "Invalid query", details: z.flattenError(result.error).fieldErrors }, 400),
    };
  }
  return { ok: true, data: result.data };
}

// The multipart "file" field of an upload, stored in `bucket`. A malformed
// form, a missing file or one refused for its size or type is answered here;
// a storage failure is thrown on to app.onError.
export async function uploadFromForm(
  c: Context,
  bucket: Parameters<typeof uploadFile>[1]
): Promise<{ ok: true; url: string } | { ok: false; response: Response }> {
  let body: Awaited<ReturnType<Context["req"]["parseBody"]>>;
  try {
    body = await c.req.parseBody();
  } catch {
    return { ok: false, response: c.json({ error: "Request body must be valid form data" }, 400) };
  }
  const file = body["file"];

  if (!file || typeof file === "string") {
    return { ok: false, response: c.json({ error: "No file provided" }, 400) };
  }

  try {
    const url = await uploadFile(Buffer.from(await file.arrayBuffer()), bucket);
    return { ok: true, url };
  } catch (err) {
    if (err instanceof UploadRejectedError) {
      return { ok: false, response: c.json({ error: err.message }, err.status) };
    }
    throw err;
  }
}

import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { jwtVerify } from "jose";

type AuthUser = {
  userId: string;
  email: string;
};

declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser;
  }
}

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

export const authMiddleware = createMiddleware(async (c, next) => {
  const token = getCookie(c, "token");

  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const { payload } = await jwtVerify(token, secret);

    c.set("user", {
      userId: payload.userId as string,
      email: payload.email as string,
    });

    await next();
  } catch {
    return c.json({ error: "Invalid or expired token" }, 401);
  }
});
import crypto from "crypto";

// Tokens for email links (verify email, reset password). The link carries
// the token; the database keeps only its SHA-256, so a copy of the database
// (a leaked backup, say) holds nothing that opens an account. The token is
// 32 random bytes, so a fast unsalted hash is enough: there's nothing to
// guess. Lookups hash what the link brings and match on that.
export function newLinkToken() {
  const token = crypto.randomBytes(32).toString("hex");
  return { token, hash: hashLinkToken(token) };
}

export const hashLinkToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

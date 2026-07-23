import { Resend } from "resend";
import { env } from "../env.js";

const resend = new Resend(env.RESEND_API_KEY);

async function sendMail(to: string, subject: string, html: string) {
  const { error } = await resend.emails.send({
    from: "Jyo <hello@jyo.co.in>",
    replyTo: "hello@jyo.co.in",
    to,
    subject,
    html,
  });

  if (error) throw new Error(`Resend error: ${error.message}`);
}

// --- Shared email layout ---
// Inline styles only — email clients (esp. Outlook) don't support
// CSS variables, :root, or most modern CSS. This can't reuse the
// app's design tokens directly; keep it in sync by hand if the
// palette changes.

const BRAND_DARK = "#1B1A19";
const ACCENT_TINT = "#FEF3C7";   // amber-100 — safe as a background fill
const ACCENT_TEXT = "#B45309";   // amber-700 — safe as text/link on white
const TEXT_PRIMARY = "#171717";
const TEXT_MUTED = "#737373";
const TEXT_SUBTLE = "#a3a3a3";
const BORDER = "#e5e5e5";
const PAGE_BG = "#f5f5f4";

function emailLayout({
  heading,
  bodyText,
  ctaLabel,
  ctaLink,
  footnote,
}: {
  heading: string;
  bodyText: string;
  ctaLabel: string;
  ctaLink: string;
  footnote: string;
}) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${heading}</title>
</head>
<body style="margin:0;padding:0;background-color:${PAGE_BG};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${PAGE_BG};padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:400px;">

          <!-- Brand -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <span style="font-size:20px;font-weight:700;color:${TEXT_PRIMARY};letter-spacing:-0.5px;">
                Jyo<span style="color:${ACCENT_TEXT};">.</span>
              </span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#ffffff;border-radius:16px;padding:36px 32px;border:1px solid ${BORDER};">
              <table width="100%" cellpadding="0" cellspacing="0">

                <!-- Accent mark (no glyph — see note on icon compatibility) -->
                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <div style="display:inline-block;background-color:${ACCENT_TINT};border-radius:50%;width:10px;height:10px;"></div>
                  </td>
                </tr>

                <!-- Heading -->
                <tr>
                  <td align="center" style="padding-bottom:8px;">
                    <h1 style="margin:0;font-size:22px;font-weight:700;color:${TEXT_PRIMARY};letter-spacing:-0.4px;">
                      ${heading}
                    </h1>
                  </td>
                </tr>

                <!-- Body text -->
                <tr>
                  <td align="center" style="padding-bottom:28px;">
                    <p style="margin:0;font-size:14px;color:${TEXT_MUTED};line-height:1.6;text-align:center;">
                      ${bodyText}
                    </p>
                  </td>
                </tr>

                <!-- CTA button -->
                <tr>
                  <td align="center" style="padding-bottom:28px;">
                    <a href="${ctaLink}"
                      style="display:inline-block;background-color:${BRAND_DARK};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 32px;border-radius:8px;letter-spacing:0.1px;">
                      ${ctaLabel}
                    </a>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="border-top:1px solid #f0f0f0;padding-top:24px;"></td>
                </tr>

                <!-- Fallback link -->
                <tr>
                  <td align="center">
                    <p style="margin:0;font-size:12px;color:${TEXT_SUBTLE};line-height:1.6;text-align:center;">
                      If the button doesn't work, copy and paste this link into your browser:
                    </p>
                    <p style="margin:6px 0 0;font-size:12px;word-break:break-all;text-align:center;">
                      <a href="${ctaLink}" style="color:${ACCENT_TEXT};text-decoration:underline;">${ctaLink}</a>
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:20px;">
              <p style="margin:0;font-size:12px;color:${TEXT_SUBTLE};text-align:center;line-height:1.6;">
                ${footnote}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
  `;
}

// --- Notification emails (fire and forget) ---

export function notifyPoster(
  email: string,
  event: "request_received" | "request_cancelled"
) {
  const subjects = {
    request_received: "Someone wants to pick up your food",
    request_cancelled: "A pickup request was cancelled",
  };
  const messages = {
    request_received:
      "Someone has requested to pick up your food post on Jyo. Open the app to review and approve.",
    request_cancelled:
      "A picker has cancelled their request on your food post. It is now open for others.",
  };
  sendMail(email, subjects[event], `<p>${messages[event]}</p>`)
    .catch((err) => console.error("[MAILER] notifyPoster failed:", err));
}

export function notifyPicker(
  email: string,
  event: "request_approved" | "request_rejected"
) {
  const subjects = {
    request_approved: "Your pickup request was approved",
    request_rejected: "Your pickup request was rejected",
  };
  const messages = {
    request_approved:
      "Your request was approved. Open the app to see the pickup location and head there now.",
    request_rejected:
      "Your request was rejected by the poster. Check the feed for other food posts nearby.",
  };
  sendMail(email, subjects[event], `<p>${messages[event]}</p>`)
    .catch((err) => console.error("[MAILER] notifyPicker failed:", err));
}

// --- Transactional emails (awaited) ---

export async function sendVerificationEmail(email: string, token: string) {
  const link = `${env.APP_URL}/verify-email?token=${token}`;
  await sendMail(
    email,
    "Verify your Jyo account",
    emailLayout({
      heading: "Verify your email",
      bodyText: "Welcome to Jyo! Click the button below to verify your email address and activate your account.",
      ctaLabel: "Verify my email",
      ctaLink: link,
      footnote:
        "You're receiving this because an account was created with this email address.<br/>If you didn't sign up for Jyo, you can safely ignore this email.",
    })
  );
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const link = `${env.APP_URL}/reset-password?token=${token}`;
  await sendMail(
    email,
    "Reset your Jyo password",
    emailLayout({
      heading: "Reset your password",
      bodyText: "You requested a password reset for your Jyo account. Click the button below to choose a new one. This link expires in 1 hour.",
      ctaLabel: "Reset password",
      ctaLink: link,
      footnote:
        "You're receiving this because a password reset was requested for this account.<br/>If you didn't request this, you can safely ignore this email.",
    })
  );
}
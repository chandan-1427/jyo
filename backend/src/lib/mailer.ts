import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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
  const link = `${process.env.APP_URL}/verify-email?token=${token}`;
  await sendMail(
    email,
    "Verify your Jyo account",
    `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Verify your Jyo account</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f4;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:400px;">

          <!-- Brand -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <span style="font-size:20px;font-weight:700;color:#171717;letter-spacing:-0.5px;">
                Jyo<span style="color:#2D6A4F;">.</span>
              </span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#ffffff;border-radius:16px;padding:36px 32px;border:1px solid #e5e5e5;">

              <!-- Icon badge -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <div style="display:inline-block;background-color:#e8f3ee;border-radius:50%;width:56px;height:56px;text-align:center;line-height:56px;font-size:26px;">
                      ✉️
                    </div>
                  </td>
                </tr>

                <!-- Heading -->
                <tr>
                  <td align="center" style="padding-bottom:8px;">
                    <h1 style="margin:0;font-size:22px;font-weight:700;color:#171717;letter-spacing:-0.4px;">
                      Verify your email
                    </h1>
                  </td>
                </tr>

                <!-- Body text -->
                <tr>
                  <td align="center" style="padding-bottom:28px;">
                    <p style="margin:0;font-size:14px;color:#737373;line-height:1.6;text-align:center;">
                      Welcome to Jyo! Click the button below to verify your email address and activate your account.
                    </p>
                  </td>
                </tr>

                <!-- CTA button -->
                <tr>
                  <td align="center" style="padding-bottom:28px;">
                    <a href="${link}"
                      style="display:inline-block;background-color:#171717;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 32px;border-radius:8px;letter-spacing:0.1px;">
                      Verify my email
                    </a>
                  </td>
                </tr>

                <!-- Divider -->
                <tr>
                  <td style="border-top:1px solid #f0f0f0;padding-top:24px;">
                  </td>
                </tr>

                <!-- Fallback link -->
                <tr>
                  <td align="center">
                    <p style="margin:0;font-size:12px;color:#a3a3a3;line-height:1.6;text-align:center;">
                      If the button doesn't work, copy and paste this link into your browser:
                    </p>
                    <p style="margin:6px 0 0;font-size:12px;word-break:break-all;text-align:center;">
                      <a href="${link}" style="color:#2D6A4F;text-decoration:underline;">${link}</a>
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:20px;">
              <p style="margin:0;font-size:12px;color:#a3a3a3;text-align:center;line-height:1.6;">
                You're receiving this because an account was created with this email address.<br/>
                If you didn't sign up for Jyo, you can safely ignore this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>
    `
  );
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const link = `${process.env.APP_URL}/reset-password?token=${token}`;
  await sendMail(
    email,
    "Reset your Jyo password",
    `
      <p>You requested a password reset for your Jyo account.</p>
      <p>Click the link below to reset your password. This link expires in 1 hour.</p>
      <a href="${link}" style="color:#f97316;font-weight:bold;">Reset Password</a>
      <p>If you did not request this, ignore this email.</p>
    `
  );
}
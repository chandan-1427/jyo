import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendMail(to: string, subject: string, html: string) {
  const { error } = await resend.emails.send({
    from: "Jyos <noreply@jyo.co.in>",
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
      "Someone has requested to pick up your food post on Jyos. Open the app to review and approve.",
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
    "Verify your Jyos account",
    `
      <p>Welcome to Jyos!</p>
      <p>Please verify your email address by clicking the link below:</p>
      <a href="${link}" style="color:#f97316;font-weight:bold;">Verify Email</a>
      <p>This link does not expire.</p>
    `
  );
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const link = `${process.env.APP_URL}/reset-password?token=${token}`;
  await sendMail(
    email,
    "Reset your Jyos password",
    `
      <p>You requested a password reset for your Jyos account.</p>
      <p>Click the link below to reset your password. This link expires in 1 hour.</p>
      <a href="${link}" style="color:#f97316;font-weight:bold;">Reset Password</a>
      <p>If you did not request this, ignore this email.</p>
    `
  );
}
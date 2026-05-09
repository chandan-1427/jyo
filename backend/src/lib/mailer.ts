// Placeholder — real Nodemailer logic will be added later
export async function notifyPoster(email: string, event: "request_received" | "request_cancelled") {
  console.log(`[MAILER] Notify poster ${email} — event: ${event}`);
}

export async function notifyPicker(email: string, event: "request_approved" | "request_rejected") {
  console.log(`[MAILER] Notify picker ${email} — event: ${event}`);
}
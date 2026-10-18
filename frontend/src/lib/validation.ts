import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Field rules. backend/src/lib/validation.ts defines the same `fields`, rule
// for rule and message for message, and backend/src/lib/validation.parity.test.ts
// fails CI if the two ever disagree. Change a rule here → change it there too.
// ─────────────────────────────────────────────────────────────────────────────
export const fields = {
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name is too long"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  phone: z.string().trim().regex(/^\d{10}$/, "Enter a valid 10-digit phone number"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password is too long"),
  loginPassword: z.string().min(1, "Enter your password"),
  locationText: z.string().trim().max(200, "Area is too long"),
  about: z.string().trim().max(500, "About you is too long"),
  etaMinutes: z
    .number({ error: "Enter how many minutes you need" })
    .int("Enter whole minutes")
    .min(1, "Enter at least 1 minute")
    .max(180, "It must be 180 minutes or less"),
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(100, "Title is too long"),
  description: z.string().trim().max(500, "Description is too long"),
};

// ─── Auth ────────────────────────────────────────────────────────────────────
export const registerSchema = z.object({
  name: fields.name,
  email: fields.email,
  phone: fields.phone,
  password: fields.newPassword,
});

export const loginSchema = z.object({
  email: fields.email,
  password: fields.loginPassword,
});

export const forgotPasswordSchema = z.object({
  email: fields.email,
});

export const resetPasswordSchema = z.object({
  password: fields.newPassword,
});

// ─── Profile ─────────────────────────────────────────────────────────────────
export const profileSchema = z.object({
  name: fields.name,
  phone: fields.phone,
  locationText: fields.locationText,
  description: fields.about,
});

// ─── Pickup request ──────────────────────────────────────────────────────────
// `selfie` is form-only: the file is uploaded first and the API receives its URL.
export const requestSchema = z.object({
  pickerName: fields.name,
  etaMinutes: fields.etaMinutes,
  selfie: z.instanceof(File, { error: "Add a selfie so the person sharing can see who is coming" }),
});

// ─── Create post ─────────────────────────────────────────────────────────────
// Leftover food doesn't keep, so a pickup can't be set more than a week out.
// The API applies the same limit; the date picker stops there too.
export const MAX_PICKUP_DAYS_AHEAD = 7;
const endWithinLimit = (d: { pickupWindowEnd: string }) =>
  !d.pickupWindowEnd || new Date(d.pickupWindowEnd).getTime() <= Date.now() + MAX_PICKUP_DAYS_AHEAD * 86_400_000;
const WITHIN_LIMIT = { message: `Pickup has to end within ${MAX_PICKUP_DAYS_AHEAD} days`, path: ["pickupWindowEnd"] };

// The pickup times are the form's local "YYYY-MM-DDTHH:mm" strings; the page
// converts them to ISO before sending. `photo` is uploaded first, like `selfie`.
export const createPostSchema = z
  .object({
    title: fields.title,
    description: fields.description,
    photo: z.instanceof(File, { error: "Add a photo of the food" }),
    pickupWindowStart: z.string().min(1, "Choose when pickup starts"),
    pickupWindowEnd: z.string().min(1, "Choose when pickup ends"),
  })
  .refine((d) => !d.pickupWindowEnd || new Date(d.pickupWindowEnd) > new Date(d.pickupWindowStart), {
    message: "End time must be after start time",
    path: ["pickupWindowEnd"],
  })
  .refine((d) => !d.pickupWindowEnd || new Date(d.pickupWindowEnd) > new Date(), {
    message: "End time must be in the future",
    path: ["pickupWindowEnd"],
  })
  .refine(endWithinLimit, WITHIN_LIMIT);

// ─── Edit post ───────────────────────────────────────────────────────────────
// Same rules, but the photo is optional: leaving it keeps the current one.
// The pickup spot isn't editable (the API doesn't accept it).
export const editPostSchema = z
  .object({
    title: fields.title,
    description: fields.description,
    photo: z.instanceof(File).optional(),
    pickupWindowStart: z.string().min(1, "Choose when pickup starts"),
    pickupWindowEnd: z.string().min(1, "Choose when pickup ends"),
  })
  .refine((d) => !d.pickupWindowEnd || new Date(d.pickupWindowEnd) > new Date(d.pickupWindowStart), {
    message: "End time must be after start time",
    path: ["pickupWindowEnd"],
  })
  .refine((d) => !d.pickupWindowEnd || new Date(d.pickupWindowEnd) > new Date(), {
    message: "End time must be in the future",
    path: ["pickupWindowEnd"],
  })
  .refine(endWithinLimit, WITHIN_LIMIT);

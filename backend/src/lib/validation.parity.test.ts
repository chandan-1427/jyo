import { describe, expect, it } from "vitest";
import type { z } from "zod";
import * as backend from "./validation.js";
import * as frontend from "../../../frontend/src/lib/validation.ts";

// The frontend and the API validate the same input with separate copies of
// the same rules (they're separate packages with separate builds). These
// tests fail CI the moment the copies disagree: on what's accepted, on how
// the value is cleaned up (trim, lowercase), or on the error message a user
// sees. Fix by making both validation.ts files match again.

// Inputs chosen to sit on every rule's edges.
const SAMPLES: Record<keyof typeof backend.fields, unknown[]> = {
  name: ["", "a", " a ", "Al", "  Ravi Kumar  ", "x".repeat(100), "x".repeat(101), 123],
  email: ["", "ravi", "ravi@", "ravi@gmail.com", "  Ravi@Gmail.COM  ", "a@b", null],
  phone: ["", "98765", "9876543210", " 9876543210 ", "98765432101", "abcdefghij", "+919876543210", "98765 43210"],
  newPassword: ["", "short", "12345678", "x".repeat(72), "x".repeat(73), "త".repeat(24), "త".repeat(25), "x".repeat(100)],
  loginPassword: ["", "x", "correct horse"],
  locationText: ["", "Balaji Nagar", " Alipiri ", "x".repeat(200), "x".repeat(201)],
  about: ["", "Student at SVU", "x".repeat(500), "x".repeat(501)],
  etaMinutes: [0, 1, 15, 180, 181, 2.5, Number.NaN, -5, "15", undefined],
  title: ["", "ab", " ab ", "Rice and dal", "x".repeat(100), "x".repeat(101)],
  description: ["", "Fresh, made today", "x".repeat(500), "x".repeat(501)],
};

type Schema = z.ZodType;

function outcome(schema: Schema, value: unknown) {
  const result = schema.safeParse(value);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, message: result.error.issues[0]?.message };
}

function expectSameOutcomes(front: Schema, back: Schema, samples: unknown[]) {
  for (const value of samples) {
    expect(outcome(front, value), `input ${JSON.stringify(value)}`).toEqual(outcome(back, value));
  }
}

describe("frontend and backend validation stay in sync", () => {
  it("define the same field rules", () => {
    expect(Object.keys(frontend.fields).sort()).toEqual(Object.keys(backend.fields).sort());
  });

  for (const field of Object.keys(SAMPLES) as (keyof typeof SAMPLES)[]) {
    it(`agree on the "${field}" rule`, () => {
      expectSameOutcomes(frontend.fields[field], backend.fields[field], SAMPLES[field]);
    });
  }

  // Each form must also use the same rule for each field as its API
  // endpoint — e.g. both sides validating sign-up's password as `newPassword`.
  // [form field (frontend schema), API field (backend schema), sample set]
  const FORMS: [string, Schema, Schema, [string, string, keyof typeof SAMPLES][]][] = [
    ["sign up", frontend.registerSchema, backend.registerSchema, [
      ["name", "name", "name"], ["email", "email", "email"], ["phone", "phone", "phone"], ["password", "password", "newPassword"],
    ]],
    ["log in", frontend.loginSchema, backend.loginSchema, [
      ["email", "email", "email"], ["password", "password", "loginPassword"],
    ]],
    ["forgot password", frontend.forgotPasswordSchema, backend.forgotPasswordSchema, [["email", "email", "email"]]],
    ["reset password", frontend.resetPasswordSchema, backend.resetPasswordSchema, [["password", "password", "newPassword"]]],
    ["profile", frontend.profileSchema, backend.updateProfileSchema, [
      ["name", "name", "name"], ["phone", "phone", "phone"],
      ["locationText", "locationText", "locationText"], ["description", "description", "about"],
    ]],
    ["pickup request", frontend.requestSchema, backend.createRequestSchema, [
      ["pickerName", "pickerName", "name"], ["etaMinutes", "etaMinutes", "etaMinutes"],
    ]],
    ["create post", frontend.createPostSchema, backend.createPostSchema, [
      ["title", "title", "title"], ["description", "description", "description"],
    ]],
    ["edit post", frontend.editPostSchema, backend.updatePostSchema, [
      ["title", "title", "title"], ["description", "description", "description"],
    ]],
  ];

  for (const [form, front, back, pairs] of FORMS) {
    it(`agree on every field of the ${form} form`, () => {
      const frontShape = (front as unknown as z.ZodObject).shape;
      const backShape = (back as unknown as z.ZodObject).shape;
      for (const [frontKey, backKey, samples] of pairs) {
        // The API treats some fields as optional (send only what changed);
        // for any value actually sent, the rule must match the form's.
        const backField = backShape[backKey] as Schema;
        const values = SAMPLES[samples].filter((v) => v !== undefined);
        expectSameOutcomes(frontShape[frontKey] as Schema, backField, values);
      }
    });
  }
});

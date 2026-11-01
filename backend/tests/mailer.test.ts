import { describe, it, expect, vi, beforeEach } from "vitest";

// Only the email service is faked: the real templates and links are built,
// and every message the app sends is captured here.
const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

import fs from "fs";
import { env } from "../src/env.js";
import { notifyPicker, notifyPoster, sendPasswordResetEmail, sendVerificationEmail } from "../src/lib/mailer.js";

beforeEach(() => {
  send.mockReset();
  send.mockResolvedValue({ data: { id: "sent" }, error: null });
});

// Every link in a message, so a stray or broken one shows up.
const linksIn = (html: string) => [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);

const lastMessage = () => send.mock.calls.at(-1)![0] as { from: string; to: string; subject: string; html: string };
const settle = () => new Promise((r) => setTimeout(r, 10));

function expectComplete(message: { html: string; subject: string }) {
  expect(message.subject.length).toBeGreaterThan(0);
  expect(message.html).not.toMatch(/undefined|null|\[object Object\]/);
}

describe("account emails", () => {
  it("sends the verification link to the app's verify page, with the token", async () => {
    await sendVerificationEmail("new@example.com", "abc123");
    const message = lastMessage();

    expect(message).toMatchObject({ to: "new@example.com", from: "Jyo <hello@jyo.co.in>", subject: "Verify your Jyo account" });
    // The button, and the same link written out for clients that hide buttons.
    const links = linksIn(message.html);
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const link of links) expect(link).toBe(`${env.APP_URL}/verify-email?token=abc123`);
    expectComplete(message);
  });

  it("sends the reset link to the app's reset page, with the token", async () => {
    await sendPasswordResetEmail("forgot@example.com", "def456");
    const message = lastMessage();

    expect(message).toMatchObject({ to: "forgot@example.com", subject: "Reset your Jyo password" });
    const links = linksIn(message.html);
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const link of links) expect(link).toBe(`${env.APP_URL}/reset-password?token=def456`);
    expectComplete(message);
  });

  // The links are only useful if the app has those pages.
  it("links only to pages the app actually has", () => {
    const routes = fs.readFileSync(new URL("../../frontend/src/App.tsx", import.meta.url), "utf8");
    expect(routes).toContain('path="/verify-email"');
    expect(routes).toContain('path="/reset-password"');
  });

  it("reports a failed send to the caller, so sign-up and reset can log it", async () => {
    send.mockResolvedValue({ data: null, error: { message: "domain not verified" } });
    await expect(sendVerificationEmail("x@example.com", "t")).rejects.toThrow(/domain not verified/);
  });
});

describe("pickup emails", () => {
  it.each([
    ["request_received", "Someone wants to pick up your food"],
    ["request_cancelled", "A pickup request was cancelled"],
  ] as const)("tells the poster about %s", async (event, subject) => {
    notifyPoster("poster@example.com", event);
    await settle();
    expect(lastMessage()).toMatchObject({ to: "poster@example.com", subject });
    expectComplete(lastMessage());
  });

  it.each([
    ["request_approved", "Your pickup request was approved"],
    ["request_rejected", "Your pickup request was rejected"],
  ] as const)("tells the picker about %s", async (event, subject) => {
    notifyPicker("picker@example.com", event);
    await settle();
    expect(lastMessage()).toMatchObject({ to: "picker@example.com", subject });
    expectComplete(lastMessage());
  });

  // They're sent after the action has already happened: a failed email must
  // never turn an approval into an error.
  it("never throws when a pickup email fails", async () => {
    send.mockRejectedValue(new Error("network down"));
    expect(() => notifyPoster("p@example.com", "request_received")).not.toThrow();
    expect(() => notifyPicker("p@example.com", "request_approved")).not.toThrow();
    await settle();
  });
});

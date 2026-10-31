import bcrypt from "bcryptjs";
import crypto from "crypto";
import { env } from "../env.js";

// bcrypt cost: each step doubles the work for anyone trying to crack a
// stolen hash (and for each login, ~0.25s at 12). Tests use the minimum,
// or the suite would spend minutes hashing.
const ROUNDS = env.APP_ENV === "test" ? 4 : 12;

export const hashPassword = (password: string) => bcrypt.hash(password, ROUNDS);

// A hash made at a lower cost than today's (older accounts), to redo on the
// next successful login, when the plain password is at hand.
export const needsRehash = (hash: string) => bcrypt.getRounds(hash) < ROUNDS;

export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

// Compared against when the email has no account, so that answer takes as
// long as a wrong password (same cost) and timing can't reveal which emails
// are registered. A random password nobody knows, hashed once at startup.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString("hex"), ROUNDS);

export const burnTimeForUnknownAccount = (password: string) => bcrypt.compare(password, DUMMY_HASH);

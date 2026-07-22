import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";
import { ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { LinkButton } from "../components/ui/LinkButton";
import { PasswordInput } from "../components/ui/PasswordInput";
import { Input } from "../components/ui/Input";
import { Logo } from "../components/ui/Logo";

const BENEFITS = [
  "Free to join, always",
  "No payments or delivery, ever",
  "Verified members only in your area",
];

const inputStyles =
  "!bg-background !border-border !text-foreground placeholder:!text-subtle focus:!border-neutral-600";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[13px] font-medium text-muted">{label}</label>
      {children}
    </div>
  );
}

function allowOnlyDigits(e: React.KeyboardEvent<HTMLInputElement>) {
  const allowed = ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End"];
  if (!allowed.includes(e.key) && !/^\d$/.test(e.key)) e.preventDefault();
}

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setLoading(true);
    try {
      await apiFetch("/auth/register", { method: "POST", body: JSON.stringify(form) });
      setRegistered(true);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.details) setFieldErrors(err.details);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen grid lg:grid-cols-2">

      {/* Left — brand / benefits panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 border-r border-border bg-surface/40">
        <Logo />

        <div className="max-w-sm">
          <h2 className="text-2xl font-semibold text-foreground tracking-tight leading-snug">
            Good food shouldn't go to waste while someone nearby needs it.
          </h2>
          <p className="mt-3 text-sm text-muted leading-relaxed">
            Join Jyo and start sharing food with your community in Tirupati.
          </p>

          <ul className="mt-8 flex flex-col gap-3">
            {BENEFITS.map((benefit) => (
              <li key={benefit} className="flex items-center gap-2.5 text-sm text-muted">
                <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
                {benefit}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-subtle">&copy; 2026 Jyo</p>
      </div>

      {/* Right — form */}
      <div className="flex flex-col justify-center px-6 py-8 sm:px-12">
        <div className="w-full max-w-[360px] mx-auto">

          <div className="relative mb-6 lg:hidden">
            <Logo />
          </div>

          {!registered && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="cursor-pointer mb-4 flex items-center gap-1 text-sm font-medium text-muted hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
          )}

          {/* Success state */}
          {registered ? (
            <div className="flex flex-col items-center text-center gap-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-accent/10">
                <Mail className="w-7 h-7 text-accent" />
              </div>

              <div className="flex flex-col gap-1.5">
                <h2 className="text-[1.3rem] font-semibold text-foreground tracking-tight">
                  Check your inbox
                </h2>
                <p className="text-sm text-muted leading-relaxed">
                  We've sent a verification link to{" "}
                  <span className="font-medium text-foreground">{form.email}</span>.
                  Please verify your email before logging in.
                </p>
              </div>

              <div className="w-full rounded-lg border border-border bg-surface px-4 py-3 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-accent mt-px shrink-0" />
                <p className="text-[13px] text-subtle leading-snug text-left">
                  Didn't receive the email? Check your spam folder or try registering again.
                </p>
              </div>

              <LinkButton
                as="button"
                label="Go to login"
                onClick={() => navigate("/login")}
                className="w-full"
              />

              <p className="text-[13px] text-subtle">
                Wrong email?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setRegistered(false);
                    setForm({ name: "", email: "", phone: "", password: "" });
                    setError("");
                  }}
                  className="font-medium text-foreground hover:underline underline-offset-2"
                >
                  Register again
                </button>
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-[1.4rem] font-semibold text-foreground tracking-tight">
                Create your account
              </h1>
              <p className="mt-1 mb-5 text-sm text-muted">
                Join Jyo and start sharing food with your community.
              </p>

              {error && (
                <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-900/40 bg-red-950/30 px-3.5 py-2.5">
                  <span className="mt-px text-red-400 text-sm shrink-0">!</span>
                  <p className="text-sm text-red-400 leading-snug">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-3">

                <Field label="Full name">
                  <Input
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Your full name"
                    autoComplete="name"
                    className={inputStyles}
                    required
                  />
                  {fieldErrors.name && (
                    <p className="text-xs text-red-400">{fieldErrors.name[0]}</p>
                  )}
                </Field>

                <Field label="Email">
                  <Input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className={inputStyles}
                    required
                  />
                  {fieldErrors.email && (
                    <p className="text-xs text-red-400">{fieldErrors.email[0]}</p>
                  )}
                </Field>

                <Field label="Phone number">
                  <Input
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={form.phone}
                    onChange={handleChange}
                    onKeyDown={allowOnlyDigits}
                    placeholder="10-digit mobile number"
                    autoComplete="tel"
                    className={inputStyles}
                    required
                  />
                  {fieldErrors.phone && (
                    <p className="text-xs text-red-400">{fieldErrors.phone[0]}</p>
                  )}
                </Field>

                <Field label="Password">
                  <PasswordInput
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Create a password"
                    autoComplete="new-password"
                    className={inputStyles}
                    required
                  />
                  {fieldErrors.password && (
                    <p className="text-xs text-red-400">{fieldErrors.password[0]}</p>
                  )}
                </Field>

                <LinkButton
                  as="button"
                  type="submit"
                  label="Create account"
                  loading={loading}
                  loadingLabel="Creating account…"
                  disabled={loading}
                  className="w-full mt-1"
                />

              </form>

              <p className="mt-5 text-[13px] text-subtle text-center">
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="font-medium text-foreground hover:underline underline-offset-2"
                >
                  Log in
                </Link>
              </p>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
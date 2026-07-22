import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";
import { Mail, CheckCircle2 } from "lucide-react";
import { LinkButton } from "../components/ui/LinkButton";
import { PasswordInput } from "../components/ui/PasswordInput";
import { Input } from "../components/ui/Input";
import { Logo } from "../components/ui/Logo";
import { AuthSidePanel } from "../components/auth/AuthSidePanel";
import { Field } from "../components/auth/Field";
import { authInputStyles, AUTH_BENEFITS } from "../components/auth/authStyles";
import { BackButton } from "../components/auth/BackButton";
import { validateForm, registerSchema } from "../lib/validation";

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    const validation = validateForm(registerSchema, form);
    if (!validation.success) {
      setFieldErrors(validation.fieldErrors);
      return; // stop here — no network request for input that's already known-invalid
    }

    setLoading(true);
    try {
      await apiFetch("/auth/register", { method: "POST", body: JSON.stringify(validation.data) });
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

      <AuthSidePanel
        headline="Good food shouldn't go to waste while someone nearby needs it."
        subtext="Join Jyo and start sharing food with your community in Tirupati."
        benefits={AUTH_BENEFITS}
      />

      {/* Right — form */}
      <div className="flex flex-col justify-center px-6 py-8 sm:px-12">
        <div className="w-full max-w-[360px] mx-auto">

          {/* Brand + back button + heading */}
          <div className="relative mb-6">
            {!registered && <BackButton />}

            <div className="lg:hidden mb-5">
              <Logo />
            </div>

            {!registered && (
              <>
                <h1 className="text-[1.4rem] font-semibold text-foreground tracking-tight">
                  Create your account
                </h1>
                <p className="mt-1 text-sm text-muted">
                  Join Jyo and start sharing food with your community.
                </p>
              </>
            )}
          </div>

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
                    className={authInputStyles}
                    required
                  />
                  {fieldErrors.name && <p className="text-xs text-red-400">{fieldErrors.name[0]}</p>}
                </Field>

                <Field label="Email">
                  <Input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className={authInputStyles}
                    required
                  />
                  {fieldErrors.email && <p className="text-xs text-red-400">{fieldErrors.email[0]}</p>}
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
                    className={authInputStyles}
                    required
                  />
                  {fieldErrors.phone && <p className="text-xs text-red-400">{fieldErrors.phone[0]}</p>}
                </Field>

                <Field label="Password">
                  <PasswordInput
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Create a password"
                    autoComplete="new-password"
                    className={authInputStyles}
                    required
                  />
                  {fieldErrors.password && <p className="text-xs text-red-400">{fieldErrors.password[0]}</p>}
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
                <Link to="/login" className="font-medium text-foreground hover:underline underline-offset-2">
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
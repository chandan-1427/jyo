import { useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";
import { Mail, CheckCircle2 } from "lucide-react";
import { Logo } from "../components/ui/Logo";
import { Input } from "../components/ui/Input";
import { LinkButton } from "../components/ui/LinkButton";
import { Field } from "../components/auth/Field";
import { authInputStyles } from "../components/auth/authStyles";
import { BackButton } from "../components/auth/BackButton";
import { validateForm, forgotPasswordSchema } from "../lib/validation";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    setFieldErrors({});

    const validation = validateForm(forgotPasswordSchema, { email });
    if (!validation.success) {
      setFieldErrors(validation.fieldErrors);
      setLoading(false); // validation failed before the try/finally below ever runs
      return;
    }

    try {
      const data = await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify(validation.data),
      });
      setMessage(data.message);
    } catch (err: unknown) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[360px]">

          {/* Brand + back button + heading */}
          <div className="relative mb-6">
            <BackButton />

            <Logo />

            {!message && (
              <>
                <h1 className="mt-5 text-[1.4rem] font-semibold text-foreground tracking-tight">
                  Forgot your password?
                </h1>
                <p className="mt-1 text-sm text-muted">
                  Enter your email and we'll send you a reset link.
                </p>
              </>
            )}
          </div>

          {/* Success state */}
          {message ? (
            <div className="flex flex-col items-center text-center gap-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-accent/10">
                <Mail className="w-7 h-7 text-accent" />
              </div>

              <div className="flex flex-col gap-1.5">
                <h2 className="text-[1.3rem] font-semibold text-foreground tracking-tight">
                  Check your inbox
                </h2>
                <p className="text-sm text-muted leading-relaxed">{message}</p>
              </div>

              <div className="w-full rounded-lg border border-border bg-surface px-4 py-3 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-accent mt-px shrink-0" />
                <p className="text-[13px] text-subtle leading-snug text-left">
                  Didn't receive the email? Check your spam folder or try again with a different address.
                </p>
              </div>

              <LinkButton
                as="button"
                label="Try again"
                onClick={() => { setMessage(""); setEmail(""); }}
                className="w-full"
              />

              <p className="text-[13px] text-subtle">
                Remember your password?{" "}
                <Link to="/login" className="font-medium text-foreground hover:underline underline-offset-2">
                  Log in
                </Link>
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
                <Field label="Email">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className={authInputStyles}
                    required
                  />
                  {fieldErrors.email && <p className="text-xs text-red-400">{fieldErrors.email[0]}</p>}
                </Field>

                <LinkButton
                  as="button"
                  type="submit"
                  label="Send reset link"
                  loading={loading}
                  loadingLabel="Sending…"
                  disabled={loading}
                  className="w-full mt-1"
                />
              </form>

              <p className="mt-5 text-[13px] text-subtle text-center">
                Remember your password?{" "}
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
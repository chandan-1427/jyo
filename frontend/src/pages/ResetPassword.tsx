import { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { apiFetch, ApiError } from "@/lib/api";
import { CheckCircle2, XCircle } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { LinkButton } from "@/components/ui/LinkButton";
import { Field } from "@/components/auth/Field";
import { authInputStyles } from "@/components/auth/authStyles";
import { BackButton } from "@/components/auth/BackButton";
import { validateForm, resetPasswordSchema } from "@/lib/validation";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    const validation = validateForm(resetPasswordSchema, { password });
    if (!validation.success) {
      setFieldErrors(validation.fieldErrors);
      return;
    }

    setLoading(true);
    try {
      await apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, ...validation.data }),
      });
      setSuccess(true);
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
            {!success && <BackButton />}

            <Logo />

            {!success && !token && (
              <>
                <h1 className="mt-5 text-[1.4rem] font-semibold text-foreground tracking-tight">
                  Invalid link
                </h1>
                <p className="mt-1 text-sm text-muted">
                  This password reset link is invalid or has expired.
                </p>
              </>
            )}

            {!success && token && (
              <>
                <h1 className="mt-5 text-[1.4rem] font-semibold text-foreground tracking-tight">
                  Reset your password
                </h1>
                <p className="mt-1 text-sm text-muted">
                  Enter a new password for your account.
                </p>
              </>
            )}
          </div>

          {/* Invalid token state */}
          {!token && (
            <div className="flex flex-col items-center text-center gap-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-950/30">
                <XCircle className="w-7 h-7 text-red-400" />
              </div>

              <div className="flex items-start gap-2.5 w-full rounded-lg border border-red-900/40 bg-red-950/30 px-3.5 py-3">
                <span className="mt-px text-red-400 text-sm shrink-0">!</span>
                <p className="text-sm text-red-400 leading-snug text-left">
                  This reset link is invalid or has expired. Please request a new one.
                </p>
              </div>

              <LinkButton
                as="button"
                label="Request new link"
                onClick={() => navigate("/forgot-password")}
                className="w-full"
              />

              <p className="text-[13px] text-subtle">
                Remember your password?{" "}
                <Link to="/login" className="font-medium text-foreground hover:underline underline-offset-2">
                  Log in
                </Link>
              </p>
            </div>
          )}

          {/* Success state */}
          {success && (
            <div className="flex flex-col items-center text-center gap-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-accent/10">
                <CheckCircle2 className="w-7 h-7 text-accent" />
              </div>

              <div className="flex flex-col gap-1.5">
                <h2 className="text-[1.3rem] font-semibold text-foreground tracking-tight">
                  Password updated!
                </h2>
                <p className="text-sm text-muted leading-relaxed">
                  Your password has been reset successfully. You can now log in with your new password.
                </p>
              </div>

              <LinkButton
                as="button"
                label="Go to login"
                onClick={() => navigate("/login")}
                className="w-full"
              />
            </div>
          )}

          {/* Form state */}
          {token && !success && (
            <>
              {error && (
                <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-900/40 bg-red-950/30 px-3.5 py-2.5">
                  <span className="mt-px text-red-400 text-sm shrink-0">!</span>
                  <p className="text-sm text-red-400 leading-snug">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <Field label="New password">
                  <PasswordInput
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a new password"
                    autoComplete="new-password"
                    className={authInputStyles}
                    required
                  />
                  {fieldErrors.password && <p className="text-xs text-red-400">{fieldErrors.password[0]}</p>}
                </Field>

                <LinkButton
                  as="button"
                  type="submit"
                  label="Reset password"
                  loading={loading}
                  loadingLabel="Resetting…"
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
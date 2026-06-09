import { useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { Logo } from "../components/ui/Logo";
import { PasswordInput } from "../components/ui/PasswordInput";
import { LinkButton } from "../components/ui/LinkButton";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-neutral-700">{label}</label>
      {children}
    </div>
  );
}

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await apiFetch("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setSuccess(true);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white font-geist font-medium flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[360px]">

          {/* Brand + back button */}
          <div className="relative mb-6">
            {!success && (
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="cursor-pointer absolute top-0 right-0 flex items-center gap-1 text-sm font-medium text-neutral-400 hover:text-neutral-700 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
            )}

            <Logo />

            {!success && !token && (
              <>
                <h1 className="mt-5 font-geist text-[1.45rem] font-semibold text-neutral-900 tracking-tight">
                  Invalid link
                </h1>
                <p className="mt-1.5 text-sm text-neutral-500">
                  This password reset link is invalid or has expired.
                </p>
              </>
            )}

            {!success && token && (
              <>
                <h1 className="mt-5 font-geist text-[1.45rem] font-semibold text-neutral-900 tracking-tight">
                  Reset your password
                </h1>
                <p className="mt-1.5 text-sm text-neutral-500">
                  Enter a new password for your account.
                </p>
              </>
            )}
          </div>

          {/* Invalid token state */}
          {!token && (
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-50">
                <XCircle className="w-7 h-7 text-red-400" />
              </div>

              <div className="flex items-start gap-2.5 w-full rounded-lg border border-red-200 bg-red-50 px-3.5 py-3">
                <span className="mt-px text-red-500 text-sm shrink-0">!</span>
                <p className="text-sm text-red-600 leading-snug text-left">
                  This reset link is invalid or has expired. Please request a new one.
                </p>
              </div>

              <LinkButton
                as="button"
                label="Request new link"
                onClick={() => navigate("/forgot-password")}
                className="mt-1 w-full"
              />

              <div className="w-full border-t border-neutral-100" />

              <p className="text-[13px] text-neutral-500">
                Remember your password?{" "}
                <Link to="/login" className="font-medium text-neutral-900 hover:underline underline-offset-2">
                  Log in
                </Link>
              </p>
            </div>
          )}

          {/* Success state */}
          {success && (
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#2D6A4F]/10">
                <CheckCircle2 className="w-7 h-7 text-[#2D6A4F]" />
              </div>

              <div className="flex flex-col gap-1.5">
                <h2 className="font-geist text-[1.3rem] font-semibold text-neutral-900 tracking-tight">
                  Password updated!
                </h2>
                <p className="text-sm text-neutral-500 leading-relaxed">
                  Your password has been reset successfully. You can now log in with your new password.
                </p>
              </div>

              <LinkButton
                as="button"
                label="Go to login"
                onClick={() => navigate("/login")}
                className="mt-1 w-full"
              />
            </div>
          )}

          {/* Form state */}
          {token && !success && (
            <>
              {error && (
                <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3">
                  <span className="mt-px text-red-500 text-sm shrink-0">!</span>
                  <p className="text-sm text-red-600 leading-snug">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Field label="New password">
                  <PasswordInput
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a new password"
                    autoComplete="new-password"
                    required
                  />
                </Field>

                <LinkButton
                  as="button"
                  type="submit"
                  label="Reset password"
                  loading={loading}
                  loadingLabel="Resetting…"
                  disabled={loading}
                  className="mt-1 w-full"
                />
              </form>

              <div className="my-3 border-t border-neutral-100" />

              <p className="text-[13px] text-neutral-500 text-center">
                Remember your password?{" "}
                <Link to="/login" className="font-medium text-neutral-900 hover:underline underline-offset-2">
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
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch, ApiError } from "../lib/api";
import { ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { Logo } from "../components/ui/Logo";
import { Input } from "../components/ui/Input";
import { LinkButton } from "../components/ui/LinkButton";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-neutral-700">{label}</label>
      {children}
    </div>
  );
}

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const data = await apiFetch("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMessage(data.message);
    } catch (err: unknown) {
      if (err instanceof ApiError) setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen   font-medium flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[360px]">

          {/* Brand + back button */}
          <div className="relative mb-6">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="cursor-pointer absolute top-0 right-0 flex items-center gap-1 text-sm font-medium text-neutral-400 hover:text-neutral-700 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>

            <Logo />

            {!message && (
              <>
                <h1 className="mt-5  text-[1.45rem] font-semibold text-neutral-900 tracking-tight">
                  Forgot your password?
                </h1>
                <p className="mt-1.5 text-sm text-neutral-500">
                  Enter your email and we'll send you a reset link.
                </p>
              </>
            )}
          </div>

          {/* Success state */}
          {message ? (
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#2D6A4F]/10">
                <Mail className="w-7 h-7 text-[#2D6A4F]" />
              </div>

              <div className="flex flex-col gap-1.5">
                <h2 className=" text-[1.3rem] font-semibold text-neutral-900 tracking-tight">
                  Check your inbox
                </h2>
                <p className="text-sm text-neutral-500 leading-relaxed">{message}</p>
              </div>

              <div className="w-full rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-3 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#2D6A4F] mt-px shrink-0" />
                <p className="text-[13px] text-neutral-600 leading-snug text-left">
                  Didn't receive the email? Check your spam folder or try again with a different address.
                </p>
              </div>

              <LinkButton
                as="button"
                label="Try again"
                onClick={() => { setMessage(""); setEmail(""); }}
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
          ) : (
            <>
              {error && (
                <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3">
                  <span className="mt-px text-red-500 text-sm shrink-0">!</span>
                  <p className="text-sm text-red-600 leading-snug">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Field label="Email">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </Field>

                <LinkButton
                  as="button"
                  type="submit"
                  label="Send reset link"
                  loading={loading}
                  loadingLabel="Sending…"
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
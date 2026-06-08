import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";
import { LinkButton } from "../components/ui/LinkButton";
import { PasswordInput } from "../components/ui/PasswordInput";
import { Input } from "../components/ui/Input";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-neutral-700">{label}</label>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNeedsVerification(false);
    setResendMessage("");
    setLoading(true);

    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      login(data.user);
      navigate("/feed");
    } catch (err: unknown) {
      if (err instanceof Error) {
        // Check if it's an unverified email error
        if (err.message.includes("verify your email")) {
          setNeedsVerification(true);
        } else {
          setError(err.message);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendLoading(true);
    setResendMessage("");

    try {
      const data = await apiFetch("/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setResendMessage(data.message);
    } catch (err: unknown) {
      if (err instanceof Error) setResendMessage(err.message);
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white font-geist font-medium flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[360px]">

          {/* Brand + back button */}
          <div className="relative mb-8">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="cursor-pointer absolute top-0 right-0 flex items-center gap-1 text-sm font-medium text-neutral-400 hover:text-neutral-700 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>

            <Link
              to="/"
              className="font-geist font-semibold text-[1.1rem] text-neutral-900 tracking-tight"
            >
              Jyo<span className="text-[#2D6A4F]">.</span>
            </Link>
            <h1 className="mt-5 font-geist text-[1.45rem] font-semibold text-neutral-900 tracking-tight">
              Welcome back
            </h1>
            <p className="mt-1.5 text-sm text-neutral-500">
              Log in to your Jyo account to continue.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3">
              <span className="mt-px text-red-500 text-sm shrink-0">!</span>
              <p className="text-sm text-red-600 leading-snug">{error}</p>
            </div>
          )}

          {/* Unverified email state */}
          {needsVerification && (
            <div className="mt-[-15px] mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col gap-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-px" />
                <p className="text-sm text-amber-800 leading-snug">
                  Your email is not verified. Please check your inbox for the verification link.
                </p>
              </div>

              {resendMessage ? (
                <div className="flex items-center gap-1.5 pl-6">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#2D6A4F] shrink-0" />
                  <p className="text-sm text-[#2D6A4F] font-medium">{resendMessage}</p>
                </div>
              ) : (
                <button
                  onClick={handleResendVerification}
                  disabled={resendLoading}
                  className="cursor-pointer ml-6 w-fit flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100 hover:text-amber-900 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {resendLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Mail className="w-3.5 h-3.5" />
                      Resend verification email
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Form */}
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

            <Field label="Password">
              <PasswordInput
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                required
              />
            </Field>

            <LinkButton
              as="button"
              type="submit"
              label="Log in"
              loading={loading}
              loadingLabel="Logging in…"
              disabled={loading}
            />

          </form>

          {/* Divider */}
          <div className="my-3 border-t border-neutral-100" />

          {/* Footer */}
          <p className="text-[13px] text-neutral-500 text-center">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="font-medium text-neutral-900 tracking-wide hover:underline underline-offset-2"
            >
              Register
            </Link>
          </p>

          <p className="text-[13px] text-neutral-500 text-center mt-3">
            <Link to="/forgot-password" className="font-medium text-neutral-900 hover:underline underline-offset-2 tracking-wide">
              Forgot password?
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, Mail } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, ApiError } from "@/lib/api/api";
import { LinkButton } from "@/components/ui/LinkButton";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Input } from "@/components/ui/Input";
import { Logo } from "@/components/ui/Logo";
import { AuthSidePanel } from "@/components/auth/AuthSidePanel";
import { Field } from "@/components/ui/Field";
import { AUTH_BENEFITS } from "@/components/auth/authStyles";
import { BackButton } from "@/components/auth/BackButton";
import { validateForm, loginSchema } from "@/lib/validation";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});

  const loginMutation = useMutation({
    mutationFn: (payload: { email: string; password: string }) =>
      apiFetch("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: (data) => {
      login(data.user);
      navigate("/feed");
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        if (err.message.includes("verify your email")) {
          setNeedsVerification(true);
        } else {
          setError(err.message);
        }
      }
    },
  });

  const resendMutation = useMutation({
    mutationFn: (email: string) =>
      apiFetch("/auth/resend-verification", { method: "POST", body: JSON.stringify({ email }) }),
    onSuccess: (data) => setResendMessage(data.message),
    onError: (err: unknown) => {
      if (err instanceof ApiError) setResendMessage(err.message);
    },
  });

  const loading = loginMutation.isPending;
  const resendLoading = resendMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    setNeedsVerification(false);
    setResendMessage("");

    const validation = validateForm(loginSchema, { email, password });
    if (!validation.success) {
      setFieldErrors(validation.fieldErrors);
      return;
    }

    loginMutation.mutate(validation.data);
  };

  const handleResendVerification = () => {
    setResendMessage("");
    resendMutation.mutate(email);
  };

  return (
    <div className="h-screen grid lg:grid-cols-2">

      <AuthSidePanel
        headline="Good food shouldn't go to waste while someone nearby needs it."
        subtext="Log back in to keep sharing with your community in Tirupati."
        benefits={AUTH_BENEFITS}
      />

      {/* Right — form */}
      <div className="flex flex-col justify-center px-6 py-8 sm:px-12">
        <div className="w-full max-w-[360px] mx-auto">

          <div className="relative mb-6">
            <BackButton />

            <div className="lg:hidden mb-5">
              <Logo />
            </div>

            <h1 className="text-[1.4rem] font-semibold text-foreground tracking-tight">
              Welcome back
            </h1>
            <p className="mt-1 text-sm text-muted">Log in to your Jyo account to continue.</p>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-red-900/40 bg-red-950/30 px-3.5 py-3">
              <span className="mt-px text-red-400 text-sm shrink-0">!</span>
              <p className="text-sm text-red-400 leading-snug">{error}</p>
            </div>
          )}

          {needsVerification && (
            <div className="mb-4 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 flex flex-col gap-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-px" />
                <p className="text-sm text-warning leading-snug">
                  Your email is not verified. Please check your inbox for the verification link.
                </p>
              </div>

              {resendMessage ? (
                <div className="flex items-center gap-1.5 pl-6">
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />
                  <p className="text-sm text-accent font-medium">{resendMessage}</p>
                </div>
              ) : (
                <button
                  onClick={handleResendVerification}
                  disabled={resendLoading}
                  className="cursor-pointer ml-6 w-fit flex items-center gap-1.5 rounded-md border border-warning/40 bg-transparent px-3 py-1.5 text-sm font-medium text-warning hover:bg-warning/10 hover:text-foreground transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
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

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">

            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
              {fieldErrors.email && <p className="text-xs text-red-400">{fieldErrors.email[0]}</p>}
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
              {fieldErrors.password && <p className="text-xs text-red-400">{fieldErrors.password[0]}</p>}
            </Field>

            <LinkButton
              as="button"
              type="submit"
              label="Log in"
              loading={loading}
              loadingLabel="Logging in…"
              disabled={loading}
              className="w-full mt-1"
            />

          </form>

          <p className="mt-5 text-[13px] text-subtle text-center">
            Don't have an account?{" "}
            <Link to="/register" className="font-medium text-foreground tracking-wide hover:underline underline-offset-2">
              Register
            </Link>
          </p>

          <p className="text-[13px] text-subtle text-center mt-3">
            <Link to="/forgot-password" className="font-medium text-foreground hover:underline underline-offset-2 tracking-wide">
              Forgot password?
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}
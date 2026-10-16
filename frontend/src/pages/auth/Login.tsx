import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, ApiError } from "@/lib/api/api";
import { validateForm, loginSchema } from "@/lib/validation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { TextField } from "@/components/ui/TextField";
import { TextLink } from "@/components/ui/TextLink";

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
    <AuthLayout
      title="Log in"
      description="Welcome back. Log in to share or find food."
      switchTo={{ label: "Sign up", to: "/register" }}
      footer={<>New to Jyo? <TextLink to="/register">Sign up</TextLink></>}
    >
      {error && <Notice tone="error" className="mb-5">{error}</Notice>}

      {needsVerification && (
        <Notice
          className="mb-5"
          action={
            resendMessage ? (
              <p className="font-medium text-leaf">{resendMessage}</p>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleResendVerification}
                loading={resendMutation.isPending}
                className="w-fit"
              >
                {resendMutation.isPending ? "Sending…" : "Send the link again"}
              </Button>
            )
          }
        >
          Your email is not verified yet. Open the link we sent to your email.
        </Notice>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
          error={fieldErrors.email?.[0]}
        />

        <TextField
          label="Password"
          type="password"
          name="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Your password"
          autoComplete="current-password"
          required
          error={fieldErrors.password?.[0]}
          labelAside={
            <TextLink to="/forgot-password" className="text-sm text-fg-muted hover:text-fg">
              Forgot password?
            </TextLink>
          }
        />

        <Button type="submit" size="lg" fullWidth loading={loading} className="mt-1">
          {loading ? "Logging in…" : "Log in"}
        </Button>
      </form>
    </AuthLayout>
  );
}

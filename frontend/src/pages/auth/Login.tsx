import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, ApiError } from "@/lib/api/api";
import { loginSchema } from "@/lib/validation";
import { applyServerFieldErrors, useZodForm } from "@/lib/forms";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { TextField } from "@/components/ui/TextField";
import { TextLink } from "@/components/ui/TextLink";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const { register, handleSubmit, getValues, setError, formState: { errors } } = useZodForm(loginSchema, {
    email: "",
    password: "",
  });

  const [error, setErrorMessage] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  const loginMutation = useMutation({
    mutationFn: (payload: { email: string; password: string }) =>
      apiFetch("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: (data) => {
      login(data.user);
      navigate("/feed");
    },
    onError: (err: unknown) => {
      if (!(err instanceof ApiError)) return;
      if (err.message.includes("verify your email")) {
        setNeedsVerification(true);
      } else if (!applyServerFieldErrors(err, setError, ["email", "password"])) {
        setErrorMessage(err.message);
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

  const onSubmit = handleSubmit((values) => {
    setErrorMessage("");
    setNeedsVerification(false);
    setResendMessage("");
    loginMutation.mutate(values);
  });

  const handleResendVerification = () => {
    setResendMessage("");
    resendMutation.mutate(getValues("email").trim().toLowerCase());
  };

  return (
    <AuthLayout
      title="Log in"
      description="Welcome back. Log in to share or find food."
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

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <TextField
          label="Email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />

        <TextField
          label="Password"
          type="password"
          placeholder="Your password"
          autoComplete="current-password"
          error={errors.password?.message}
          labelAside={
            <TextLink to="/forgot-password" className="text-sm text-fg-muted hover:text-fg">
              Forgot password?
            </TextLink>
          }
          {...register("password")}
        />

        <Button type="submit" size="lg" fullWidth loading={loading} className="mt-1">
          {loading ? "Logging in…" : "Log in"}
        </Button>
      </form>
    </AuthLayout>
  );
}

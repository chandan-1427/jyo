import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api/api";
import { forgotPasswordSchema } from "@/lib/validation";
import { applyServerFieldErrors, useZodForm } from "@/lib/forms";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { TextField } from "@/components/ui/TextField";
import { TextLink, textLinkClass } from "@/components/ui/TextLink";

export default function ForgotPassword() {
  const { register, handleSubmit, reset, setError, formState: { errors } } = useZodForm(forgotPasswordSchema, {
    email: "",
  });

  const [message, setMessage] = useState("");
  const [error, setErrorMessage] = useState("");

  const forgotMutation = useMutation({
    mutationFn: (payload: { email: string }) =>
      apiFetch("/auth/forgot-password", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: (data) => setMessage(data.message),
    onError: (err: unknown) => {
      if (!(err instanceof ApiError)) return;
      if (!applyServerFieldErrors(err, setError, ["email"])) setErrorMessage(err.message);
    },
  });

  const loading = forgotMutation.isPending;

  const onSubmit = handleSubmit((values) => {
    setErrorMessage("");
    setMessage("");
    forgotMutation.mutate(values);
  });

  const tryAgain = () => {
    setMessage("");
    reset({ email: "" });
    forgotMutation.reset();
  };

  if (message) {
    return (
      <AuthLayout
        icon={<Mail className="size-6" aria-hidden="true" />}
        title="Check your email"
        description={message}
        footer={
          <>
            Used the wrong email?{" "}
            <button type="button" onClick={tryAgain} className={textLinkClass}>
              Try again
            </button>
          </>
        }
      >
        <Notice>No email? Check your spam folder.</Notice>
        <Button to="/login" size="lg" fullWidth className="mt-5">
          Back to log in
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      description="Enter your email. We will send you a link to make a new password."
      footer={<>Remember your password? <TextLink to="/login">Log in</TextLink></>}
    >
      {error && <Notice tone="error" className="mb-5">{error}</Notice>}

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <TextField
          label="Email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />

        <Button type="submit" size="lg" fullWidth loading={loading} className="mt-1">
          {loading ? "Sending…" : "Send link"}
        </Button>
      </form>
    </AuthLayout>
  );
}

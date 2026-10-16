import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api/api";
import { registerSchema } from "@/lib/validation";
import { applyServerFieldErrors, useZodForm } from "@/lib/forms";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { TextField } from "@/components/ui/TextField";
import { TextLink, textLinkClass } from "@/components/ui/TextLink";

function allowOnlyDigits(e: React.KeyboardEvent<HTMLInputElement>) {
  const allowed = ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End"];
  if (!allowed.includes(e.key) && !/^\d$/.test(e.key)) e.preventDefault();
}

const EMPTY_FORM = { name: "", email: "", phone: "", password: "" };

export default function Register() {
  const { register, handleSubmit, reset, setError, formState: { errors } } = useZodForm(registerSchema, EMPTY_FORM);

  const [error, setErrorMessage] = useState("");
  // The email the link was sent to, shown on the "Check your email" screen.
  const [sentTo, setSentTo] = useState("");

  const registerMutation = useMutation({
    mutationFn: (payload: typeof EMPTY_FORM) =>
      apiFetch("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: (_data, payload) => setSentTo(payload.email),
    onError: (err: unknown) => {
      if (!(err instanceof ApiError)) return;
      if (!applyServerFieldErrors(err, setError, ["name", "email", "phone", "password"])) {
        setErrorMessage(err.message);
      }
    },
  });

  const loading = registerMutation.isPending;

  const onSubmit = handleSubmit((values) => {
    setErrorMessage("");
    registerMutation.mutate(values);
  });

  const startOver = () => {
    setSentTo("");
    setErrorMessage("");
    reset(EMPTY_FORM);
    registerMutation.reset();
  };

  if (sentTo) {
    return (
      <AuthLayout
        icon={<Mail className="size-6" aria-hidden="true" />}
        title="Check your email"
        description={
          <>
            We sent a link to <span className="font-medium text-fg">{sentTo}</span>. Open it to
            verify your email, then log in.
          </>
        }
        footer={
          <>
            Wrong email?{" "}
            <button type="button" onClick={startOver} className={textLinkClass}>
              Sign up again
            </button>
          </>
        }
      >
        <Notice>No email? Check your spam folder.</Notice>
        <Button to="/login" size="lg" fullWidth className="mt-5">
          Go to log in
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      description="It's free to join."
      switchTo={{ label: "Log in", to: "/login" }}
      footer={<>Have an account? <TextLink to="/login">Log in</TextLink></>}
    >
      {error && <Notice tone="error" className="mb-5">{error}</Notice>}

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <TextField
          label="Full name"
          placeholder="Your full name"
          autoComplete="name"
          error={errors.name?.message}
          {...register("name")}
        />

        <TextField
          label="Email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />

        <TextField
          label="Phone number"
          type="tel"
          inputMode="numeric"
          maxLength={10}
          placeholder="10-digit mobile number"
          autoComplete="tel"
          onKeyDown={allowOnlyDigits}
          error={errors.phone?.message}
          {...register("phone")}
        />

        <TextField
          label="Password"
          type="password"
          placeholder="Make a password"
          autoComplete="new-password"
          hint="At least 8 characters."
          error={errors.password?.message}
          {...register("password")}
        />

        <Button type="submit" size="lg" fullWidth loading={loading} className="mt-1">
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  );
}

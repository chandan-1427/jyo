import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api/api";
import { validateForm, registerSchema } from "@/lib/validation";
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
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [registered, setRegistered] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});

  const registerMutation = useMutation({
    mutationFn: (payload: typeof form) =>
      apiFetch("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => setRegistered(true),
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        setError(err.message);
        if (err.details) setFieldErrors(err.details);
      }
    },
  });

  const loading = registerMutation.isPending;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    const validation = validateForm(registerSchema, form);
    if (!validation.success) {
      setFieldErrors(validation.fieldErrors);
      return; // stop here — no network request for input that's already known-invalid
    }

    registerMutation.mutate(validation.data);
  };

  const startOver = () => {
    setRegistered(false);
    setForm(EMPTY_FORM);
    setError("");
    registerMutation.reset();
  };

  if (registered) {
    return (
      <AuthLayout
        icon={<Mail className="size-6" aria-hidden="true" />}
        title="Check your email"
        description={
          <>
            We sent a link to <span className="font-medium text-fg">{form.email}</span>. Open it to
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

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <TextField
          label="Full name"
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="Your full name"
          autoComplete="name"
          required
          error={fieldErrors.name?.[0]}
        />

        <TextField
          label="Email"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          placeholder="you@example.com"
          autoComplete="email"
          required
          error={fieldErrors.email?.[0]}
        />

        <TextField
          label="Phone number"
          name="phone"
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          value={form.phone}
          onChange={handleChange}
          onKeyDown={allowOnlyDigits}
          placeholder="10-digit mobile number"
          autoComplete="tel"
          required
          error={fieldErrors.phone?.[0]}
        />

        <TextField
          label="Password"
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          placeholder="Make a password"
          autoComplete="new-password"
          required
          hint="At least 8 characters."
          error={fieldErrors.password?.[0]}
        />

        <Button type="submit" size="lg" fullWidth loading={loading} className="mt-1">
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  );
}

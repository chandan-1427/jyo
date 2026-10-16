import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, XCircle } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api/api";
import { resetPasswordSchema } from "@/lib/validation";
import { applyServerFieldErrors, useZodForm } from "@/lib/forms";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { TextField } from "@/components/ui/TextField";
import { TextLink } from "@/components/ui/TextLink";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const { register, handleSubmit, setError, formState: { errors } } = useZodForm(resetPasswordSchema, {
    password: "",
  });

  const [error, setErrorMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const resetMutation = useMutation({
    mutationFn: (payload: { token: string; password: string }) =>
      apiFetch("/auth/reset-password", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => setSuccess(true),
    onError: (err: unknown) => {
      if (!(err instanceof ApiError)) return;
      if (!applyServerFieldErrors(err, setError, ["password"])) setErrorMessage(err.message);
    },
  });

  const loading = resetMutation.isPending;

  const onSubmit = handleSubmit((values) => {
    setErrorMessage("");
    resetMutation.mutate({ token, ...values });
  });

  if (!token) {
    return (
      <AuthLayout
        icon={<XCircle className="size-6" aria-hidden="true" />}
        iconTone="danger"
        title="This link does not work"
        description="The link is wrong or too old. Ask for a new one."
        footer={<>Remember your password? <TextLink to="/login">Log in</TextLink></>}
      >
        <Button to="/forgot-password" size="lg" fullWidth>
          Get a new link
        </Button>
      </AuthLayout>
    );
  }

  if (success) {
    return (
      <AuthLayout
        icon={<CheckCircle2 className="size-6" aria-hidden="true" />}
        title="Password changed"
        description="You can now log in with your new password."
      >
        <Button to="/login" size="lg" fullWidth>
          Log in
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Make a new password"
      description="Choose a new password for your account."
      footer={<>Remember your password? <TextLink to="/login">Log in</TextLink></>}
    >
      {error && <Notice tone="error" className="mb-5">{error}</Notice>}

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <TextField
          label="New password"
          type="password"
          placeholder="Make a new password"
          autoComplete="new-password"
          hint="At least 8 characters."
          error={errors.password?.message}
          {...register("password")}
        />

        <Button type="submit" size="lg" fullWidth loading={loading} className="mt-1">
          {loading ? "Saving…" : "Save new password"}
        </Button>
      </form>
    </AuthLayout>
  );
}

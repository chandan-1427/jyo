import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { apiFetch } from "@/lib/api/api";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { TextLink } from "@/components/ui/TextLink";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const { data, isPending, error } = useQuery({
    queryKey: ["auth", "verify-email", token],
    queryFn: () => apiFetch(`/auth/verify-email?token=${token}`),
    enabled: !!token,
    retry: false,
  });

  const status = !token ? "error" : isPending ? "loading" : error ? "error" : "success";
  const message = !token
    ? "This verification link is not complete."
    : error
      ? (error instanceof Error ? error.message : "Verification failed.")
      : data?.message;

  if (status === "loading") {
    return (
      <AuthLayout
        icon={<Loader2 className="size-6 animate-spin" aria-hidden="true" />}
        iconTone="muted"
        title="Checking your link"
        description="Please wait a moment."
      />
    );
  }

  if (status === "success") {
    return (
      <AuthLayout
        icon={<CheckCircle2 className="size-6" aria-hidden="true" />}
        title="Email verified"
        description={message || "Your account is ready. You can log in now."}
      >
        <Button to="/login" size="lg" fullWidth>
          Log in
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={<XCircle className="size-6" aria-hidden="true" />}
      iconTone="danger"
      title="We could not verify your email"
      description={message || "The link may be too old, or already used."}
      footer={<>Already verified? <TextLink to="/login">Log in</TextLink></>}
    >
      <Notice>Verification links work for 24 hours. Sign up again to get a new link.</Notice>
      <Button to="/register" size="lg" fullWidth className="mt-5">
        Sign up again
      </Button>
    </AuthLayout>
  );
}

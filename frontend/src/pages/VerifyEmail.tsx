import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { Link } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2, Mail } from "lucide-react";
import { Logo } from "../components/ui/Logo";
import { LinkButton } from "../components/ui/LinkButton";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setMessage("Invalid verification link.");
      return;
    }

    apiFetch(`/auth/verify-email?token=${token}`)
      .then((data) => {
        setStatus("success");
        setMessage(data.message);
      })
      .catch((err: unknown) => {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Verification failed.");
      });
  }, []);

  return (
    <div className="min-h-screen bg-white font-medium flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[360px]">

          {/* Brand */}
          <div className="mb-8">
            <Logo />
          </div>

          {/* Loading */}
          {status === "loading" && (
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-neutral-100">
                <Loader2 className="w-7 h-7 text-neutral-400 animate-spin" />
              </div>
              <div className="flex flex-col gap-1">
                <h1 className=" text-[1.45rem] font-semibold text-neutral-900 tracking-tight">
                  Verifying your email
                </h1>
                <p className="text-sm text-neutral-500">
                  Please wait while we confirm your address…
                </p>
              </div>
            </div>
          )}

          {/* Success */}
          {status === "success" && (
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#2D6A4F]/10">
                <CheckCircle2 className="w-7 h-7 text-[#2D6A4F]" />
              </div>

              <div className="flex flex-col gap-1.5">
                <h1 className=" text-[1.45rem] font-semibold text-neutral-900 tracking-tight">
                  Email verified!
                </h1>
                <p className="text-sm text-neutral-500 leading-relaxed">
                  {message || "Your email has been successfully verified. You can now log in to your account."}
                </p>
              </div>

              <div className="w-full rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-3 flex items-start gap-2.5">
                <Mail className="w-4 h-4 text-[#2D6A4F] mt-px shrink-0" />
                <p className="text-[13px] text-neutral-600 leading-snug text-left">
                  Your account is now active and ready to use. Welcome to the Jyo community!
                </p>
              </div>

              <LinkButton as="link" to="/login" label="Go to Login"/>
            </div>
          )}

          {/* Error */}
          {status === "error" && (
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-50">
                <XCircle className="w-7 h-7 text-red-400" />
              </div>

              <div className="flex flex-col gap-1.5">
                <h1 className=" text-[1.45rem] font-semibold text-neutral-900 tracking-tight">
                  Verification failed
                </h1>
                <p className="text-sm text-neutral-500 leading-relaxed">
                  {message || "We couldn't verify your email. The link may have expired or already been used."}
                </p>
              </div>

              <div className="flex items-start gap-2.5 w-full rounded-lg border border-red-200 bg-red-50 px-3.5 py-3">
                <span className="mt-px text-red-500 text-sm shrink-0">!</span>
                <p className="text-sm text-red-600 leading-snug text-left">
                  Verification links expire after 24 hours. Try registering again to get a new link.
                </p>
              </div>

              <LinkButton as="link" to="/register" label="Register Again" className="w-full"/>

              <div className="w-full border-t border-neutral-100" />

              <p className="text-[13px] text-neutral-500">
                Already verified?{" "}
                <Link
                  to="/login"
                  className="font-medium text-neutral-900 hover:underline underline-offset-2"
                >
                  Log in
                </Link>
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { ArrowLeft, Mail, CheckCircle2 } from "lucide-react";
import { LinkButton } from "../components/ui/LinkButton";
import { PasswordInput } from "../components/ui/PasswordInput";
import { Input } from "../components/ui/Input";
import { Logo } from "../components/ui/Logo";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-neutral-700">{label}</label>
      {children}
    </div>
  );
}

function allowOnlyDigits(e: React.KeyboardEvent<HTMLInputElement>) {
  const allowed = ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End"];
  if (!allowed.includes(e.key) && !/^\d$/.test(e.key)) e.preventDefault();
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiFetch("/auth/register", { method: "POST", body: JSON.stringify(form) });
      setRegistered(true); // ← show success state instead of navigating immediately
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen font-medium flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[360px]">

          {/* Brand + back button */}
          <div className="relative mb-6">
            {!registered && (
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="cursor-pointer absolute top-0 right-0 flex items-center gap-1 text-sm font-medium text-neutral-400 hover:text-neutral-700 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>
            )}

            <Logo />

            {!registered && (
              <>
                <h1 className="mt-5  text-[1.45rem] font-semibold text-neutral-900 tracking-tight">
                  Create your account
                </h1>
                <p className="mt-1.5 text-sm text-neutral-500">
                  Join Jyo and start sharing food with your community.
                </p>
              </>
            )}
          </div>

          {/* ── Success state ── */}
          {registered ? (
            <div className="flex flex-col items-center text-center gap-4 py-4">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[#2D6A4F]/10">
                <Mail className="w-7 h-7 text-[#2D6A4F]" />
              </div>

              <div className="flex flex-col gap-1.5">
                <h2 className=" text-[1.3rem] font-semibold text-neutral-900 tracking-tight">
                  Check your inbox
                </h2>
                <p className="text-sm text-neutral-500 leading-relaxed">
                  We've sent a verification link to{" "}
                  <span className="font-medium text-neutral-700">{form.email}</span>.
                  Please verify your email before logging in.
                </p>
              </div>

              <div className="w-full rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-3 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#2D6A4F] mt-px shrink-0" />
                <p className="text-[13px] text-neutral-600 leading-snug text-left">
                  Didn't receive the email? Check your spam folder or try registering again with a different address.
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate("/login")}
                className="cursor-pointer mt-1 w-full rounded-lg bg-neutral-900 hover:bg-neutral-700 text-white py-2.5 text-sm font-medium transition-colors duration-150"
              >
                Go to login
              </button>

              <div className="w-full border-t border-neutral-100" />

              <p className="text-[13px] text-neutral-500">
                Wrong email?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setRegistered(false);
                    setForm({ name: "", email: "", phone: "", password: "" });
                    setError("");
                  }}
                  className="font-medium text-neutral-900 hover:underline underline-offset-2"
                >
                  Register again
                </button>
              </p>
            </div>
          ) : (
            /* ── Registration form ── */
            <>
              {/* Error */}
              {error && (
                <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3">
                  <span className="mt-px text-red-500 text-sm shrink-0">!</span>
                  <p className="text-sm text-red-600 leading-snug">{error}</p>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">

                <Field label="Full name">
                  <Input
                    name="name"
                    type="text"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Your full name"
                    autoComplete="name"
                    required
                  />
                </Field>

                <Field label="Email">
                  <Input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </Field>

                <Field label="Phone number">
                  <Input
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
                  />
                </Field>

                <Field label="Password">
                  <PasswordInput
                    name="password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Create a password"
                    autoComplete="new-password"
                    required
                  />
                </Field>

                <LinkButton
                  as="button"
                  type="submit"
                  label="Create account"
                  loading={loading}
                  loadingLabel="Creating account…"
                  disabled={loading}
                />

              </form>

              {/* Divider */}
              <div className="my-3 border-t border-neutral-100" />

              {/* Footer */}
              <p className="text-[13px] text-neutral-500 text-center">
                Already have an account?{" "}
                <Link
                  to="/login"
                  className="font-medium text-neutral-900 hover:underline underline-offset-2"
                >
                  Log in
                </Link>
              </p>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

// ── Module level ──────────────────────────────────────────────────────────────

const inputClass = [
  "w-full rounded-lg border border-neutral-200 bg-neutral-50",
  "px-3.5 py-2.5 text-sm text-neutral-900",
  "placeholder:text-neutral-400",
  "outline-none",
  "transition-[border-color,background-color,box-shadow] duration-200 ease-in-out",
  "focus:border-neutral-300 focus:bg-white focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)]",
].join(" ");

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-neutral-700">{label}</label>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      login(data.user);
      navigate("/feed");
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white font-work flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-[360px]">

          {/* Brand + back button */}
          <div className="relative mb-8">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="cursor-pointer absolute top-0 right-0 flex items-center gap-1 text-sm font-medium text-neutral-400 hover:text-neutral-700 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>

            <Link
              to="/"
              className="font-geist font-semibold text-[1.1rem] text-neutral-900 tracking-tight"
            >
              Jyo<span className="text-[#2D6A4F]">.</span>
            </Link>
            <h1 className="mt-5 font-geist text-[1.45rem] font-semibold text-neutral-900 tracking-tight">
              Welcome back
            </h1>
            <p className="mt-1.5 text-sm text-neutral-500">
              Log in to your Jyo account to continue.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3">
              <span className="mt-px text-red-500 text-sm shrink-0">!</span>
              <p className="text-sm text-red-600 leading-snug">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
                className={inputClass}
              />
            </Field>

            <Field label="Password">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className={`${inputClass} pr-16`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-medium text-neutral-400 hover:text-neutral-700 transition-colors select-none"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </Field>

            <button
              type="submit"
              disabled={loading}
              className="cursor-pointer mt-1 w-full rounded-lg bg-neutral-900 hover:bg-neutral-700 text-white py-2.5 text-sm font-medium transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Logging in…" : "Log in"}
            </button>

          </form>

          {/* Divider */}
          <div className="my-3 border-t border-neutral-100" />

          {/* Footer */}
          <p className="text-[13px] text-neutral-500 text-center">
            Don't have an account?{" "}
            <Link
              to="/register"
              className="font-medium text-neutral-900 hover:underline underline-offset-2"
            >
              Register
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}
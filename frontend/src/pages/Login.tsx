import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

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
    <div className="min-h-screen bg-orange-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl p-8 shadow-sm">

        {/* Header */}
        <h1 className="text-2xl font-bold text-gray-800">Welcome back</h1>
        <p className="text-sm text-gray-400 mt-1">Login to your Jyos account</p>

        {/* Error */}
        {error && (
          <p className="mt-4 text-sm text-red-500 bg-red-50 px-4 py-2 rounded-lg">
            {error}
          </p>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-600">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400 transition"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-600">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-orange-400 transition pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-orange-400 transition"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="bg-orange-500 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        {/* Footer */}
        <p className="text-sm text-gray-400 text-center mt-6">
          Don't have an account?{" "}
          <Link to="/register" className="text-orange-500 font-medium hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
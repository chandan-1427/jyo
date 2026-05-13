import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { apiFetch } from "../lib/api";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
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
    <div className="min-h-screen bg-orange-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-sm text-center">
        <h1 className="text-xl font-bold text-gray-800 mb-3">Email Verification</h1>
        {status === "loading" && <p className="text-gray-400 text-sm">Verifying...</p>}
        {status === "success" && (
          <>
            <p className="text-green-600 text-sm mb-4">{message}</p>
            <button
              onClick={() => navigate("/login")}
              className="bg-orange-500 text-white rounded-xl px-6 py-2.5 text-sm font-semibold hover:bg-orange-600 transition"
            >
              Go to Login
            </button>
          </>
        )}
        {status === "error" && (
          <p className="text-red-500 text-sm">{message}</p>
        )}
      </div>
    </div>
  );
}
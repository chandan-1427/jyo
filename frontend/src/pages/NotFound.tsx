import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function NotFound() {
  const { user, loading } = useAuth();

  if (loading) return null;

  const destination = user ? "/feed" : "/";
  const label = user ? "Back to Feed" : "Back to Home";
  
  return (
    <div className="min-h-screen bg-white font-geist font-medium tracking-wide flex flex-col items-center justify-center gap-1">
      <div className="flex flex-col items-center gap-1">
        <h1 className="font-geist font-semibold text-2xl text-neutral-900 tracking-tight">
          Jyo<span className="text-[#2D6A4F]">.</span>
        </h1>

        <p className="text-6xl font-geist font-semibold leading-none text-neutral-800 tracking-tight">
          404
        </p>
      </div>

      <div className="flex flex-col items-center gap-1.5 text-center">
        <p className="text-base font-medium text-neutral-700">Page not found</p>
        <p className="text-sm text-neutral-400">
          The page you're looking for doesn't exist or has been moved.
        </p>
      </div>

      <Link
        to={destination}
        className="text-sm font-medium text-neutral-900 underline underline-offset-2 hover:text-neutral-500 transition-colors"
      >
        {label}
      </Link>
    </div>
  );
}
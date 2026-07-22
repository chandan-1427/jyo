import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Logo } from "../components/ui/Logo";

export default function NotFound() {
  const { user, loading } = useAuth();

  if (loading) return null;

  const destination = user ? "/feed" : "/";
  const label = user ? "Back to Feed" : "Back to Home";

  return (
    <div className="min-h-screen font-medium tracking-wide flex flex-col items-center justify-center gap-1">
      <div className="flex flex-col items-center gap-1">
        <Logo />

        <p className="text-6xl font-semibold leading-none text-foreground tracking-tight">
          404
        </p>
      </div>

      <div className="flex flex-col items-center gap-1.5 text-center">
        <p className="text-base font-medium text-muted">Page not found</p>
        <p className="text-sm text-subtle">
          The page you're looking for doesn't exist or has been moved.
        </p>
      </div>

      <Link
        to={destination}
        className="text-sm font-medium text-foreground underline underline-offset-2 hover:text-muted transition-colors"
      >
        {label}
      </Link>
    </div>
  );
}
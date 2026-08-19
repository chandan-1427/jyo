import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

// Logout lives in one place (the profile page) but owns real behaviour —
// an in-flight guard so a double-click can't fire two logout requests, and
// the redirect home afterwards. Kept as its own component so that behaviour
// travels with the button if it's ever surfaced somewhere else, instead of
// being re-implemented per call site (which is what the Navbar was doing,
// once for desktop and again for mobile).
export function LogoutButton({ className = "" }: { className?: string }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
      navigate("/");
    } catch {
      setLoggingOut(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loggingOut}
      className={`cursor-pointer w-full flex items-center justify-center gap-1.5 text-sm font-medium text-red-400 hover:text-red-300 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
    >
      {loggingOut ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Logging out…
        </>
      ) : (
        <>
          <LogOut className="w-3.5 h-3.5" />
          Logout
        </>
      )}
    </button>
  );
}

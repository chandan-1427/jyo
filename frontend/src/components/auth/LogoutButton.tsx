import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";

// Logout lives in one place (the profile page) but owns real behaviour —
// an in-flight guard so a double-click can't fire two logout requests, and
// the redirect home afterwards. Kept as its own component so that behaviour
// travels with the button if it's ever surfaced somewhere else.
export function LogoutButton({ className }: { className?: string }) {
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
    <Button
      variant="danger"
      size="lg"
      onClick={handleLogout}
      loading={loggingOut}
      iconLeft={<LogOut className="size-4" aria-hidden="true" />}
      className={className}
    >
      {loggingOut ? "Logging out…" : "Log out"}
    </Button>
  );
}

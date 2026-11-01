import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

// Log out, after a confirmation: an accidental tap on a phone shouldn't
// leave someone who doesn't remember their password locked out. Neutral, not
// red, since nothing is lost [23 Color], with staying logged in as the safe
// choice. ConfirmDialog guards against a double-click firing two requests and
// shows a failure (offline, say) in place; on success it goes home.
export function LogoutButton({ className }: { className?: string }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="lg"
        onClick={() => setConfirming(true)}
        iconLeft={<LogOut className="size-4" aria-hidden="true" />}
        className={className}
      >
        Log out
      </Button>
      {confirming && (
        <ConfirmDialog
          title="Log out?"
          description="You'll need your email and password to log in again on this device."
          confirmLabel="Log out"
          busyLabel="Logging out…"
          cancelLabel="Stay logged in"
          icon={<LogOut className="size-4" aria-hidden="true" />}
          onConfirm={async () => {
            await logout();
            navigate("/");
          }}
          onClose={() => setConfirming(false)}
        />
      )}
    </>
  );
}

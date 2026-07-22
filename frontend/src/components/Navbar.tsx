import { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";
import { supabase } from "../lib/supabase";
import { Bell, Menu, X, LogOut, Loader2 } from "lucide-react";
import { formatDateTime } from "../lib/format";
import { Logo } from "./ui/Logo";

type Notification = {
  id: string;
  message: string;
  read: boolean;
  createdAt: string;
  postId: string | null;
};

const navLinks = [
  { label: "Feed", path: "/feed" },
  { label: "Post Food", path: "/create" },
  { label: "My Posts", path: "/my-posts" },
  { label: "My Requests", path: "/my-requests" },
  { label: "Profile", path: "/profile" },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showMobileNotifs, setShowMobileNotifs] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const fetchNotifications = async () => {
    try {
      const data = await apiFetch("/notifications");
      setNotifications(data.notifications);
    } catch {
      // fail silently
    }
  };

  const handleMarkAllRead = async () => {
    await apiFetch("/notifications/read-all", { method: "PUT" });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifs(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!user) return;

    fetchNotifications();

    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as Record<string, any>;
          const newNotif: Notification = {
            id: row.id,
            message: row.message,
            read: row.read,
            createdAt: row.created_at,
            postId: row.post_id,
          };
          setNotifications((prev) => [newNotif, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

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

  const isActive = (path: string) => location.pathname === path;

  const NotificationsList = () =>
    notifications.length === 0 ? (
      <p className="text-sm text-subtle text-center py-6">No notifications yet</p>
    ) : (
      <div className="divide-y divide-border">
        {notifications.map((n) => {
          const clickable = Boolean(n.postId);
          return (
            <div
              key={n.id}
              onClick={() => {
                if (clickable) {
                  setShowNotifs(false);
                  setShowMobileNotifs(false);
                  navigate(`/posts/${n.postId}`);
                }
              }}
              className={`px-4 py-3 text-sm transition-colors ${
                clickable ? "cursor-pointer hover:bg-background" : ""
              } ${n.read ? "text-subtle bg-surface" : "text-foreground bg-accent/5"}`}
            >
              <p className="leading-snug">{n.message}</p>
              <p className="text-xs text-subtle mt-0.5">
                {formatDateTime(n.createdAt)}
              </p>
            </div>
          );
        })}
      </div>
    );

  return (
    <nav className="bg-background sticky top-0 z-50 font-medium tracking-wide">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">

        <Logo to="/feed" />

        {/* Desktop nav links */}
        <div className="hidden sm:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`text-sm font-medium transition-colors duration-150 ${
                isActive(link.path)
                  ? "text-foreground"
                  : "text-subtle hover:text-muted"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop right side */}
        <div className="hidden sm:flex items-center gap-4">
          <span className="text-sm text-subtle">{user?.name}</span>

          {/* Desktop notification bell + dropdown */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => {
                setShowNotifs(!showNotifs);
                if (!showNotifs && unreadCount > 0) handleMarkAllRead();
              }}
              className="cursor-pointer relative flex items-center justify-center w-8 h-8 rounded-lg text-subtle hover:text-foreground hover:bg-surface transition-colors duration-150"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-accent text-background text-[10px] font-semibold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="absolute right-0 top-10 w-80 bg-surface rounded-xl border border-border shadow-lg z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <p className="text-[13px] font-semibold text-foreground">Notifications</p>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  <NotificationsList />
                </div>
              </div>
            )}
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="cursor-pointer flex items-center gap-1.5 text-sm font-medium text-subtle hover:text-foreground transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-subtle"
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
        </div>

        {/* Mobile: bell + hamburger */}
        <div className="sm:hidden flex items-center gap-1">
          <button
            onClick={() => {
              setMenuOpen(false);
              setShowMobileNotifs((prev) => {
                const next = !prev;
                if (next && unreadCount > 0) handleMarkAllRead();
                return next;
              });
            }}
            className="cursor-pointer relative flex items-center justify-center w-8 h-8 rounded-lg text-subtle hover:text-foreground hover:bg-surface transition-colors duration-150"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-accent text-background text-[10px] font-semibold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            className="cursor-pointer flex items-center justify-center w-8 h-8 rounded-lg text-subtle hover:text-foreground hover:bg-surface transition-colors duration-150"
            onClick={() => {
              setShowMobileNotifs(false);
              setMenuOpen((prev) => !prev);
            }}
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile notifications panel */}
      {showMobileNotifs && (
        <div className="sm:hidden bg-surface border-t border-border">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-[13px] font-semibold text-foreground">Notifications</p>
          </div>
          <div className="max-h-72 overflow-y-auto">
            <NotificationsList />
          </div>
        </div>
      )}

      {/* Mobile nav menu */}
      {menuOpen && (
        <div className="sm:hidden border-t border-border px-4 py-4 flex flex-col gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => setMenuOpen(false)}
              className={`text-sm font-medium transition-colors duration-150 ${
                isActive(link.path)
                  ? "text-foreground"
                  : "text-subtle hover:text-muted"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="border-t border-border pt-4 flex items-center justify-between">
            <span className="text-sm text-subtle">{user?.name}</span>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="cursor-pointer flex items-center gap-1.5 text-sm font-medium text-subtle hover:text-foreground transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-subtle"
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
          </div>
        </div>
      )}
    </nav>
  );
}
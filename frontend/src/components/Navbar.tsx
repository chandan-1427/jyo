import { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";
import { supabase } from "../lib/supabase";
import { Bell, Menu, X, LogOut } from "lucide-react";
import { formatDateTime } from "../lib/format";
import { Logo } from "./ui/Logo";

type Notification = {
  id: string;
  message: string;
  read: boolean;
  createdAt: string;
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

  // Close desktop notif dropdown on outside click
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
          const newNotif = payload.new as Notification;
          setNotifications((prev) => [newNotif, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const isActive = (path: string) => location.pathname === path;

  // Shared list rendered in both desktop dropdown and mobile panel
  const NotificationsList = () =>
    notifications.length === 0 ? (
      <p className="text-sm text-neutral-400 text-center py-6">No notifications yet</p>
    ) : (
      <div className="divide-y divide-neutral-50">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`px-4 py-3 text-sm transition-colors ${
              n.read ? "text-neutral-400 " : "text-neutral-700 bg-[#2D6A4F]/5"
            }`}
          >
            <p className="leading-snug">{n.message}</p>
            <p className="text-xs text-gray-300 mt-0.5">
              {formatDateTime(n.createdAt)}
            </p>
          </div>
        ))}
      </div>
    );

  return (
    <nav className=" border-b border-neutral-100 sticky top-0 z-50 font-medium tracking-wide">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">

        <Logo to="/feed"/>

        {/* Desktop nav links */}
        <div className="hidden sm:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`text-sm font-medium transition-colors duration-150 ${
                isActive(link.path)
                  ? "text-neutral-900"
                  : "text-neutral-400 hover:text-neutral-700"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop right side */}
        <div className="hidden sm:flex items-center gap-4">
          <span className="text-sm text-neutral-400">{user?.name}</span>

          {/* Desktop notification bell + dropdown */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => {
                setShowNotifs(!showNotifs);
                if (!showNotifs && unreadCount > 0) handleMarkAllRead();
              }}
              className="cursor-pointer relative flex items-center justify-center w-8 h-8 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors duration-150"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-[#2D6A4F] text-white text-[10px] font-semibold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="absolute right-0 top-10 w-80  rounded-xl border border-neutral-200 shadow-[0_4px_24px_rgba(0,0,0,0.08)] z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-neutral-100">
                  <p className="text-[13px] font-semibold text-neutral-700">Notifications</p>
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
            className="cursor-pointer flex items-center gap-1.5 text-sm font-medium text-neutral-400 hover:text-neutral-700 transition-colors duration-150"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
        </div>

        {/* Mobile: bell + hamburger */}
        <div className="sm:hidden flex items-center gap-1">
          {/* Mobile notification bell */}
          <button
            onClick={() => {
              setMenuOpen(false);
              setShowMobileNotifs((prev) => {
                const next = !prev;
                if (next && unreadCount > 0) handleMarkAllRead();
                return next;
              });
            }}
            className="cursor-pointer relative flex items-center justify-center w-8 h-8 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors duration-150"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-[#2D6A4F] text-white text-[10px] font-semibold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Hamburger */}
          <button
            className="cursor-pointer flex items-center justify-center w-8 h-8 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors duration-150"
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
        <div className="sm:hidden  border-t border-neutral-100">
          <div className="px-4 py-3 border-b border-neutral-100">
            <p className="text-[13px] font-semibold text-neutral-700">Notifications</p>
          </div>
          <div className="max-h-72 overflow-y-auto">
            <NotificationsList />
          </div>
        </div>
      )}

      {/* Mobile nav menu */}
      {menuOpen && (
        <div className="sm:hidden  border-t border-neutral-100 px-4 py-4 flex flex-col gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => setMenuOpen(false)}
              className={`text-sm font-medium transition-colors duration-150 ${
                isActive(link.path)
                  ? "text-neutral-900"
                  : "text-neutral-400 hover:text-neutral-700"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="border-t border-neutral-100 pt-4 flex items-center justify-between">
            <span className="text-sm text-neutral-400">{user?.name}</span>
            <button
              onClick={handleLogout}
              className="cursor-pointer flex items-center gap-1.5 text-sm font-medium text-neutral-400 hover:text-neutral-700 transition-colors duration-150"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
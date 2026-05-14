import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";
import { supabase } from "../lib/supabase";

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
    if (!user) return;

    fetchNotifications();

    // Supabase realtime listener
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

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">

        {/* Brand */}
        <Link to="/feed" className="text-xl font-bold text-orange-500">
          Jyos
        </Link>

        {/* Desktop links */}
        <div className="hidden sm:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`text-sm font-medium transition ${
                isActive(link.path)
                  ? "text-orange-500"
                  : "text-gray-500 hover:text-orange-400"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="hidden sm:flex items-center gap-4">
          <span className="text-sm text-gray-400">{user?.name}</span>

          {/* Notification bell */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifs(!showNotifs);
                if (!showNotifs && unreadCount > 0) handleMarkAllRead();
              }}
              className="relative text-gray-500 hover:text-orange-400 transition"
            >
              🔔
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Dropdown */}
            {showNotifs && (
              <div className="absolute right-0 top-8 w-80 bg-white rounded-2xl shadow-lg border border-gray-100 z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-700">Notifications</p>
                </div>
                {notifications.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">
                    No notifications yet
                  </p>
                ) : (
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`px-4 py-3 border-b border-gray-50 text-sm ${
                          n.read ? "text-gray-400" : "text-gray-700 bg-orange-50"
                        }`}
                      >
                        {n.message}
                        <p className="text-xs text-gray-300 mt-0.5">
                          {new Date(n.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={handleLogout}
            className="text-sm font-medium text-orange-500 hover:text-orange-600 transition"
          >
            Logout
          </button>
        </div>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden text-gray-500 hover:text-orange-400 transition"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="sm:hidden bg-white border-t border-gray-100 px-4 py-4 flex flex-col gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => setMenuOpen(false)}
              className={`text-sm font-medium transition ${
                isActive(link.path)
                  ? "text-orange-500"
                  : "text-gray-500 hover:text-orange-400"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
            <span className="text-sm text-gray-400">{user?.name}</span>
            <button
              onClick={handleLogout}
              className="text-sm font-medium text-orange-500 hover:text-orange-600 transition"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
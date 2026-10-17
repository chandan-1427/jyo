import { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { apiFetch, BASE_URL } from "@/lib/api/api";
import { Bell, Home, PlusSquare, Package, PackageOpen, CircleUserRound } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Logo } from "../ui/Logo";
import { Avatar } from "../ui/Avatar";

type Notification = {
  id: string;
  message: string;
  read: boolean;
  createdAt: string;
  postId: string | null;
};

const NAV_LINKS = [
  { label: "Feed", path: "/feed", icon: Home },
  { label: "Post food", path: "/create", icon: PlusSquare },
  { label: "My posts", path: "/my-posts", icon: Package },
  { label: "My requests", path: "/my-requests", icon: PackageOpen },
];

const MOBILE_TABS = [...NAV_LINKS, { label: "Profile", path: "/profile", icon: CircleUserRound }];

const notificationsKey = ["notifications"] as const;

export default function Navbar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: notifications = [] } = useQuery({
    queryKey: notificationsKey,
    queryFn: () => apiFetch("/notifications").then((r) => r.notifications as Notification[]),
    enabled: !!user,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = async () => {
    await apiFetch("/notifications/read-all", { method: "PUT" });
    queryClient.setQueryData(notificationsKey, (prev: Notification[] = []) =>
      prev.map((n) => ({ ...n, read: true }))
    );
  };

  const toggleNotifications = () => {
    const next = !open;
    setOpen(next);
    if (next && unreadCount > 0) handleMarkAllRead();
  };

  // Close on a click outside the bell and its panel, or on Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!user) return;

    const source = new EventSource(`${BASE_URL}/notifications/stream`, {
      withCredentials: true,
    });

    source.addEventListener("notification", (e: MessageEvent<string>) => {
      const newNotif = JSON.parse(e.data) as Notification;
      queryClient.setQueryData(notificationsKey, (prev: Notification[] = []) => [newNotif, ...prev]);
    });

    return () => {
      source.close();
    };
  }, [user, queryClient]);

  const isActive = (path: string) => location.pathname === path;
  const current = (path: string) => (isActive(path) ? "page" : undefined);

  const openNotification = (postId: string) => {
    setOpen(false);
    navigate(`/posts/${postId}`);
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-fg/[0.06] bg-canvas">
        <div className="flex h-14 items-center justify-between gap-6 px-4 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:px-6 lg:px-10">
          <Logo to="/feed" className="justify-self-start font-display text-2xl text-fg [&>span]:text-leaf" />

          <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                aria-current={current(link.path)}
                className="rounded-md px-3 py-1.5 text-[15px] font-medium text-fg-muted transition-colors hover:text-fg aria-[current=page]:text-fg focus-visible:outline-2 focus-visible:outline-leaf"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 justify-self-end">
            {/* Notifications */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={toggleNotifications}
                aria-expanded={open}
                aria-haspopup="true"
                aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
                className="relative grid size-11 cursor-pointer place-items-center rounded-lg text-fg-muted transition-colors hover:bg-raised hover:text-fg focus-visible:outline-2 focus-visible:outline-leaf sm:size-9"
              >
                <Bell className="size-5 sm:size-[18px]" aria-hidden="true" />
                {/* A dot, not a count; the exact number is in the label for
                    screen readers and in the list itself. */}
                {unreadCount > 0 && (
                  <span
                    className="absolute top-2.5 right-2.5 size-2 rounded-full bg-leaf ring-2 ring-canvas sm:top-1.5 sm:right-1.5"
                    aria-hidden="true"
                  />
                )}
              </button>

              {open && (
                <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl bg-raised shadow-lift ring-1 ring-inset ring-fg/[0.06]">
                  <p className="px-4 pt-4 pb-2 text-sm font-semibold text-fg">Notifications</p>
                  {notifications.length === 0 ? (
                    <p className="px-4 pt-2 pb-6 text-sm text-fg-subtle">No notifications yet.</p>
                  ) : (
                    <ul className="max-h-80 overflow-y-auto pb-2">
                      {notifications.map((n) => {
                        const body = (
                          <>
                            <span
                              className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-leaf")}
                              aria-hidden="true"
                            />
                            <span className="min-w-0">
                              <span className={cn("block text-sm leading-snug", n.read ? "text-fg-muted" : "text-fg")}>
                                {n.message}
                              </span>
                              <span className="mt-0.5 block text-xs text-fg-subtle tabular-nums">
                                {formatDateTime(n.createdAt)}
                              </span>
                            </span>
                          </>
                        );
                        return (
                          <li key={n.id}>
                            {n.postId ? (
                              <button
                                type="button"
                                onClick={() => openNotification(n.postId!)}
                                className="flex w-full cursor-pointer gap-3 px-4 py-2.5 text-left transition-colors hover:bg-lifted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-leaf"
                              >
                                {body}
                              </button>
                            ) : (
                              <div className="flex gap-3 px-4 py-2.5">{body}</div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Profile (desktop; phones reach it from the tab bar) */}
            <Link
              to="/profile"
              aria-current={current("/profile")}
              aria-label="Your profile"
              className="hidden rounded-full ring-2 ring-fg/0 ring-offset-2 ring-offset-canvas transition-shadow duration-200 ease-out hover:ring-fg/20 aria-[current=page]:ring-fg/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf sm:block"
            >
              <Avatar name={user?.name} src={user?.avatarUrl} className="size-9 text-sm" />
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-fg/[0.06] bg-canvas pb-[env(safe-area-inset-bottom)] sm:hidden"
      >
        <ul className="flex h-16">
          {MOBILE_TABS.map(({ label, path, icon: Icon }) => (
            <li key={path} className="flex-1">
              <Link
                to={path}
                aria-current={current(path)}
                className="flex h-full flex-col items-center justify-center gap-1 text-fg-subtle transition-colors aria-[current=page]:text-fg focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-leaf"
              >
                <Icon className="size-5" strokeWidth={isActive(path) ? 2.25 : 1.75} aria-hidden="true" />
                <span className="text-[11px] font-medium leading-none">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

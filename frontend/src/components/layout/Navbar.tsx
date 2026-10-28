import { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import {
  fetchNotifications,
  markNotificationsRead,
  notificationsKey,
  type Notification,
} from "@/lib/api/queries/notifications";
import { BASE_URL } from "@/lib/api/api";
import { Bell } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Logo } from "../ui/Logo";
import { Avatar } from "../ui/Avatar";
import { FeedIcon, MyPostsIcon, MyRequestsIcon, PostFoodIcon, ProfileIcon } from "./NavIcons";

const NAV_LINKS = [
  { label: "Feed", path: "/feed" },
  { label: "Post food", path: "/create" },
  { label: "My posts", path: "/my-posts" },
  { label: "My requests", path: "/my-requests" },
];

// Icons only on phones; the labels are for screen readers. Profile is last
// and drawn separately (it shows your photo).
const MOBILE_TABS = [
  { label: "Feed", path: "/feed", icon: FeedIcon },
  { label: "Post food", path: "/create", icon: PostFoodIcon },
  { label: "My posts", path: "/my-posts", icon: MyPostsIcon },
  { label: "My requests", path: "/my-requests", icon: MyRequestsIcon },
  { label: "Profile", path: "/profile", icon: null },
];

export default function Navbar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { data: notifications = [] } = useQuery({
    queryKey: notificationsKey,
    queryFn: fetchNotifications,
    enabled: !!user,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Opening the panel only shows what's new; a notification counts as read
  // once it's clicked (or all at once with "Mark all as read").
  const markRead = (id?: string) =>
    markNotificationsRead(
      queryClient,
      (n) => id === undefined || n.id === id,
      id ? `/notifications/${id}/read` : "/notifications/read-all"
    );

  const toggleNotifications = () => setOpen(!open);

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
      // Every notification is about a post (a request came in, was approved,
      // ...), so if that post's page is open it updates in place. This also
      // covers demo posts, which send no "feed" event.
      if (newNotif.postId) queryClient.invalidateQueries({ queryKey: ["posts", newNotif.postId] });
      // Approved, declined and expired are all about your requests too.
      queryClient.invalidateQueries({ queryKey: ["requests", "mine"] });
    });

    // A post was added or changed somewhere. Refetches whichever post lists
    // or post page is on screen (the feed, My posts, an open post); anything
    // else is just marked stale for the next visit.
    const refreshFeed = () => queryClient.invalidateQueries({ queryKey: ["posts"] });
    source.addEventListener("feed", refreshFeed);

    // EventSource reconnects on its own after a drop; catch up on anything
    // missed while disconnected (skipping the very first connect).
    let connectedBefore = false;
    source.addEventListener("open", () => {
      if (connectedBefore) refreshFeed();
      connectedBefore = true;
    });

    return () => {
      source.close();
    };
  }, [user, queryClient]);

  const isActive = (path: string) => location.pathname === path;
  const current = (path: string) => (isActive(path) ? "page" : undefined);

  // One whose post was deleted has nowhere to go, so clicking it only marks
  // it read and the panel stays open.
  const openNotification = (n: Notification) => {
    if (!n.read) markRead(n.id);
    if (!n.postId) return;
    setOpen(false);
    navigate(`/posts/${n.postId}`);
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
                // Compact on phones, where it nearly fills the screen; on wider
                // screens the text matches the rest of the app's sizes.
                <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl bg-raised shadow-lift ring-1 ring-inset ring-fg/[0.06] sm:w-96">
                  <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-1 sm:px-5 sm:pt-4 sm:pb-2">
                    <p className="text-sm font-semibold text-fg sm:font-display sm:text-lg">Notifications</p>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={() => markRead()}
                        className="-mr-2 cursor-pointer rounded-md px-2 py-1.5 text-xs font-medium text-fg-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-leaf sm:text-[13px]"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <p className="px-4 pt-2 pb-6 text-sm text-fg-subtle sm:px-5 sm:pb-7 sm:text-[15px]">No notifications yet.</p>
                  ) : (
                    <ul className="max-h-80 overflow-y-auto pb-2 sm:max-h-[26rem]">
                      {notifications.map((n) => {
                        const body = (
                          <>
                            {/* Centred on the message's first line. */}
                            <span
                              className={cn(
                                "mt-1.5 size-1.5 shrink-0 rounded-full sm:mt-[7px] sm:size-2",
                                n.read ? "bg-transparent" : "bg-leaf"
                              )}
                              aria-hidden="true"
                            />
                            <span className="min-w-0">
                              <span
                                className={cn(
                                  "block text-sm leading-snug text-pretty sm:text-[15px] sm:leading-[22px]",
                                  n.read ? "text-fg-muted" : "text-fg"
                                )}
                              >
                                {/* The dot and brighter text, in words for screen readers. */}
                                {!n.read && <span className="sr-only">Unread: </span>}
                                {n.message}
                              </span>
                              <span className="mt-0.5 block text-xs text-fg-subtle tabular-nums sm:mt-1 sm:text-[13px]">
                                {formatDateTime(n.createdAt)}
                              </span>
                            </span>
                          </>
                        );
                        return (
                          <li key={n.id}>
                            {n.postId || !n.read ? (
                              <button
                                type="button"
                                onClick={() => openNotification(n)}
                                className="flex w-full cursor-pointer gap-3 px-4 py-2.5 text-left sm:px-5 sm:py-3 transition-colors hover:bg-lifted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-leaf"
                              >
                                {body}
                              </button>
                            ) : (
                              <div className="flex gap-3 px-4 py-2.5 sm:px-5 sm:py-3">{body}</div>
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

      {/* Mobile tab bar: a pill of frosted glass floating above the page, which
          scrolls on underneath it. Glass is kept to this navigation layer and
          not used on content; the tint is dark enough that the labels stay
          legible over bright food photos. Without backdrop-filter support it
          falls back to a near-solid fill. */}
      <nav
        aria-label="Main"
        className="fixed inset-x-4 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 rounded-full bg-canvas/70 shadow-lift ring-1 ring-inset ring-fg/[0.08] backdrop-blur-lg backdrop-saturate-150 supports-[not(backdrop-filter:blur(0))]:bg-canvas/95 sm:hidden"
      >
        {/* A faint highlight along the top edge, where light would catch glass. */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]" />
        <ul className="relative flex h-14 p-1.5">
          {MOBILE_TABS.map(({ label, path, icon: Icon }) => (
            <li key={path} className="relative flex-1">
              <Link
                to={path}
                aria-current={current(path)}
                className="flex h-full items-center justify-center rounded-full text-fg-muted transition-colors aria-[current=page]:text-white focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-leaf"
              >
                {Icon ? (
                  <Icon active={isActive(path)} />
                ) : (
                  <ProfileIcon src={user?.avatarUrl} active={isActive(path)} />
                )}
                <span className="sr-only">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

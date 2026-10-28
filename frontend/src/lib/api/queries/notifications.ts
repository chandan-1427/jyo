import { useEffect } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/api";

export type Notification = {
  id: string;
  message: string;
  read: boolean;
  createdAt: string;
  postId: string | null;
};

// The bell's list (Navbar). Shared so a post's page can mark its own
// notifications read in the same cache, and the bell's dot updates at once.
export const notificationsKey = ["notifications"] as const;

export const fetchNotifications = () =>
  apiFetch("/notifications").then((r) => r.notifications as Notification[]);

// Opening a post deals with whatever its notifications said (a request came
// in, yours was approved...), however you got there: My posts, My requests,
// the feed or a link. So its unread ones are marked read, on the page and on
// the server. It watches the bell's list (same query), so it also catches one
// arriving while you're on the page. Nothing is sent unless that list shows
// one unread for this post; if the server call fails the list is refetched
// rather than left showing them read.
//
// Watching mustn't refetch the list (refetchOnMount: false; the bell keeps it
// fresh), and any fetch already in flight is cancelled before the change.
// Otherwise a fetch that started before the server heard about it lands
// afterwards with them still unread, and the bell's dot flickers back.
export function useMarkPostNotificationsRead(postId: string | undefined) {
  const queryClient = useQueryClient();
  const { data: hasUnread = false } = useQuery({
    queryKey: notificationsKey,
    queryFn: fetchNotifications,
    select: (list) => list.some((n) => n.postId === postId && !n.read),
    enabled: !!postId,
    refetchOnMount: false,
  });

  useEffect(() => {
    if (!postId || !hasUnread) return;
    markNotificationsRead(queryClient, (n) => n.postId === postId, `/notifications/post/${postId}/read`);
  }, [postId, hasUnread, queryClient]);
}

// Marks the matching notifications read in the bell's list at once, then
// tells the server. Cancels any fetch of the list in flight first, so stale
// "unread" data can't land on top; refetches if the server call fails.
export async function markNotificationsRead(
  queryClient: QueryClient,
  matches: (n: Notification) => boolean,
  endpoint: string
) {
  await queryClient.cancelQueries({ queryKey: notificationsKey });
  queryClient.setQueryData<Notification[]>(notificationsKey, (prev = []) =>
    prev.map((n) => (matches(n) ? { ...n, read: true } : n))
  );
  apiFetch(endpoint, { method: "PUT" }).catch(() => queryClient.invalidateQueries({ queryKey: notificationsKey }));
}

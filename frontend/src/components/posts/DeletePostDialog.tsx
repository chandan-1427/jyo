import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api/api";
import { Dialog } from "../ui/Dialog";
import { Button } from "../ui/Button";
import { Notice } from "../ui/Notice";

interface DeletePostDialogProps {
  // One post, or several picked at once.
  postIds: string[];
  onClose: () => void;
  // After everything was deleted, e.g. leaving the post's own page.
  onDeleted?: () => void;
  description?: string;
}

// Confirms deleting your posts. Each goes through the normal delete endpoint,
// so the API's rules apply to every one (open or ended only, never once a
// request is pending or approved). If some fail, the rest still go, and the
// dialog stays open to say which part didn't.
export function DeletePostDialog({ postIds, onClose, onDeleted, description }: DeletePostDialogProps) {
  const queryClient = useQueryClient();
  const many = postIds.length > 1;

  const remove = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(
        postIds.map((id) => apiFetch(`/posts/${id}`, { method: "DELETE" }).then(() => id))
      );
      const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
      for (const r of results) if (r.status === "fulfilled") queryClient.removeQueries({ queryKey: ["posts", r.value] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });

      if (failed.length > 0) {
        const reason = failed[0].reason instanceof Error ? failed[0].reason.message : "Something went wrong.";
        throw new Error(many ? `${failed.length} of ${postIds.length} couldn't be deleted. ${reason}` : reason);
      }
    },
    onSuccess: () => {
      onClose();
      onDeleted?.();
    },
  });

  const label = many ? `Delete ${postIds.length}` : "Delete";

  return (
    <Dialog title={many ? `Delete ${postIds.length} posts?` : "Delete this post?"} onClose={onClose}>
      <p className="leading-relaxed text-fg-muted">
        {description ?? (many ? "They're removed for good. This can't be undone." : "It comes off the feed straight away. This can't be undone.")}
      </p>
      {remove.error && <Notice tone="error" className="mt-4">{remove.error.message}</Notice>}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={onClose} disabled={remove.isPending}>
          Keep {many ? "them" : "it"}
        </Button>
        <Button
          variant="dangerSolid"
          onClick={() => remove.mutate()}
          loading={remove.isPending}
          iconLeft={<Trash2 className="size-4" aria-hidden="true" />}
        >
          {remove.isPending ? "Deleting…" : label}
        </Button>
      </div>
    </Dialog>
  );
}

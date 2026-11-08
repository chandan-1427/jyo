import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api/api";
import { formatDate } from "@/lib/format";
import { Button } from "../ui/Button";
import { Notice } from "../ui/Notice";

type Block = { id: string; label: string; createdAt: string };

export function BlockedPeople() {
  const queryClient = useQueryClient();
  const { data, isPending, error } = useQuery<{ blocks: Block[] }>({
    queryKey: ["users", "me", "blocks"],
    queryFn: () => apiFetch("/users/me/blocks"),
  });
  const unblock = useMutation({
    mutationFn: (id: string) => apiFetch(`/users/me/blocks/${id}`, { method: "DELETE" }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users", "me", "blocks"] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  if (isPending) return <p className="text-sm text-fg-subtle">Loading…</p>;
  if (error) return <Notice tone="error">{error.message}</Notice>;
  if (!data.blocks.length) {
    return <p className="text-sm text-fg-muted">Nobody. You can block someone from a post or a request.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-fg/[0.06]">
      {data.blocks.map((block) => (
        <li key={block.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="truncate text-sm text-fg">{block.label}</p>
            <p className="text-[13px] text-fg-subtle">Blocked {formatDate(block.createdAt)}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => unblock.mutate(block.id)}
            loading={unblock.isPending && unblock.variables === block.id}
          >
            Unblock
          </Button>
        </li>
      ))}
    </ul>
  );
}

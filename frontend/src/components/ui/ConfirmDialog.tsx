import type { ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { Notice } from "./Notice";

interface ConfirmDialogProps {
  title: string;
  description: ReactNode;
  confirmLabel: string;
  busyLabel: string;
  // What happens on confirm; a rejection shows its message in the dialog.
  onConfirm: () => Promise<unknown>;
  onClose: () => void;
  // "danger" for something that can't be undone or takes something back.
  tone?: "default" | "danger";
  cancelLabel?: string;
  icon?: ReactNode;
}

// Asks "are you sure?" before an action, then runs it, staying open with the
// reason if it fails and closing once it succeeds.
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  busyLabel,
  onConfirm,
  onClose,
  tone = "default",
  cancelLabel = "Keep it",
  icon,
}: ConfirmDialogProps) {
  const action = useMutation({ mutationFn: onConfirm, onSuccess: onClose });

  return (
    <Dialog title={title} onClose={onClose}>
      <div className="leading-relaxed text-fg-muted">{description}</div>
      {action.error && <Notice tone="error" className="mt-4">{action.error.message}</Notice>}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button variant="outline" onClick={onClose} disabled={action.isPending}>
          {cancelLabel}
        </Button>
        <Button
          variant={tone === "danger" ? "dangerSolid" : "primary"}
          onClick={() => action.mutate()}
          loading={action.isPending}
          iconLeft={icon}
        >
          {action.isPending ? busyLabel : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}

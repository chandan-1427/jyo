import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ban, Flag } from "lucide-react";
import { apiFetch } from "@/lib/api/api";
import { applyServerFieldErrors, useZodForm } from "@/lib/forms";
import { reportSchema } from "@/lib/validation";
import { REPORT_REASONS, targetPath, type SafetyTarget } from "@/lib/safety";
import { cn } from "@/lib/utils";
import { Dialog } from "../ui/Dialog";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { Notice } from "../ui/Notice";
import { TextAreaField } from "../ui/TextField";

const who = (target: SafetyTarget) => (target.kind === "post" ? "the person sharing this" : target.name);

function ReportDialog({ target, onClose, onBlocked }: { target: SafetyTarget; onClose: () => void; onBlocked: () => void }) {
  const queryClient = useQueryClient();
  const [alsoBlock, setAlsoBlock] = useState(false);
  const { register, handleSubmit, setError, formState: { errors } } = useZodForm(reportSchema, { details: "" });
  const reasons = REPORT_REASONS.filter((r) => target.kind === "post" || !r.forPosts);

  const send = useMutation({
    mutationFn: async (values: { reason: string; details: string }) => {
      await apiFetch(`${targetPath(target)}/report`, { method: "POST", body: JSON.stringify(values) });
      if (alsoBlock) await apiFetch(`${targetPath(target)}/block`, { method: "POST" });
    },
    onSuccess: () => {
      if (alsoBlock) queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (err) => applyServerFieldErrors(err, setError, ["reason", "details"]),
  });

  if (send.isSuccess) {
    const close = () => (alsoBlock ? onBlocked() : onClose());
    return (
      <Dialog title="Report sent" onClose={close}>
        <Notice tone="success">
          Thanks for telling us. We'll look into it.{alsoBlock && " You've also blocked them."}
        </Notice>
        <Button size="lg" fullWidth className="mt-5" onClick={close}>
          Done
        </Button>
      </Dialog>
    );
  }

  const fieldLevel = Object.values(errors).some((e) => e?.type === "server");
  const error = !fieldLevel ? send.error?.message : undefined;

  return (
    <Dialog
      title={target.kind === "post" ? "Report this post" : `Report ${target.name}`}
      description="Only the Jyo team sees this. They aren't told who reported them."
      onClose={onClose}
    >
      {error && <Notice tone="error" className="mb-4">{error}</Notice>}
      <form onSubmit={handleSubmit((v) => send.mutate(v))} noValidate className="flex flex-col gap-5">
        <fieldset aria-describedby={errors.reason ? "reason-error" : undefined}>
          <legend className="text-sm font-medium text-fg">What's wrong?</legend>
          <div className="mt-2 flex flex-col gap-2">
            {reasons.map((r) => (
              <label
                key={r.value}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-raised px-3.5 py-2.5 text-sm text-fg-muted ring-1 ring-inset ring-fg/[0.08] transition-colors",
                  "hover:text-fg has-[:checked]:bg-lifted has-[:checked]:text-fg has-[:checked]:ring-2 has-[:checked]:ring-leaf",
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-leaf"
                )}
              >
                <input type="radio" value={r.value} className="peer sr-only" {...register("reason")} />
                <span
                  aria-hidden="true"
                  className="grid size-4 shrink-0 place-items-center rounded-full ring-[1.5px] ring-inset ring-fg/30 peer-checked:ring-leaf after:size-2 after:scale-0 after:rounded-full after:bg-leaf after:transition-transform after:duration-150 after:content-[''] peer-checked:after:scale-100 motion-reduce:after:transition-none"
                />
                {r.label}
              </label>
            ))}
          </div>
          {errors.reason && (
            <p id="reason-error" className="mt-1.5 text-[13px] leading-snug text-danger">
              {errors.reason.message}
            </p>
          )}
        </fieldset>

        <TextAreaField
          label="Anything else we should know?"
          labelAside={<span className="text-sm text-fg-subtle">Optional</span>}
          rows={3}
          error={errors.details?.message}
          {...register("details")}
        />

        <Checkbox
          checked={alsoBlock}
          onChange={(e) => setAlsoBlock(e.target.checked)}
          className="items-start"
          label={`Also block ${who(target)}`}
        />

        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={onClose} disabled={send.isPending}>
            Cancel
          </Button>
          <Button type="submit" loading={send.isPending}>
            {send.isPending ? "Sending…" : "Send report"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

// Quiet Report and Block actions, kept apart from a page's main buttons.
export function ReportBlockActions({ target, onBlocked }: { target: SafetyTarget; onBlocked: () => void }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState<"report" | "block" | null>(null);
  const name = who(target);

  return (
    <div className="flex flex-wrap gap-1">
      <Button variant="ghost" size="sm" onClick={() => setOpen("report")} iconLeft={<Flag className="size-3.5" aria-hidden="true" />}>
        Report
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setOpen("block")} iconLeft={<Ban className="size-3.5" aria-hidden="true" />}>
        Block
      </Button>

      {open === "report" && <ReportDialog target={target} onClose={() => setOpen(null)} onBlocked={onBlocked} />}
      {open === "block" && (
        <ConfirmDialog
          title={target.kind === "post" ? "Block the person sharing this?" : `Block ${target.name}?`}
          description={`You and ${name} won't see each other's food, and neither of you can ask for the other's. Anything waiting or approved between you is called off. They won't be told. You can unblock them in your Profile.`}
          confirmLabel="Block"
          busyLabel="Blocking…"
          tone="danger"
          cancelLabel="Cancel"
          onConfirm={async () => {
            await apiFetch(`${targetPath(target)}/block`, { method: "POST" });
            queryClient.invalidateQueries({ queryKey: ["posts"] });
            queryClient.invalidateQueries({ queryKey: ["requests", "mine"] });
            onBlocked();
          }}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

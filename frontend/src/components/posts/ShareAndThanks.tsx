import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { HandHeart, Share2 } from "lucide-react";
import { apiFetch } from "@/lib/api/api";
import { applyServerFieldErrors, useZodForm } from "@/lib/forms";
import { thanksSchema } from "@/lib/validation";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Notice } from "../ui/Notice";
import { TextAreaField } from "../ui/TextField";

// A link that previews the food in WhatsApp and elsewhere (photo, title,
// food details, pickup time; never where it is or who shared it). Phones
// offer their own share sheet, which lists WhatsApp; elsewhere it opens
// WhatsApp directly.
export function ShareButton({ postId, title }: { postId: string; title: string }) {
  const share = async () => {
    const url = `${window.location.origin}/p/${postId}`;
    const text = `${title}, free to pick up on Jyo`;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch {
        // Closing the share sheet without choosing an app isn't an error.
      }
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}: ${url}`)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <Button variant="secondary" onClick={share} iconLeft={<Share2 className="size-4" aria-hidden="true" />}>
      Share
    </Button>
  );
}

// The picker confirming they collected the food, with an optional note for
// the person who shared it.
export function PickedUpButton({
  requestId,
  postId,
  label,
}: {
  requestId: string;
  postId: string;
  label: string;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, setError, formState: { errors } } = useZodForm(thanksSchema, { note: "" });
  const send = useMutation({
    mutationFn: (values: { note: string }) =>
      apiFetch(`/requests/${requestId}/collected`, { method: "POST", body: JSON.stringify(values) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts", postId] });
      queryClient.invalidateQueries({ queryKey: ["requests", "mine"] });
      setOpen(false);
    },
    onError: (err) => applyServerFieldErrors(err, setError, ["note"]),
  });

  const fieldLevel = Object.values(errors).some((e) => e?.type === "server");

  return (
    <>
      <Button size="lg" fullWidth onClick={() => setOpen(true)} iconLeft={<HandHeart className="size-4" aria-hidden="true" />}>
        {label}
      </Button>
      {open && (
        <Dialog
          title="Picked it up?"
          description="They'll be told the food reached you. A few words of thanks mean a lot to someone who shared."
          onClose={() => setOpen(false)}
        >
          {send.error && !fieldLevel && <Notice tone="error" className="mb-4">{send.error.message}</Notice>}
          <form onSubmit={handleSubmit((v) => send.mutate(v))} noValidate className="flex flex-col gap-5">
            <TextAreaField
              label="Say thanks"
              labelAside={<span className="text-sm text-fg-subtle">Optional</span>}
              placeholder="Thank you, it was delicious!"
              rows={3}
              error={errors.note?.message}
              {...register("note")}
            />
            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={send.isPending}>
                Cancel
              </Button>
              <Button type="submit" loading={send.isPending}>
                {send.isPending ? "Sending…" : "Send"}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}

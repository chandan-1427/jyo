import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api/api";
import { authMeKey } from "@/lib/api/queries/auth";
import { deleteAccountSchema } from "@/lib/validation";
import { applyServerFieldErrors, useZodForm } from "@/lib/forms";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { TextField } from "@/components/ui/TextField";

// Deleting an account asks for the password again, says what goes and when
// (backups included), and confirms once it's done, in the same place. Then
// everything this browser kept about the account is dropped, not just the
// login: on a shared phone, the next person mustn't see their posts.
export function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [deleted, setDeleted] = useState(false);

  const { register, handleSubmit, setError, formState: { errors } } = useZodForm(deleteAccountSchema, { password: "" });

  const remove = useMutation({
    mutationFn: (password: string) => apiFetch("/users/me", { method: "DELETE", body: JSON.stringify({ password }) }),
    onSuccess: () => setDeleted(true),
    onError: (err) => {
      // A wrong password belongs under the field; anything else (a pickup
      // still in progress, too many tries) is about the account as a whole.
      if (err instanceof ApiError && err.status === 403) {
        setError("password", { type: "server", message: err.message });
      } else {
        applyServerFieldErrors(err, setError, ["password"]);
      }
    },
  });

  const finish = () => {
    queryClient.clear();
    queryClient.setQueryData(authMeKey, null);
    navigate("/", { replace: true });
  };

  if (deleted) {
    return (
      <Dialog title="Account deleted" onClose={finish}>
        <Notice tone="success">Your account and everything you shared on Jyo have been deleted.</Notice>
        <Button size="lg" fullWidth className="mt-6" onClick={finish}>
          Done
        </Button>
      </Dialog>
    );
  }

  const fieldError = errors.password?.message;
  const generalError = remove.error && !fieldError ? remove.error.message : "";

  return (
    <Dialog title="Delete your account?" onClose={onClose}>
      <div className="space-y-3 leading-relaxed text-fg-muted">
        <p>
          This can't be undone. Your account, your posts and their photos, your requests and selfies, and your
          notifications are deleted straight away.
        </p>
        <p>Copies in our encrypted backups are gone within 30 days.</p>
      </div>

      <form onSubmit={handleSubmit(({ password }) => remove.mutate(password))} noValidate className="mt-5">
        <TextField
          label="Your password"
          type="password"
          autoComplete="current-password"
          error={fieldError}
          {...register("password")}
        />

        {generalError && <Notice tone="error" className="mt-4">{generalError}</Notice>}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={onClose} disabled={remove.isPending}>
            Keep my account
          </Button>
          <Button
            type="submit"
            variant="dangerSolid"
            loading={remove.isPending}
            iconLeft={<Trash2 className="size-4" aria-hidden="true" />}
          >
            {remove.isPending ? "Deleting…" : "Delete account"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

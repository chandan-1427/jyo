import { useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Phone } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ApiError, apiFetch } from "@/lib/api/api";
import { authMeKey } from "@/lib/api/queries/auth";
import { fields } from "@/lib/validation";
import { Checkbox } from "../ui/Checkbox";
import { TextField } from "../ui/TextField";
import { Button } from "../ui/Button";
import { Notice } from "../ui/Notice";
import { buttonClasses } from "../ui/buttonStyles";

const spaced = (phone: string) => `${phone.slice(0, 5)} ${phone.slice(5)}`;

// The number on the account, with a way to correct it on the spot: it's
// checked nowhere else, and a wrong one only shows up when someone calls it.
function OwnNumber() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();

  const save = useMutation({
    mutationFn: (phone: string) => apiFetch("/users/me", { method: "PATCH", body: JSON.stringify({ phone }) }),
    onSuccess: (data) => {
      queryClient.setQueryData(authMeKey, data.user);
      setEditing(false);
    },
    onError: (err) => setError(err instanceof ApiError ? err.details?.phone?.[0] ?? err.message : err.message),
  });

  const phone = user?.phone;

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl bg-lifted px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm text-fg-subtle">Your number</p>
          <p className="mt-0.5 font-medium text-fg tabular-nums">{phone ? spaced(phone) : "None on your account"}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setValue(phone ?? "");
            setError(undefined);
            setEditing(true);
          }}
        >
          {phone ? "Change" : "Add"}
        </Button>
      </div>
    );
  }

  const submit = () => {
    const parsed = fields.phone.safeParse(value);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message);
    setError(undefined);
    save.mutate(parsed.data);
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-lifted p-4 [--field-bg:var(--color-raised)]">
      <TextField
        label="Your phone number"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        error={error}
        hint="10 digits. This also updates your profile."
      />
      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="button" onClick={submit} loading={save.isPending}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

// A choice to share your number, showing which number that is once it's on.
export function PhoneShareField({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Checkbox label={label} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {checked && <OwnNumber />}
    </div>
  );
}

// The same choice for a request that already exists, saved as it changes.
export function SharePhoneSetting({
  requestId,
  postId,
  sharing,
  label,
}: {
  requestId: string;
  postId: string;
  sharing: boolean;
  label: ReactNode;
}) {
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: (sharePhone: boolean) =>
      apiFetch(`/requests/${requestId}`, { method: "PATCH", body: JSON.stringify({ sharePhone }) }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["posts", postId] }),
  });

  return (
    <div className="flex flex-col gap-3">
      <PhoneShareField
        label={label}
        checked={update.isPending ? update.variables : sharing}
        disabled={update.isPending}
        onChange={(next) => update.mutate(next)}
      />
      {update.error && <Notice tone="error">{update.error.message}</Notice>}
    </div>
  );
}

export function ContactButtons({ phone, message }: { phone: string; message: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-fg-subtle">
        Their number: <span className="font-medium text-fg tabular-nums">{spaced(phone)}</span>
      </p>
      <div className="grid grid-cols-2 gap-3">
        <a href={`tel:+91${phone}`} className={buttonClasses({ variant: "secondary" })}>
          <Phone className="size-4" aria-hidden="true" />
          Call
        </a>
        <a
          href={`https://wa.me/91${phone}?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonClasses({ variant: "secondary" })}
        >
          <MessageCircle className="size-4" aria-hidden="true" />
          WhatsApp
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>
    </div>
  );
}

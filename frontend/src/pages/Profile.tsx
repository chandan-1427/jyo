import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { authMeKey, fetchAuthMe } from "@/lib/queries/auth";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { LinkButton } from "@/components/ui/LinkButton";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <label className="text-[13px] font-medium text-muted">{label}</label>
        {hint && <span className="text-[12px] text-subtle">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function allowOnlyDigits(e: React.KeyboardEvent<HTMLInputElement>) {
  const allowed = ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End"];
  if (!allowed.includes(e.key) && !/^\d$/.test(e.key)) e.preventDefault();
}

export default function Profile() {
  const queryClient = useQueryClient();

  const { data: profile, isLoading: loading } = useQuery({
    queryKey: authMeKey,
    queryFn: fetchAuthMe,
  });

  const [form, setForm] = useState({
    name: "",
    phone: "",
    locationText: "",
    description: "",
  });
  const [formInitialized, setFormInitialized] = useState(false);
  const [success, setSuccess] = useState(false);

  // Seed the editable form once when the profile first loads — subsequent
  // background revalidations shouldn't clobber in-progress edits.
  useEffect(() => {
    if (profile && !formInitialized) {
      setForm({
        name: profile.name ?? "",
        phone: profile.phone ?? "",
        locationText: profile.locationText ?? "",
        description: profile.description ?? "",
      });
      setFormInitialized(true);
    }
  }, [profile, formInitialized]);

  const saveMutation = useMutation({
    mutationFn: (formData: typeof form) =>
      apiFetch("/users/me", { method: "PUT", body: JSON.stringify(formData) }),
    onSuccess: (data) => {
      queryClient.setQueryData(authMeKey, data.user);
      setSuccess(true);
    },
  });

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(false), 3000);
    return () => clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    if (!saveMutation.error) return;
    const timer = setTimeout(() => saveMutation.reset(), 4000);
    return () => clearTimeout(timer);
  }, [saveMutation.error, saveMutation]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setSuccess(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess(false);
    saveMutation.mutate(form);
  };

  const saving = saveMutation.isPending;
  const error = saveMutation.error?.message || "";

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-20 flex flex-col items-center gap-3 font-medium tracking-wide">
        <Loader2 className="w-5 h-5 text-subtle animate-spin" />
        <p className="text-sm text-subtle">Loading your profile…</p>
      </div>
    );
  }

  const initial = profile?.name?.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="px-6 py-8 font-medium tracking-wide">

      {/* Header */}
      <div className="mb-8">
        <p className="text-sm text-subtle mb-1">Account</p>
        <h1 className="font-semibold text-2xl text-foreground tracking-tight">My Profile</h1>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-6 items-start">

        {/* Left — identity summary */}
        <div className="bg-surface border border-border rounded-xl px-5 py-6 flex flex-col items-center text-center gap-4 lg:sticky lg:top-20">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center">
            <span className="text-xl font-semibold text-accent">{initial}</span>
          </div>

          <div>
            <p className="text-base font-semibold text-foreground">{profile?.name}</p>
            <p className="text-sm text-subtle mt-0.5">{profile?.email}</p>
          </div>

          <div className="w-full border-t border-border pt-4">
            <p className="text-xs text-subtle">Member since</p>
            <p className="text-sm text-muted mt-0.5">
              {profile?.createdAt
                ? new Date(profile.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric", month: "long", year: "numeric",
                  })
                : "—"}
            </p>
          </div>
        </div>

        {/* Right — editable form */}
        <div className="flex flex-col gap-4 max-w-xl">

          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-900/40 bg-red-950/30 px-3.5 py-3">
              <AlertCircle className="w-4 h-4 text-red-400 mt-px shrink-0" />
              <p className="text-sm text-red-400 leading-snug">{error}</p>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2.5 rounded-lg border border-emerald-900/40 bg-emerald-950/30 px-3.5 py-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-px shrink-0" />
              <p className="text-sm text-emerald-400 leading-snug">Profile updated successfully.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-xl px-5 py-5 flex flex-col gap-4">

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Name">
                <Input
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  autoComplete="name"
                  required
                />
              </Field>

              <Field label="Phone">
                <Input
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={form.phone}
                  onChange={handleChange}
                  onKeyDown={allowOnlyDigits}
                  autoComplete="tel"
                  required
                />
              </Field>
            </div>

            <Field label="Area / Locality" hint="optional">
              <Input
                name="locationText"
                type="text"
                value={form.locationText}
                onChange={handleChange}
                placeholder="e.g. Balaji Nagar, Tirupati"
              />
            </Field>

            <Field label="About you" hint="optional">
              <Textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="A short note about yourself — students, families, anyone is welcome"
                rows={4}
              />
            </Field>

            <LinkButton
              as="button"
              type="submit"
              label={saving ? "Saving…" : "Save Changes"}
              loading={saving}
              loadingLabel="Saving…"
              disabled={saving}
              className="mt-1 w-full sm:w-fit sm:self-end"
            />

          </form>
        </div>
      </div>
    </div>
  );
}
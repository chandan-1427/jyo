import { useEffect, useState } from "react";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { LinkButton } from "@/components/ui/LinkButton";

type ProfileData = {
  id: string;
  name: string;
  email: string;
  phone: string;
  locationText: string | null;
  description: string | null;
  createdAt: string;
};

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
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    locationText: "",
    description: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    apiFetch("/users/me")
      .then((data) => {
        setProfile(data.user);
        setForm({
          name: data.user.name ?? "",
          phone: data.user.phone ?? "",
          locationText: data.user.locationText ?? "",
          description: data.user.description ?? "",
        });
      })
      .catch((err: unknown) => {
        if (err instanceof Error) setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(false), 3000);
    return () => clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(""), 4000);
    return () => clearTimeout(timer);
  }, [error]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setSaving(true);
    try {
      const data = await apiFetch("/users/me", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      setProfile(data.user);
      setSuccess(true);
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSaving(false);
    }
  };

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
              {profile
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
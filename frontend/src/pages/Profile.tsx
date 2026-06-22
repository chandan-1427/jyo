import { useEffect, useState } from "react";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { apiFetch } from "../lib/api";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";
import { LinkButton } from "../components/ui/LinkButton";

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
        <label className="text-[13px] font-medium text-neutral-700">{label}</label>
        {hint && <span className="text-[12px] text-neutral-400">{hint}</span>}
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
        <Loader2 className="w-5 h-5 text-neutral-300 animate-spin" />
        <p className="text-sm text-neutral-400">Loading your profile…</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-1 font-medium tracking-wide">

      {/* Header */}
      <div className="mb-8">
        <p className="text-sm text-neutral-400 mb-1">Account</p>
        <h1 className="font-semibold text-2xl text-neutral-900 tracking-tight">My Profile</h1>
      </div>

      <div className="max-w-lg flex flex-col gap-5">

        {/* Read-only info */}
        <div className="bg-white border border-neutral-200 rounded-[0.5rem] px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-around gap-3 sm:gap-0">
          <div className="flex flex-col gap-0.5">
            <p className="text-xs text-neutral-400">Email</p>
            <p className="text-sm text-neutral-700">{profile?.email}</p>
          </div>
          <div className="w-full h-px sm:w-px sm:h-8 bg-neutral-200 shrink-0" />
          <div className="flex flex-col gap-0.5">
            <p className="text-xs text-neutral-400">Member since</p>
            <p className="text-sm text-neutral-700">
              {profile
                ? new Date(profile.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric", month: "long", year: "numeric",
                  })
                : "—"}
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3">
            <AlertCircle className="w-4 h-4 text-red-500 mt-px shrink-0" />
            <p className="text-sm text-red-600 leading-snug">{error}</p>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-px shrink-0" />
            <p className="text-sm text-emerald-600 leading-snug">Profile updated successfully.</p>
          </div>
        )}

        {/* Editable form */}
        <form onSubmit={handleSubmit} className="bg-white border border-neutral-200 rounded-[0.5rem] px-5 py-5 flex flex-col gap-4">

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
              rows={3}
            />
          </Field>

          <LinkButton
            as="button"
            type="submit"
            label={saving ? "Saving…" : "Save Changes"}
            loading={saving}
            loadingLabel="Saving…"
            disabled={saving}
            className="mt-1 w-full"
          />

        </form>
      </div>
    </div>
  );
}
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, AlertCircle, CheckCircle2, Mail, Camera, Upload, Trash2, Sparkles } from "lucide-react";
import { FaGithub, FaInstagram } from "react-icons/fa";
import { apiFetch } from "@/lib/api/api";
import { authMeKey, fetchAuthMe } from "@/lib/api/queries/auth";
import { useAuth } from "@/context/AuthContext";
import { uploadAvatar, removeAvatar } from "@/lib/supabase";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { LinkButton } from "@/components/ui/LinkButton";
import { LogoutButton } from "@/components/auth/LogoutButton";

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024; // 5MB — matches the backend's hard limit

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

// Same three destinations as Home.tsx's footer — that page redirects logged-in
// users straight to /feed, so this is the only place they can reach them.
const CONNECT_LINKS = [
  {
    label: "Mail",
    icon: Mail,
    href: "https://mail.google.com/mail/?view=cm&to=jyofoodsharing@gmail.com&su=Jyo Support",
  },
  { label: "GitHub", icon: FaGithub, href: "https://github.com/chandan-1427/jyo" },
  { label: "Instagram", icon: FaInstagram, href: "https://www.instagram.com/jyo_food_sharing" },
];

export default function Profile() {
  const queryClient = useQueryClient();
  const { startDemo, stopDemo } = useAuth();

  const { data: profile, isLoading: loading } = useQuery({
    queryKey: authMeKey,
    queryFn: fetchAuthMe,
  });

  const [demoActionLoading, setDemoActionLoading] = useState(false);
  const [demoActionError, setDemoActionError] = useState("");

  const handleDemoToggle = async () => {
    setDemoActionLoading(true);
    setDemoActionError("");
    try {
      if (profile?.isDemo) await stopDemo();
      else await startDemo();
    } catch (err) {
      setDemoActionError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setDemoActionLoading(false);
    }
  };

  const [form, setForm] = useState({
    name: "",
    phone: "",
    locationText: "",
    description: "",
  });
  const [formInitialized, setFormInitialized] = useState(false);
  const [success, setSuccess] = useState(false);

  // Seed the editable form once when the profile first loads — subsequent
  // background revalidations shouldn't clobber in-progress edits. Adjusting
  // state during render (React's documented pattern for this) rather than
  // in an effect, since this only needs to happen for the render where
  // `profile` first becomes available, not as a side effect after commit.
  if (profile && !formInitialized) {
    setForm({
      name: profile.name ?? "",
      phone: profile.phone ?? "",
      locationText: profile.locationText ?? "",
      description: profile.description ?? "",
    });
    setFormInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: (formData: typeof form) =>
      apiFetch("/users/me", { method: "PUT", body: JSON.stringify(formData) }),
    onSuccess: (data) => {
      queryClient.setQueryData(authMeKey, data.user);
      setSuccess(true);
    },
  });

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const avatarMenuRef = useRef<HTMLDivElement>(null);
  const [avatarError, setAvatarError] = useState("");
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (avatarMenuRef.current && !avatarMenuRef.current.contains(e.target as Node)) {
        setShowAvatarMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const avatarUploadMutation = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: (user) => queryClient.setQueryData(authMeKey, user),
    onError: (err: Error) => setAvatarError(err.message),
  });

  const avatarRemoveMutation = useMutation({
    mutationFn: removeAvatar,
    onSuccess: (user) => queryClient.setQueryData(authMeKey, user),
    onError: (err: Error) => setAvatarError(err.message),
  });

  const avatarBusy = avatarUploadMutation.isPending || avatarRemoveMutation.isPending;

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file after an error
    if (!file) return;

    setAvatarError("");

    // Quick client-side checks for immediate feedback — the backend re-validates
    // both (real size limit, and actual file type via magic bytes, not this
    // client-supplied MIME type) since this check alone can't be trusted.
    if (!file.type.startsWith("image/")) {
      setAvatarError("Please upload an image file.");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      setAvatarError("File is too large. Maximum size is 5MB.");
      return;
    }

    avatarUploadMutation.mutate(file);
  };

  useEffect(() => {
    if (!avatarError) return;
    const timer = setTimeout(() => setAvatarError(""), 4000);
    return () => clearTimeout(timer);
  }, [avatarError]);

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
  const isDirty =
    !!profile &&
    (form.name !== (profile.name ?? "") ||
      form.phone !== (profile.phone ?? "") ||
      form.locationText !== (profile.locationText ?? "") ||
      form.description !== (profile.description ?? ""));

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

      <div className="grid md:grid-cols-[280px_1fr] gap-6 items-start">

        {/* Left — identity summary */}
        <div className="bg-surface border border-border rounded-xl px-5 py-6 flex flex-col items-center text-center gap-4 md:sticky md:top-20">
          <div ref={avatarMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setShowAvatarMenu((v) => !v)}
              disabled={avatarBusy}
              aria-label="Change profile photo"
              className="cursor-pointer group relative w-24 h-24 rounded-full overflow-hidden border-2 border-border disabled:cursor-default"
            >
              {profile?.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-accent/10 flex items-center justify-center">
                  <span className="text-3xl font-semibold text-accent">{initial}</span>
                </div>
              )}

              <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                {avatarBusy ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <Camera className="w-5 h-5 text-white" />
                )}
              </div>
            </button>

            {showAvatarMenu && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-44 bg-surface rounded-xl border border-border shadow-lg z-50 overflow-hidden text-left">
                <button
                  type="button"
                  onClick={() => {
                    setShowAvatarMenu(false);
                    avatarInputRef.current?.click();
                  }}
                  className="cursor-pointer w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-background transition-colors"
                >
                  <Upload className="w-3.5 h-3.5 text-subtle" />
                  Upload photo
                </button>
                {profile?.avatarUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAvatarMenu(false);
                      avatarRemoveMutation.mutate();
                    }}
                    className="cursor-pointer w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-background transition-colors border-t border-border"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove photo
                  </button>
                )}
              </div>
            )}
          </div>

          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarSelect}
            className="hidden"
          />

          {avatarError && (
            <p className="text-xs text-red-400 -mt-2 leading-snug">{avatarError}</p>
          )}

          <div>
            <p className="text-base font-semibold text-foreground">{profile?.name}</p>
            <p className="text-sm text-subtle mt-0.5">{profile?.email}</p>
          </div>

          <div className="w-full border-t border-border pt-5">
            <p className="text-xs text-subtle">Member since</p>
            <p className="text-sm text-muted mt-0.5">
              {profile?.createdAt
                ? new Date(profile.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric", month: "long", year: "numeric",
                  })
                : "—"}
            </p>
          </div>

          <div className="w-full border-t border-border pt-4">
            <button
              type="button"
              onClick={handleDemoToggle}
              disabled={demoActionLoading}
              className="cursor-pointer w-full flex items-center justify-center gap-1.5 text-sm font-medium text-accent hover:text-foreground transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {demoActionLoading
                ? (profile?.isDemo ? "Ending…" : "Starting…")
                : (profile?.isDemo ? "Exit Demo" : "Start Demo")}
            </button>
            {demoActionError && (
              <p className="text-xs text-red-400 mt-1.5 text-center leading-snug">{demoActionError}</p>
            )}
          </div>

          <div className="w-full border-t border-border pt-4">
            <p className="text-xs text-subtle mb-2.5">Connect with us</p>
            <div className="flex items-center justify-center gap-3">
              {CONNECT_LINKS.map(({ label, icon: Icon, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  title={label}
                  className="flex items-center justify-center w-9 h-9 rounded-lg text-subtle hover:text-foreground hover:bg-background transition-colors duration-150"
                >
                  <Icon className="w-4.5 h-4.5" />
                </a>
              ))}
            </div>
          </div>

          <div className="w-full border-t border-border pt-4">
            <LogoutButton />
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
              disabled={saving || !isDirty}
              className="mt-1 w-full sm:w-fit sm:self-end"
            />

          </form>
        </div>
      </div>
    </div>
  );
}
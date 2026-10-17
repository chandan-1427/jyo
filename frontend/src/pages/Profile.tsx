import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  Check,
  CircleQuestionMark,
  FileText,
  FlaskConical,
  Loader2,
  Mail,
  Package,
  PackageCheck,
  PackageOpen,
  Pencil,
  MapPin,
  Phone,
  Play,
  Save,
  Settings,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { FaGithub, FaInstagram } from "react-icons/fa";
import { apiFetch } from "@/lib/api/api";
import { authMeKey, fetchAuthMe } from "@/lib/api/queries/auth";
import { useAuth } from "@/context/AuthContext";
import { uploadAvatar, removeAvatar } from "@/lib/supabase";
import { profileSchema } from "@/lib/validation";
import { applyServerFieldErrors, useZodForm } from "@/lib/forms";
import { useV2Theme } from "@/lib/theme";
import type { FoodPost, PickupRequest } from "@/types/api";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { TextAreaField, TextField } from "@/components/ui/TextField";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { BannerPattern } from "@/components/profile/BannerPattern";

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024; // 5MB — matches the backend's hard limit
const DETAILS_FORM_ID = "profile-details";

type ProfileValues = { name: string; phone: string; locationText: string; description: string };

function toFormValues(user: {
  name?: string | null;
  phone?: string | null;
  locationText?: string | null;
  description?: string | null;
}): ProfileValues {
  return {
    name: user.name ?? "",
    phone: user.phone ?? "",
    locationText: user.locationText ?? "",
    description: user.description ?? "",
  };
}

function allowOnlyDigits(e: React.KeyboardEvent<HTMLInputElement>) {
  const allowed = ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End"];
  if (!allowed.includes(e.key) && !/^\d$/.test(e.key)) e.preventDefault();
}

// Same three destinations as Home.tsx's footer — that page redirects logged-in
// users straight to /feed, so this is the only place they can reach them.
const HELP_LINKS = [
  { label: "Email", icon: Mail, href: "https://mail.google.com/mail/?view=cm&to=jyofoodsharing@gmail.com&su=Jyo Support" },
  { label: "Instagram", icon: FaInstagram, href: "https://www.instagram.com/jyo_food_sharing" },
  { label: "GitHub", icon: FaGithub, href: "https://github.com/chandan-1427/jyo" },
];

// Underlined text action, dotted so it reads as an action rather than a
// heading. Used by the help links.
const ACTION_LINK =
  "inline-flex cursor-pointer items-center gap-2 rounded-sm text-[15px] font-medium underline decoration-dotted underline-offset-4 transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf disabled:cursor-default disabled:opacity-50";

const Optional = () => <span className="text-sm text-fg-subtle">Optional</span>;

// A headline number with its label. Plain text colours on purpose: the
// number is the point, and colour would suggest a status it doesn't have.
// The icons match the navbar's (My posts, My requests), so each tile points
// to where its items live.
//
// Phones: a compact row (icon and label on the left, number on the right),
// since three tiles side by side are too narrow and their labels wrap.
// Wider screens: two columns. The icon sits in the first, centred across
// both rows; the number and its label stack in the second.
// `order` arranges the phone row and is reset for the grid.
function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: number | undefined }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-canvas px-4 py-3 sm:grid sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-3 sm:gap-y-0.5 sm:p-4">
      <span className="flex text-fg-subtle [&>svg]:size-5 sm:row-span-2 sm:self-center sm:[&>svg]:size-6" aria-hidden="true">
        {icon}
      </span>
      <p className="order-2 ml-auto font-display text-xl font-semibold tabular-nums text-fg sm:order-none sm:ml-0 sm:text-3xl">
        {value ?? "–"}
      </p>
      <p className="order-1 text-sm leading-snug text-fg-muted sm:order-none">{label}</p>
    </div>
  );
}

// One saved detail, shown as text rather than an input: most visits are to
// check details, not change them.
function Detail({
  icon,
  label,
  value,
  className,
}: {
  icon: ReactNode;
  label: string;
  value?: string | null;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-3", className)}>
      <span className="mt-0.5 text-fg-subtle [&>svg]:size-[18px]" aria-hidden="true">{icon}</span>
      <div className="min-w-0">
        <dt className="text-sm text-fg-subtle">{label}</dt>
        <dd className={cn("mt-0.5 whitespace-pre-line break-words", value ? "text-fg" : "text-fg-subtle")}>
          {value || "Not added"}
        </dd>
      </div>
    </div>
  );
}

// Every card has the same shape, so actions are always in the same place:
// an optional icon beside the title, a line of context under it, an
// optional action at the top right, content, and a footer row (status on
// the left, the card's action on the right) separated by a faint line. The
// body grows so footers sit on the card's bottom edge when the grid
// stretches a card. Fields inside sit on the page colour so they stand out
// from the card.
function Card({
  title,
  description,
  icon,
  action,
  footer,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-2xl bg-raised ring-1 ring-inset ring-fg/[0.06] [--field-bg:var(--color-canvas)]",
        className
      )}
    >
      <div className={cn("flex-1 p-6 sm:p-7", icon && "grid grid-cols-[auto_minmax(0,1fr)] gap-x-4")}>
        {icon && <span className="mt-0.5 text-leaf [&>svg]:size-6" aria-hidden="true">{icon}</span>}
        <div>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="font-display text-xl font-semibold">{title}</h2>
              {description && <p className="mt-1.5 leading-relaxed text-fg-muted">{description}</p>}
            </div>
            {action && <div className="shrink-0">{action}</div>}
          </div>
          {children && <div className="mt-5">{children}</div>}
        </div>
      </div>
      {footer && (
        <div className="mx-6 flex items-center justify-between gap-4 border-t border-fg/[0.06] py-5 sm:mx-7">{footer}</div>
      )}
    </section>
  );
}

export default function Profile() {
  useV2Theme();
  const queryClient = useQueryClient();
  const { startDemo, stopDemo } = useAuth();

  const { data: profile, isLoading: loading } = useQuery({
    queryKey: authMeKey,
    queryFn: fetchAuthMe,
  });

  // Activity counts reuse My posts' and My requests' queries (same keys), so
  // they come from the same cache and update whenever those lists do.
  const { data: myPosts } = useQuery<{ posts: FoodPost[] }>({
    queryKey: ["posts", "mine"],
    queryFn: () => apiFetch("/posts/mine"),
  });
  const { data: myRequests } = useQuery<{ requests: PickupRequest[] }>({
    queryKey: ["requests", "mine"],
    queryFn: () => apiFetch("/requests/mine"),
  });
  const sharedCount = myPosts?.posts.length;
  const pickedUpCount = myPosts?.posts.filter((p) => p.status === "completed").length;
  const requestedCount = myRequests?.requests.length;

  // ─── Demo mode ────────────────────────────────────────────────────────────
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

  // ─── Details form ─────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    reset,
    setError,
    setFocus,
    formState: { errors, isDirty },
  } = useZodForm(profileSchema, { name: "", phone: "", locationText: "", description: "" });
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);

  // Details show as text until Edit is pressed. Editing always starts from
  // the saved values; reset() also makes them the "clean" values isDirty
  // compares against.
  const startEditing = () => {
    if (profile) reset(toFormValues(profile));
    setSaved(false);
    setEditing(true);
  };

  // Put the cursor in the first field, except on touch screens, where it
  // would pop the keyboard up over the form.
  useEffect(() => {
    if (editing && window.matchMedia("(pointer: fine)").matches) setFocus("name");
  }, [editing, setFocus]);

  const saveMutation = useMutation({
    mutationFn: (formData: ProfileValues) =>
      apiFetch("/users/me", { method: "PUT", body: JSON.stringify(formData) }),
    onSuccess: (data) => {
      queryClient.setQueryData(authMeKey, data.user);
      reset(toFormValues(data.user));
      setEditing(false);
      setSaved(true);
    },
    onError: (err) => {
      applyServerFieldErrors(err, setError, ["name", "phone", "locationText", "description"]);
    },
  });

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 3000);
    return () => clearTimeout(timer);
  }, [saved]);

  const onSubmit = handleSubmit((values) => {
    setSaved(false);
    saveMutation.mutate(values);
  });

  // Cancel drops any changes and errors and goes back to the saved details.
  const cancelEdits = () => {
    if (profile) reset(toFormValues(profile));
    saveMutation.reset();
    setEditing(false);
  };

  const saving = saveMutation.isPending;
  // Field-level server errors show under their fields; anything else above the form.
  const fieldLevel = Object.values(errors).some((e) => e?.type === "server");
  const saveError = !fieldLevel ? saveMutation.error?.message || "" : "";

  // ─── Photo ────────────────────────────────────────────────────────────────
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarError, setAvatarError] = useState("");

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
      setAvatarError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      setAvatarError("This photo is too big. Choose one under 5 MB.");
      return;
    }

    avatarUploadMutation.mutate(file);
  };

  const pickPhoto = () => avatarInputRef.current?.click();

  // Tapping the photo opens a small menu (Change / Remove). With no photo
  // yet there's only one thing to do, so it goes straight to choosing one.
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const photoMenuRef = useRef<HTMLDivElement>(null);
  const photoButtonRef = useRef<HTMLButtonElement>(null);
  const firstMenuItemRef = useRef<HTMLButtonElement>(null);

  const onPhotoClick = () => {
    if (profile?.avatarUrl) setPhotoMenuOpen((v) => !v);
    else pickPhoto();
  };

  // Close on a click outside or on Escape (handing focus back to the photo);
  // keyboard users land on the first option when it opens.
  useEffect(() => {
    if (!photoMenuOpen) return;
    firstMenuItemRef.current?.focus();
    const onPointer = (e: MouseEvent) => {
      if (!photoMenuRef.current?.contains(e.target as Node)) setPhotoMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setPhotoMenuOpen(false);
      photoButtonRef.current?.focus();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [photoMenuOpen]);

  const MENU_ITEM =
    "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-fg/[0.06] focus-visible:bg-fg/[0.06] focus-visible:outline-none";

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-fg-subtle">
        <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        <p className="text-sm">Loading your profile…</p>
      </div>
    );
  }

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div className="mx-auto max-w-screen-2xl text-fg">
      {/* Who you are, on a banner: a soft green wash deepening to the right,
          the pattern over it, and the content above both. Your name is the
          page title; "Profile" would only repeat the navbar. */}
      {/* Not overflow-hidden itself, so the photo menu can extend past the
          banner; only the pattern layer is clipped to the rounded corners. */}
      <header className="relative isolate z-10 rounded-2xl bg-[linear-gradient(100deg_in_oklab,var(--color-raised)_40%,oklch(0.2_0.035_160))] p-6 ring-1 ring-inset ring-fg/[0.06] sm:p-8">
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          <BannerPattern />
        </div>
        <div className="relative flex items-center gap-5 sm:gap-8">
          <div ref={photoMenuRef} className="relative w-fit shrink-0">
            <button
              ref={photoButtonRef}
              type="button"
              onClick={onPhotoClick}
              disabled={avatarBusy}
              aria-label={profile?.avatarUrl ? "Photo options" : "Add a photo"}
              aria-haspopup={profile?.avatarUrl ? "true" : undefined}
              aria-expanded={profile?.avatarUrl ? photoMenuOpen : undefined}
              className="relative block cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leaf disabled:cursor-default"
            >
              <Avatar
                name={profile?.name}
                src={profile?.avatarUrl}
                className="size-20 text-3xl ring-1 ring-fg/10 sm:size-36 sm:text-5xl"
              />
              {/* Always visible, so phones (no hover) can see the photo is changeable. */}
              <span className="absolute right-0.5 bottom-0.5 grid size-8 place-items-center rounded-full bg-lifted text-fg ring-[3px] ring-raised sm:size-10 sm:ring-4">
                {avatarBusy ? (
                  <Loader2 className="size-4 animate-spin sm:size-[18px]" aria-hidden="true" />
                ) : (
                  <Camera className="size-4 sm:size-[18px]" aria-hidden="true" />
                )}
              </span>
            </button>

            {/* Appears without animation: it's a quick, repeatable action. */}
            {photoMenuOpen && (
              <div className="absolute top-full left-0 z-30 mt-2 w-48 rounded-xl bg-lifted p-1 shadow-lift ring-1 ring-inset ring-fg/[0.08]">
                <button
                  ref={firstMenuItemRef}
                  type="button"
                  onClick={() => {
                    setPhotoMenuOpen(false);
                    pickPhoto();
                  }}
                  className={cn(MENU_ITEM, "text-fg")}
                >
                  <Camera className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
                  Change photo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPhotoMenuOpen(false);
                    avatarRemoveMutation.mutate();
                  }}
                  className={cn(MENU_ITEM, "text-danger")}
                >
                  <Trash2 className="size-4 shrink-0" aria-hidden="true" />
                  Remove photo
                </button>
              </div>
            )}
          </div>

          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-semibold sm:text-4xl">{profile?.name}</h1>
            {memberSince && <p className="mt-1 text-sm text-fg-muted sm:text-base">Member since {memberSince}</p>}
          </div>

          <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarSelect} className="hidden" />
          {/* The photo only shows a spinner while it works; say it in words too. */}
          <span role="status" className="sr-only">
            {avatarUploadMutation.isPending ? "Uploading photo" : avatarRemoveMutation.isPending ? "Removing photo" : ""}
          </span>
        </div>
      </header>
      {avatarError && <Notice tone="error" className="mt-5 max-w-xl">{avatarError}</Notice>}

      {/* Phones: one column in source order, Demo mode first. Desktop:
          Personal information is pinned to the left column across three
          rows, and the three smaller cards fill one row each on the right,
          so both columns end on the same line. */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Card
          title="Demo mode"
          className="lg:col-start-2 lg:row-start-1"
          icon={<FlaskConical />}
          description="Try Jyo with sample posts and requests. Nothing you do in demo mode is real."
          footer={
            <>
              <span className="inline-flex items-center gap-2 rounded-lg bg-lifted px-3 py-1.5 text-sm font-medium text-fg-muted">
                <span
                  className={cn("size-2 rounded-full", profile?.isDemo ? "bg-leaf" : "bg-fg-subtle")}
                  aria-hidden="true"
                />
                {profile?.isDemo ? "On" : "Off"}
              </span>
              <Button
                size="lg"
                variant={profile?.isDemo ? "outline" : "primary"}
                onClick={handleDemoToggle}
                loading={demoActionLoading}
                iconLeft={profile?.isDemo ? undefined : <Play className="size-[18px]" aria-hidden="true" />}
              >
                {demoActionLoading
                  ? profile?.isDemo ? "Ending…" : "Starting…"
                  : profile?.isDemo ? "Exit demo" : "Start demo"}
              </Button>
            </>
          }
        >
          {demoActionError && <Notice tone="error">{demoActionError}</Notice>}
        </Card>

        <Card
          title="Personal information"
          description="Your name is shown on the food you share with the community."
          className="lg:col-start-1 lg:row-span-3 lg:row-start-1"
          action={
            !editing ? (
              <div className="flex items-center gap-3">
                {/* "Saved" appears beside the button that led to it. */}
                <p role="status" className="text-sm">
                  {saved && (
                    <span className="flex items-center gap-1.5 font-medium text-leaf">
                      <Check className="size-4" aria-hidden="true" />
                      Saved
                    </span>
                  )}
                </p>
                <Button
                  variant="outline"
                  onClick={startEditing}
                  iconLeft={<Pencil className="size-4" aria-hidden="true" />}
                >
                  Edit
                </Button>
              </div>
            ) : (
              // Phones: a cancel (✕) button takes Edit's place, so the way out is where the
              // way in was. Wider screens keep Cancel beside Save below.
              <Button
                variant="outline"
                onClick={cancelEdits}
                disabled={saving}
                aria-label="Cancel editing"
                className="size-11 px-0 sm:hidden"
              >
                <X className="size-5" aria-hidden="true" />
              </Button>
            )
          }
          footer={
            !editing ? (
              <div className="w-full">
                <h3 className="text-sm font-medium text-fg-muted">Your activity on Jyo</h3>
                <div className="mt-3 grid gap-2 sm:grid-cols-3 sm:gap-3">
                  <Stat icon={<Package />} label="Food shared" value={sharedCount} />
                  <Stat icon={<PackageCheck />} label="Picked up from you" value={pickedUpCount} />
                  <Stat icon={<PackageOpen />} label="Food you asked for" value={requestedCount} />
                </div>
              </div>
            ) : (
              <>
                <span />
                <div className="flex gap-3">
                  <Button variant="outline" size="lg" onClick={cancelEdits} disabled={saving} className="hidden sm:inline-flex">
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    form={DETAILS_FORM_ID}
                    size="lg"
                    loading={saving}
                    disabled={!isDirty}
                    iconLeft={<Save className="size-[18px]" aria-hidden="true" />}
                  >
                    {saving ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </>
            )
          }
        >
          {!editing ? (
            <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
              <Detail icon={<UserRound />} label="Name" value={profile?.name} />
              <Detail icon={<Phone />} label="Phone number" value={profile?.phone} />
              <Detail icon={<MapPin />} label="Area" value={profile?.locationText} className="sm:col-span-2" />
              <Detail icon={<FileText />} label="About you" value={profile?.description} className="sm:col-span-2" />
            </dl>
          ) : (
            <>
              {saveError && <Notice tone="error" className="mb-5">{saveError}</Notice>}

              <form id={DETAILS_FORM_ID} onSubmit={onSubmit} noValidate className="grid gap-5 sm:grid-cols-2">
                <TextField
                  label="Name"
                  size="lg"
                  icon={<UserRound />}
                  autoComplete="name"
                  error={errors.name?.message}
                  {...register("name")}
                />
                <TextField
                  label="Phone number"
                  size="lg"
                  icon={<Phone />}
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  autoComplete="tel"
                  onKeyDown={allowOnlyDigits}
                  error={errors.phone?.message}
                  {...register("phone")}
                />
                <TextField
                  label="Area"
                  size="lg"
                  icon={<MapPin />}
                  placeholder="For example, Balaji Nagar"
                  labelAside={<Optional />}
                  error={errors.locationText?.message}
                  className="sm:col-span-2"
                  {...register("locationText")}
                />
                <TextAreaField
                  label="About you"
                  icon={<FileText />}
                  placeholder="A few words about yourself"
                  labelAside={<Optional />}
                  error={errors.description?.message}
                  className="sm:col-span-2"
                  {...register("description")}
                />
              </form>
            </>
          )}
        </Card>

        <Card
          title="Help & support"
          className="lg:col-start-2"
          icon={<CircleQuestionMark />}
          description="Questions or problems? Write to us."
        >
          <ul className="flex flex-wrap items-center gap-y-3">
            {HELP_LINKS.map(({ label, icon: Icon, href }, i) => (
              <li key={label} className="flex items-center">
                {i > 0 && <span className="mx-5 h-5 w-px bg-fg/15" aria-hidden="true" />}
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(ACTION_LINK, "text-fg decoration-leaf/50 hover:decoration-leaf")}
                >
                  <Icon className="size-[18px] shrink-0 text-leaf" aria-hidden="true" />
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          title="Account"
          className="lg:col-start-2"
          icon={<Settings />}
          description={
            <>
              Logged in as <span className="break-all font-semibold text-fg">{profile?.email}</span>
            </>
          }
          footer={
            <>
              <span />
              <LogoutButton />
            </>
          }
        />
      </div>
    </div>
  );
}

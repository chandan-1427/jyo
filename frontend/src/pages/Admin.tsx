import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Flag, HandHeart, LayoutDashboard, PanelLeftClose, PanelLeftOpen, Users, UtensilsCrossed } from "lucide-react";
import { apiFetch } from "@/lib/api/api";
import { useAuth } from "@/context/AuthContext";
import { useV2Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ActivityChart, type ActivityDay } from "@/components/admin/ActivityChart";
import { PeopleTable, ReportsTable } from "@/components/admin/Moderation";
import { StatCard } from "@/components/admin/StatCard";
import { QuietChartIllustration } from "@/components/admin/illustrations";
import NotFound from "./NotFound";

type Overview = {
  people: number;
  suspended: number;
  activePosts: number;
  openReports: number;
  pickups: number;
  mealsShared: number;
  last30Days: {
    people: { now: number; before: number };
    posts: { now: number; before: number };
    requests: { now: number; before: number };
  };
};

type Section = "overview" | "reports" | "people";
type Range = "7" | "30" | "90";

const SECTIONS: { value: Section; label: string; icon: typeof Flag }[] = [
  { value: "overview", label: "Overview", icon: LayoutDashboard },
  { value: "reports", label: "Reports", icon: Flag },
  { value: "people", label: "People", icon: Users },
];

const RANGES: { value: Range; label: string }[] = [
  { value: "90", label: "3 months" },
  { value: "30", label: "30 days" },
  { value: "7", label: "7 days" },
];

const stagger = (i: number) => ({ animationDelay: `${i * 50}ms` });

function ActivityCard({ style }: { style: CSSProperties }) {
  const [range, setRange] = useState<Range>("30");
  const { data } = useQuery<{ days: ActivityDay[] }>({
    queryKey: ["admin", "activity", range],
    queryFn: () => apiFetch(`/admin/activity?days=${range}`),
  });

  return (
    <section style={style} className="rounded-2xl bg-raised p-5 ring-1 ring-inset ring-fg/[0.06] motion-safe:animate-enter">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Posts and requests</h2>
          <p className="text-sm text-fg-subtle">Per day, in Indian time</p>
        </div>
        <SegmentedControl label="Time range" options={RANGES} value={range} onChange={setRange} />
      </div>
      {!data ? (
        <div className="h-[268px]" aria-hidden="true" />
      ) : data.days.some((d) => d.posts || d.requests) ? (
        <ActivityChart days={data.days} />
      ) : (
        <div className="flex h-[268px] flex-col items-center justify-center text-center motion-safe:animate-enter">
          <QuietChartIllustration className="w-32" />
          <p className="mt-3 font-display text-lg font-semibold">Quiet so far</p>
          <p className="mt-1 text-fg-muted">
            No posts or requests in the last {RANGES.find((r) => r.value === range)!.label}.
          </p>
        </div>
      )}
    </section>
  );
}

function OverviewSection({ overview }: { overview?: Overview }) {
  const recent = overview?.last30Days;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          style={stagger(0)}
          icon={<Flag />}
          label="Open reports"
          value={overview?.openReports}
          alert={!!overview?.openReports}
          note={overview?.openReports ? "Waiting for you" : "Nothing waiting"}
          detail={overview?.suspended === 1 ? "1 account suspended" : `${overview?.suspended ?? 0} accounts suspended`}
        />
        <StatCard
          style={stagger(1)}
          icon={<Users />}
          label="People"
          value={overview?.people}
          trend={recent?.people}
          note={`${recent?.people.now ?? 0} joined in the last 30 days`}
          detail="Demo samples left out"
        />
        <StatCard
          style={stagger(2)}
          icon={<UtensilsCrossed />}
          label="Posts, last 30 days"
          value={recent?.posts.now}
          trend={recent?.posts}
          note={`${overview?.activePosts ?? 0} on offer or being picked up`}
          detail={`${recent?.requests.now ?? 0} requests in the same 30 days`}
        />
        <StatCard
          style={stagger(3)}
          icon={<HandHeart />}
          label="Meals shared"
          value={overview?.mealsShared}
          note={`${overview?.pickups ?? 0} confirmed pickups`}
          detail="Only pickups someone confirmed"
        />
      </div>
      <ActivityCard style={stagger(4)} />
    </div>
  );
}

const SIDEBAR_KEY = "jyo.admin.sidebar";

// Open or closed, remembered on this browser only. Storage can be missing
// or refuse (private windows), in which case it simply starts open.
function useSidebar() {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) !== "closed";
    } catch {
      return true;
    }
  });
  const toggle = () =>
    setOpen((was) => {
      try {
        localStorage.setItem(SIDEBAR_KEY, was ? "closed" : "open");
      } catch {
        // Not remembered, still toggled.
      }
      return !was;
    });

  // Ctrl+B (Cmd+B on a Mac), as in most apps with a sidebar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "b" || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      e.preventDefault();
      toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return [open, toggle] as const;
}

// Jyo's admin portal: a sidebar on wide screens (collapsible to icons), a
// section switch on phones. Its own bundle (App.tsx loads it lazily), so nobody but an admin downloads
// it. The server refuses everyone else too; this only spares them the page.
export default function Admin() {
  useV2Theme();
  const { user } = useAuth();
  const [section, setSection] = useState<Section>("overview");
  const [sidebarOpen, toggleSidebar] = useSidebar();
  const fade = !sidebarOpen && "opacity-0";
  const { data: overview } = useQuery<Overview>({
    queryKey: ["admin", "overview"],
    queryFn: () => apiFetch("/admin/overview"),
    enabled: !!user?.isAdmin,
  });

  if (!user?.isAdmin) return <NotFound />;

  const current = SECTIONS.find((s) => s.value === section)!;

  return (
    <div
      style={{ "--sidebar-w": sidebarOpen ? "15rem" : "4.5rem" } as CSSProperties}
      className="min-h-dvh bg-canvas text-fg lg:grid lg:bg-(image:--admin-shell) lg:bg-fixed lg:grid-cols-[var(--sidebar-w)_minmax(0,1fr)] motion-safe:lg:transition-[grid-template-columns] motion-safe:lg:duration-300 motion-safe:lg:ease-[cubic-bezier(0.22,1,0.36,1)]"
    >
      {/* Collapsed, it's a strip of icons. Every icon stays where it was and
          the words fade and are clipped. They stay readable to screen
          readers, and each icon names itself on hover. */}
      <aside id="admin-sidebar" className="hidden overflow-hidden lg:sticky lg:top-0 lg:block lg:h-dvh">
        <div className="flex h-full flex-col gap-6 p-4">
          <div className={cn("flex items-baseline gap-2 pt-1 whitespace-nowrap transition-[padding]", sidebarOpen ? "px-2" : "justify-center px-0")}>
            <Logo className="font-display text-2xl text-fg [&>span]:text-leaf" />
            <span className={cn("text-sm text-fg-subtle transition-opacity", fade, !sidebarOpen && "hidden")}>Admin</span>
          </div>
          <nav aria-label="Admin" className="flex flex-col gap-1">
            {SECTIONS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setSection(value)}
                aria-current={section === value ? "page" : undefined}
                title={sidebarOpen ? undefined : label}
                className={cn(
                  "relative flex cursor-pointer items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-leaf",
                  section === value ? "bg-leaf/10 text-leaf" : "text-fg-muted hover:bg-fg/5 hover:text-fg"
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className={cn("whitespace-nowrap transition-opacity", fade)}>{label}</span>
                {value === "reports" && !!overview?.openReports && (
                  <span
                    className={cn("absolute top-2 left-6 size-2 rounded-full bg-danger transition-opacity", sidebarOpen && "opacity-0")}
                    aria-hidden="true"
                  />
                )}
                {value === "reports" && !!overview?.openReports && (
                  <span className="ml-auto rounded-full bg-danger/15 px-2 text-xs font-semibold text-danger tabular-nums">
                    {overview.openReports}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <Link
            to="/feed"
            title={sidebarOpen ? undefined : "Back to Jyo"}
            className="mt-auto flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-sm font-medium text-fg-muted transition-colors hover:bg-fg/5 hover:text-fg focus-visible:outline-2 focus-visible:outline-leaf"
          >
            <ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
            <span className={cn("whitespace-nowrap transition-opacity", fade)}>Back to Jyo</span>
          </Link>
        </div>
      </aside>

      <div className="min-w-0 lg:my-2 lg:mr-2 lg:min-h-[calc(100dvh-1rem)] lg:rounded-2xl lg:bg-(image:--admin-panel) lg:ring-1 lg:ring-fg/[0.06] lg:ring-inset">
        <header className="flex items-center justify-between gap-3 border-b border-fg/[0.06] px-4 py-3 lg:hidden">
          <div className="flex items-baseline gap-2">
            <Logo className="font-display text-2xl text-fg [&>span]:text-leaf" />
            <span className="text-sm text-fg-subtle">Admin</span>
          </div>
          <Link to="/feed" className="flex items-center gap-1.5 rounded-md text-sm font-medium text-fg-muted hover:text-fg">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Jyo
          </Link>
        </header>

        <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSidebar}
              aria-controls="admin-sidebar"
              aria-expanded={sidebarOpen}
              aria-keyshortcuts="Control+B"
              title={`${sidebarOpen ? "Close" : "Open"} sidebar (Ctrl+B)`}
              className="-ml-2 hidden size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-fg/5 hover:text-fg focus-visible:outline-2 focus-visible:outline-leaf lg:flex"
            >
              {sidebarOpen ? <PanelLeftClose className="size-4" aria-hidden="true" /> : <PanelLeftOpen className="size-4" aria-hidden="true" />}
              <span className="sr-only">Sidebar</span>
            </button>
            <SegmentedControl
              label="Section"
              options={SECTIONS.map((s) => ({
                value: s.value,
                label: s.value === "reports" && overview?.openReports ? `Reports (${overview.openReports})` : s.label,
              }))}
              value={section}
              onChange={setSection}
              className="lg:hidden"
            />
          </div>
          <h1 className="sr-only">Admin: {current.label}</h1>

          <div key={section} className={cn(section !== "overview" && "motion-safe:animate-enter")}>
            {section === "overview" && <OverviewSection overview={overview} />}
            {section === "reports" && <ReportsTable />}
            {section === "people" && <PeopleTable suspendedCount={overview?.suspended} />}
          </div>
        </main>
      </div>
    </div>
  );
}

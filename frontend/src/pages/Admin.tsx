import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Flag, HandHeart, LayoutDashboard, Users, UtensilsCrossed } from "lucide-react";
import { apiFetch } from "@/lib/api/api";
import { useAuth } from "@/context/AuthContext";
import { useV2Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ActivityChart, type ActivityDay } from "@/components/admin/ActivityChart";
import { PeopleTable, ReportsTable } from "@/components/admin/Moderation";
import { StatCard } from "@/components/admin/StatCard";
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

function ActivityCard() {
  const [range, setRange] = useState<Range>("30");
  const { data } = useQuery<{ days: ActivityDay[] }>({
    queryKey: ["admin", "activity", range],
    queryFn: () => apiFetch(`/admin/activity?days=${range}`),
  });

  return (
    <section className="rounded-2xl bg-raised p-5 ring-1 ring-inset ring-fg/[0.06]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Posts and requests</h2>
          <p className="text-sm text-fg-subtle">Per day, in Indian time</p>
        </div>
        <SegmentedControl label="Time range" options={RANGES} value={range} onChange={setRange} />
      </div>
      {data ? <ActivityChart days={data.days} /> : <div className="h-[268px]" aria-hidden="true" />}
    </section>
  );
}

function OverviewSection({ overview }: { overview?: Overview }) {
  const recent = overview?.last30Days;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Flag />}
          label="Open reports"
          value={overview?.openReports}
          alert={!!overview?.openReports}
          note={overview?.openReports ? "Waiting for you" : "Nothing waiting"}
          detail={overview?.suspended === 1 ? "1 account suspended" : `${overview?.suspended ?? 0} accounts suspended`}
        />
        <StatCard
          icon={<Users />}
          label="People"
          value={overview?.people}
          trend={recent?.people}
          note={`${recent?.people.now ?? 0} joined in the last 30 days`}
          detail="Demo samples left out"
        />
        <StatCard
          icon={<UtensilsCrossed />}
          label="Posts, last 30 days"
          value={recent?.posts.now}
          trend={recent?.posts}
          note={`${overview?.activePosts ?? 0} on offer or being picked up`}
          detail={`${recent?.requests.now ?? 0} requests in the same 30 days`}
        />
        <StatCard
          icon={<HandHeart />}
          label="Meals shared"
          value={overview?.mealsShared}
          note={`${overview?.pickups ?? 0} confirmed pickups`}
          detail="Only pickups someone confirmed"
        />
      </div>
      <ActivityCard />
    </div>
  );
}

// Jyo's admin portal: a sidebar on wide screens, a section switch on phones.
// Its own bundle (App.tsx loads it lazily), so nobody but an admin downloads
// it. The server refuses everyone else too; this only spares them the page.
export default function Admin() {
  useV2Theme();
  const { user } = useAuth();
  const [section, setSection] = useState<Section>("overview");
  const { data: overview } = useQuery<Overview>({
    queryKey: ["admin", "overview"],
    queryFn: () => apiFetch("/admin/overview"),
    enabled: !!user?.isAdmin,
  });

  if (!user?.isAdmin) return <NotFound />;

  const current = SECTIONS.find((s) => s.value === section)!;

  return (
    <div className="min-h-dvh bg-canvas text-fg lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="hidden border-r border-fg/[0.06] lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:gap-6 lg:p-4">
        <div className="flex items-baseline gap-2 px-2 pt-1">
          <Logo className="font-display text-2xl text-fg [&>span]:text-leaf" />
          <span className="text-sm text-fg-subtle">Admin</span>
        </div>
        <nav aria-label="Admin" className="flex flex-col gap-1">
          {SECTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setSection(value)}
              aria-current={section === value ? "page" : undefined}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-leaf",
                section === value ? "bg-lifted text-fg" : "text-fg-muted hover:bg-fg/5 hover:text-fg"
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {label}
              {value === "reports" && !!overview?.openReports && (
                <span className="ml-auto rounded-full bg-danger/15 px-2 text-xs font-semibold text-danger tabular-nums">
                  {overview.openReports}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-4">
          <Link
            to="/feed"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-fg-muted transition-colors hover:bg-fg/5 hover:text-fg focus-visible:outline-2 focus-visible:outline-leaf"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Jyo
          </Link>
          <div className="px-3 text-sm">
            <p className="truncate font-medium text-fg">{user.name}</p>
            <p className="truncate text-fg-subtle">{user.email}</p>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
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
          <SegmentedControl
            label="Section"
            options={SECTIONS.map((s) => ({
              value: s.value,
              label: s.value === "reports" && overview?.openReports ? `Reports (${overview.openReports})` : s.label,
            }))}
            value={section}
            onChange={setSection}
            className="self-start lg:hidden"
          />
          <h1 className="hidden font-display text-3xl font-semibold lg:block">{current.label}</h1>

          {section === "overview" && <OverviewSection overview={overview} />}
          {section === "reports" && <ReportsTable />}
          {section === "people" && <PeopleTable />}
        </main>
      </div>
    </div>
  );
}

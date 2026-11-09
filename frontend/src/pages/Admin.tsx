import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, Flag, HandHeart, PackageCheck, ShieldOff, Trash2, Users, UtensilsCrossed } from "lucide-react";
import { apiFetch } from "@/lib/api/api";
import { useAuth } from "@/context/AuthContext";
import { formatDate, formatDayTime } from "@/lib/format";
import { REPORT_REASONS } from "@/lib/safety";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useV2Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { PageHeader } from "@/components/ui/PageHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SearchField, TextAreaField } from "@/components/ui/TextField";
import NotFound from "./NotFound";

type Overview = {
  people: number;
  suspended: number;
  activePosts: number;
  openReports: number;
  pickups: number;
  mealsShared: number;
};

type Person = { id: string; name: string; email: string; suspendedAt: string | null; isDeleted: boolean };

type Report = {
  id: string;
  reason: string;
  details: string | null;
  postId: string | null;
  postTitle: string;
  postRemoved: boolean;
  createdAt: string;
  resolvedAt: string | null;
  reporter: { id: string; name: string; email: string };
  reported: Person;
  reportsAgainst: number;
};

type Account = Person & {
  phone: string;
  emailVerified: boolean;
  suspendedReason: string | null;
  createdAt: string;
  posts: number;
  requests: number;
  reportsAgainst: number;
  isAdmin: boolean;
};

const reasonLabel = (value: string) => REPORT_REASONS.find((r) => r.value === value)?.label ?? value;

function Tile({ icon, label, value, alert }: { icon: ReactNode; label: string; value: number | undefined; alert?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-raised px-4 py-3 ring-1 ring-inset ring-fg/[0.06]">
      <span className={cn("flex [&>svg]:size-5", alert ? "text-danger" : "text-fg-subtle")} aria-hidden="true">
        {icon}
      </span>
      <p className="text-sm text-fg-muted">{label}</p>
      <p className={cn("ml-auto font-display text-xl font-semibold tabular-nums", alert ? "text-danger" : "text-fg")}>
        {value ?? "–"}
      </p>
    </div>
  );
}

function Tag({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "danger" | "leaf" }) {
  return (
    <span
      className={cn(
        "rounded-md bg-lifted px-2 py-0.5 text-xs font-medium",
        tone === "danger" ? "text-danger" : tone === "leaf" ? "text-leaf" : "text-fg-muted"
      )}
    >
      {children}
    </span>
  );
}

function PersonLine({
  label,
  person,
  extra,
}: {
  label: string;
  person: { name: string; email: string; suspendedAt?: string | null; isDeleted?: boolean };
  extra?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-fg-subtle">{label}</p>
      <p className="flex flex-wrap items-center gap-1.5 text-sm text-fg">
        <span className="font-medium">{person.name}</span>
        <span className="break-all text-fg-muted">{person.email}</span>
        {person.suspendedAt && <Tag tone="danger">Suspended</Tag>}
        {person.isDeleted && <Tag>Deleted</Tag>}
        {extra}
      </p>
    </div>
  );
}

function useAdminAction() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["admin"] });
}

// Suspending asks for a reason, kept with the account for the record.
function SuspendDialog({ person, onClose }: { person: Person; onClose: () => void }) {
  const refresh = useAdminAction();
  const [reason, setReason] = useState("");
  const suspend = useMutation({
    mutationFn: () => apiFetch(`/admin/users/${person.id}/suspend`, { method: "POST", body: JSON.stringify({ reason }) }),
    onSuccess: () => {
      refresh();
      onClose();
    },
  });

  return (
    <Dialog
      title={`Suspend ${person.name}?`}
      description="They're signed out everywhere, can't log in, and their posts are hidden. You can undo this from People."
      onClose={onClose}
    >
      <div className="flex flex-col gap-5">
        {suspend.error && <Notice tone="error">{suspend.error.message}</Notice>}
        <TextAreaField
          label="Why? (only admins see this)"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Asked pickers for money"
        />
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={onClose} disabled={suspend.isPending}>
            Cancel
          </Button>
          <Button variant="dangerSolid" onClick={() => suspend.mutate()} loading={suspend.isPending}>
            {suspend.isPending ? "Suspending…" : "Suspend"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function ReportCard({ report }: { report: Report }) {
  const refresh = useAdminAction();
  const [dialog, setDialog] = useState<"remove" | "suspend" | "resolve" | null>(null);
  const canSuspend = !report.reported.suspendedAt && !report.reported.isDeleted;

  return (
    <li className="flex flex-col gap-4 rounded-2xl bg-raised p-5 ring-1 ring-inset ring-fg/[0.06]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium text-fg">
            <Flag className="size-4 shrink-0 text-danger" aria-hidden="true" />
            {reasonLabel(report.reason)}
          </p>
          <p className="mt-1 text-sm text-fg-muted">
            About{" "}
            {report.postId && !report.postRemoved ? (
              <Link to={`/posts/${report.postId}`} className="font-medium text-fg underline underline-offset-2">
                {report.postTitle}
              </Link>
            ) : (
              <span className="font-medium text-fg">{report.postTitle}</span>
            )}
            {report.postRemoved ? " (removed)" : !report.postId ? " (deleted by the poster)" : ""}
          </p>
        </div>
        <p className="text-sm text-fg-subtle tabular-nums">{formatDayTime(report.createdAt)}</p>
      </div>

      {report.details && (
        <blockquote className="rounded-xl bg-lifted px-4 py-3 leading-relaxed text-pretty text-fg">“{report.details}”</blockquote>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <PersonLine
          label="Reported"
          person={report.reported}
          extra={report.reportsAgainst > 1 && <Tag tone="danger">{report.reportsAgainst} reports</Tag>}
        />
        <PersonLine label="Reported by" person={report.reporter} />
      </div>

      {!report.resolvedAt ? (
        <div className="flex flex-wrap gap-2">
          {report.postId && !report.postRemoved && (
            <Button variant="danger" size="sm" onClick={() => setDialog("remove")} iconLeft={<Trash2 className="size-3.5" aria-hidden="true" />}>
              Remove post
            </Button>
          )}
          {canSuspend && (
            <Button variant="danger" size="sm" onClick={() => setDialog("suspend")} iconLeft={<Ban className="size-3.5" aria-hidden="true" />}>
              Suspend {report.reported.name}
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => setDialog("resolve")} iconLeft={<CheckCircle2 className="size-3.5" aria-hidden="true" />}>
            Mark resolved
          </Button>
        </div>
      ) : (
        <p className="text-sm text-fg-subtle">Resolved {formatDayTime(report.resolvedAt)}</p>
      )}

      {dialog === "remove" && (
        <ConfirmDialog
          title="Remove this post?"
          description={`“${report.postTitle}” disappears for everyone, including the person who shared it. This can't be undone from here.`}
          confirmLabel="Remove post"
          busyLabel="Removing…"
          tone="danger"
          cancelLabel="Cancel"
          onConfirm={async () => {
            await apiFetch(`/admin/posts/${report.postId}/remove`, { method: "POST" });
            refresh();
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "suspend" && <SuspendDialog person={report.reported} onClose={() => setDialog(null)} />}
      {dialog === "resolve" && (
        <ConfirmDialog
          title="Mark this report resolved?"
          description="It moves to Resolved. Do this once you've dealt with it, or decided nothing needs doing."
          confirmLabel="Mark resolved"
          busyLabel="Saving…"
          cancelLabel="Cancel"
          onConfirm={async () => {
            await apiFetch(`/admin/reports/${report.id}/resolve`, { method: "POST" });
            refresh();
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </li>
  );
}

function ReportsTab() {
  const [status, setStatus] = useState<"open" | "resolved">("open");
  const { data, isPending, error } = useQuery<{ reports: Report[] }>({
    queryKey: ["admin", "reports", status],
    queryFn: () => apiFetch(`/admin/reports?status=${status}`),
  });

  return (
    <div className="flex flex-col gap-5">
      <SegmentedControl
        label="Show reports"
        options={[
          { value: "open", label: "Open" },
          { value: "resolved", label: "Resolved" },
        ]}
        value={status}
        onChange={setStatus}
        className="self-start"
      />
      {error && <Notice tone="error">{error.message}</Notice>}
      {isPending ? (
        <p className="text-fg-subtle">Loading…</p>
      ) : !data?.reports.length ? (
        <EmptyState icon={<Flag />} title={status === "open" ? "No open reports" : "No resolved reports yet"}>
          <p>{status === "open" ? "New reports show up here and are emailed to REPORTS_EMAIL." : "Reports you resolve move here."}</p>
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.reports.map((r) => (
            <ReportCard key={r.id} report={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AccountRow({ account }: { account: Account }) {
  const refresh = useAdminAction();
  const [dialog, setDialog] = useState<"suspend" | "unsuspend" | null>(null);

  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-fg">{account.name}</span>
          {account.isAdmin && <Tag tone="leaf">Admin</Tag>}
          {account.suspendedAt && <Tag tone="danger">Suspended</Tag>}
          {account.isDeleted && <Tag>Deleted</Tag>}
          {!account.emailVerified && <Tag>Not verified</Tag>}
          {account.reportsAgainst > 0 && <Tag tone="danger">{account.reportsAgainst} reports</Tag>}
        </p>
        <p className="mt-0.5 break-all text-sm text-fg-muted">
          {account.email} <span className="tabular-nums">{account.phone}</span>
        </p>
        <p className="mt-0.5 text-[13px] text-fg-subtle tabular-nums">
          Joined {formatDate(account.createdAt)}. {account.posts} posts, {account.requests} requests.
        </p>
        {account.suspendedReason && <p className="mt-1 text-[13px] text-danger">Suspended: {account.suspendedReason}</p>}
      </div>
      {!account.isAdmin && !account.isDeleted && (
        <div className="shrink-0">
          {account.suspendedAt ? (
            <Button variant="outline" size="sm" onClick={() => setDialog("unsuspend")} iconLeft={<ShieldOff className="size-3.5" aria-hidden="true" />}>
              Unsuspend
            </Button>
          ) : (
            <Button variant="danger" size="sm" onClick={() => setDialog("suspend")} iconLeft={<Ban className="size-3.5" aria-hidden="true" />}>
              Suspend
            </Button>
          )}
        </div>
      )}
      {dialog === "suspend" && <SuspendDialog person={account} onClose={() => setDialog(null)} />}
      {dialog === "unsuspend" && (
        <ConfirmDialog
          title={`Unsuspend ${account.name}?`}
          description="They can log in again and their posts show again."
          confirmLabel="Unsuspend"
          busyLabel="Saving…"
          cancelLabel="Cancel"
          onConfirm={async () => {
            await apiFetch(`/admin/users/${account.id}/unsuspend`, { method: "POST" });
            refresh();
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </li>
  );
}

function PeopleTab() {
  const [search, setSearch] = useState("");
  const term = useDebouncedValue(search.trim(), 300);
  const { data, isPending, error } = useQuery<{ users: Account[] }>({
    queryKey: ["admin", "users", term],
    queryFn: () => apiFetch(`/admin/users${term ? `?search=${encodeURIComponent(term)}` : ""}`),
  });

  return (
    <div className="flex flex-col gap-5">
      <SearchField label="Search people" placeholder="Search by name or email" value={search} onChange={setSearch} className="sm:max-w-sm" />
      {error && <Notice tone="error">{error.message}</Notice>}
      {isPending ? (
        <p className="text-fg-subtle">Loading…</p>
      ) : !data?.users.length ? (
        <p className="text-fg-muted">Nobody matches.</p>
      ) : (
        <ul className="divide-y divide-fg/[0.06] rounded-2xl bg-raised p-5 ring-1 ring-inset ring-fg/[0.06]">
          {data.users.map((u) => (
            <AccountRow key={u.id} account={u} />
          ))}
        </ul>
      )}
      <p className="text-sm text-fg-subtle">Shows the 50 newest matches. Demo sample accounts are left out.</p>
    </div>
  );
}

export default function Admin() {
  useV2Theme();
  const { user } = useAuth();
  const [tab, setTab] = useState<"reports" | "people">("reports");
  const { data: overview } = useQuery<Overview>({
    queryKey: ["admin", "overview"],
    queryFn: () => apiFetch("/admin/overview"),
    enabled: !!user?.isAdmin,
  });

  // The server refuses everyone else too; this just doesn't show them a page.
  if (!user?.isAdmin) return <NotFound />;

  return (
    <div className="text-fg">
      <PageHeader title="Admin" subtitle="Reports, people, and how Jyo is doing." />

      <div className="mb-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Tile icon={<Flag />} label="Open reports" value={overview?.openReports} alert={!!overview?.openReports} />
        <Tile icon={<Users />} label="People" value={overview?.people} />
        <Tile icon={<UtensilsCrossed />} label="Active posts" value={overview?.activePosts} />
        <Tile icon={<PackageCheck />} label="Confirmed pickups" value={overview?.pickups} />
        <Tile icon={<HandHeart />} label="Meals shared" value={overview?.mealsShared} />
        <Tile icon={<Ban />} label="Suspended" value={overview?.suspended} />
      </div>

      <SegmentedControl
        label="Section"
        options={[
          { value: "reports", label: "Reports" },
          { value: "people", label: "People" },
        ]}
        value={tab}
        onChange={setTab}
        className="mb-6"
      />
      {tab === "reports" ? <ReportsTab /> : <PeopleTab />}
    </div>
  );
}

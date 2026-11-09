import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, Flag, ShieldOff, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api/api";
import { formatDate, formatDayTime } from "@/lib/format";
import { REPORT_REASONS } from "@/lib/safety";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog } from "@/components/ui/Dialog";
import { Notice } from "@/components/ui/Notice";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SearchField, TextAreaField } from "@/components/ui/TextField";
import { ActionMenu } from "./ActionMenu";

type Person = { id: string; name: string; email: string; suspendedAt?: string | null; isDeleted?: boolean };

type Report = {
  id: string;
  reason: string;
  details: string | null;
  postId: string | null;
  postTitle: string;
  postRemoved: boolean;
  createdAt: string;
  resolvedAt: string | null;
  reporter: Person;
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

function useRefreshAdmin() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["admin"] });
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

function PersonCell({ person, extra }: { person: Person; extra?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-medium text-fg">{person.name}</span>
        {person.suspendedAt && <Tag tone="danger">Suspended</Tag>}
        {person.isDeleted && <Tag>Deleted</Tag>}
        {extra}
      </div>
      <div className="truncate text-fg-muted">{person.email}</div>
    </div>
  );
}

// Suspending asks for a reason, kept with the account for the record.
function SuspendDialog({ person, onClose }: { person: Person; onClose: () => void }) {
  const refresh = useRefreshAdmin();
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
      description="They're signed out everywhere, can't log in, and their posts are hidden. You can undo this under People."
      onClose={onClose}
    >
      <div className="flex flex-col gap-5">
        {suspend.error && <Notice tone="error">{suspend.error.message}</Notice>}
        <TextAreaField
          label="Why? Only admins see this."
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

const TH = "px-4 py-3 text-left text-xs font-medium text-fg-subtle";
const TD = "px-4 py-3.5 align-top";

function TableFrame({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-raised ring-1 ring-inset ring-fg/[0.06]">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

function EmptyRow({ cols, children }: { cols: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-12 text-center text-fg-muted">
        {children}
      </td>
    </tr>
  );
}

export function ReportsTable() {
  const refresh = useRefreshAdmin();
  const [status, setStatus] = useState<"open" | "resolved">("open");
  const [action, setAction] = useState<{ kind: "remove" | "suspend" | "resolve"; report: Report } | null>(null);
  const { data, isPending, error } = useQuery<{ reports: Report[] }>({
    queryKey: ["admin", "reports", status],
    queryFn: () => apiFetch(`/admin/reports?status=${status}`),
  });

  return (
    <div className="flex flex-col gap-4">
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
      <TableFrame>
        <thead className="border-b border-fg/[0.06]">
          <tr>
            <th scope="col" className={TH}>Report</th>
            <th scope="col" className={TH}>Reported</th>
            <th scope="col" className={cn(TH, "hidden md:table-cell")}>By</th>
            <th scope="col" className={cn(TH, "hidden sm:table-cell")}>When</th>
            <th scope="col" className={cn(TH, "w-12")}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-fg/[0.06]">
          {isPending ? (
            <EmptyRow cols={5}>Loading…</EmptyRow>
          ) : !data?.reports.length ? (
            <EmptyRow cols={5}>{status === "open" ? "No open reports." : "No resolved reports yet."}</EmptyRow>
          ) : (
            data.reports.map((report) => (
              <tr key={report.id}>
                <td className={cn(TD, "min-w-56 max-w-96")}>
                  <p className="flex items-center gap-2 font-medium text-fg">
                    <Flag className="size-3.5 shrink-0 text-danger" aria-hidden="true" />
                    {reasonLabel(report.reason)}
                  </p>
                  <p className="mt-0.5 text-fg-muted">
                    {report.postId && !report.postRemoved ? (
                      <Link to={`/posts/${report.postId}`} className="underline underline-offset-2 hover:text-fg">
                        {report.postTitle}
                      </Link>
                    ) : (
                      report.postTitle
                    )}
                    {report.postRemoved ? " (removed)" : !report.postId ? " (deleted by poster)" : ""}
                  </p>
                  {report.details && <p className="mt-2 text-pretty text-fg">“{report.details}”</p>}
                </td>
                <td className={cn(TD, "min-w-44 max-w-64")}>
                  <PersonCell
                    person={report.reported}
                    extra={report.reportsAgainst > 1 && <Tag tone="danger">{report.reportsAgainst} reports</Tag>}
                  />
                </td>
                <td className={cn(TD, "hidden max-w-64 md:table-cell")}>
                  <PersonCell person={report.reporter} />
                </td>
                <td className={cn(TD, "hidden whitespace-nowrap text-fg-muted tabular-nums sm:table-cell")}>
                  {formatDayTime(report.createdAt)}
                </td>
                <td className={cn(TD, "py-2.5")}>
                  {!report.resolvedAt && (
                    <ActionMenu
                      label={`Actions for the report about ${report.postTitle}`}
                      actions={[
                        ...(report.postId && !report.postRemoved
                          ? [{ label: "Remove post", icon: <Trash2 />, danger: true, onSelect: () => setAction({ kind: "remove", report }) }]
                          : []),
                        ...(!report.reported.suspendedAt && !report.reported.isDeleted
                          ? [{ label: `Suspend ${report.reported.name}`, icon: <Ban />, danger: true, onSelect: () => setAction({ kind: "suspend", report }) }]
                          : []),
                        { label: "Mark resolved", icon: <CheckCircle2 />, onSelect: () => setAction({ kind: "resolve", report }) },
                      ]}
                    />
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableFrame>

      {action?.kind === "remove" && (
        <ConfirmDialog
          title="Remove this post?"
          description={`“${action.report.postTitle}” disappears for everyone, including the person who shared it.`}
          confirmLabel="Remove post"
          busyLabel="Removing…"
          tone="danger"
          cancelLabel="Cancel"
          onConfirm={async () => {
            await apiFetch(`/admin/posts/${action.report.postId}/remove`, { method: "POST" });
            refresh();
          }}
          onClose={() => setAction(null)}
        />
      )}
      {action?.kind === "suspend" && <SuspendDialog person={action.report.reported} onClose={() => setAction(null)} />}
      {action?.kind === "resolve" && (
        <ConfirmDialog
          title="Mark this report resolved?"
          description="It moves to Resolved. Do this once you've dealt with it, or decided nothing needs doing."
          confirmLabel="Mark resolved"
          busyLabel="Saving…"
          cancelLabel="Cancel"
          onConfirm={async () => {
            await apiFetch(`/admin/reports/${action.report.id}/resolve`, { method: "POST" });
            refresh();
          }}
          onClose={() => setAction(null)}
        />
      )}
    </div>
  );
}

export function PeopleTable() {
  const refresh = useRefreshAdmin();
  const [search, setSearch] = useState("");
  const term = useDebouncedValue(search.trim(), 300);
  const [action, setAction] = useState<{ kind: "suspend" | "unsuspend"; account: Account } | null>(null);
  const { data, isPending, error } = useQuery<{ users: Account[] }>({
    queryKey: ["admin", "users", term],
    queryFn: () => apiFetch(`/admin/users${term ? `?search=${encodeURIComponent(term)}` : ""}`),
  });

  return (
    <div className="flex flex-col gap-4">
      <SearchField label="Search people" placeholder="Search by name or email" value={search} onChange={setSearch} className="sm:max-w-sm" />
      {error && <Notice tone="error">{error.message}</Notice>}
      <TableFrame>
        <thead className="border-b border-fg/[0.06]">
          <tr>
            <th scope="col" className={TH}>Person</th>
            <th scope="col" className={cn(TH, "hidden lg:table-cell")}>Phone</th>
            <th scope="col" className={cn(TH, "hidden md:table-cell")}>Joined</th>
            <th scope="col" className={cn(TH, "text-right")}>Posts</th>
            <th scope="col" className={cn(TH, "hidden text-right sm:table-cell")}>Requests</th>
            <th scope="col" className={cn(TH, "text-right")}>Reports</th>
            <th scope="col" className={cn(TH, "w-12")}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-fg/[0.06]">
          {isPending ? (
            <EmptyRow cols={7}>Loading…</EmptyRow>
          ) : !data?.users.length ? (
            <EmptyRow cols={7}>Nobody matches.</EmptyRow>
          ) : (
            data.users.map((account) => (
              <tr key={account.id}>
                <td className={cn(TD, "min-w-48 max-w-72")}>
                  <PersonCell
                    person={account}
                    extra={
                      <>
                        {account.isAdmin && <Tag tone="leaf">Admin</Tag>}
                        {!account.emailVerified && <Tag>Not verified</Tag>}
                      </>
                    }
                  />
                  {account.suspendedReason && <p className="mt-1 text-xs text-danger">Suspended: {account.suspendedReason}</p>}
                </td>
                <td className={cn(TD, "hidden text-fg-muted tabular-nums lg:table-cell")}>{account.phone}</td>
                <td className={cn(TD, "hidden whitespace-nowrap text-fg-muted md:table-cell")}>{formatDate(account.createdAt)}</td>
                <td className={cn(TD, "text-right text-fg tabular-nums")}>{account.posts}</td>
                <td className={cn(TD, "hidden text-right text-fg tabular-nums sm:table-cell")}>{account.requests}</td>
                <td className={cn(TD, "text-right tabular-nums", account.reportsAgainst ? "text-danger" : "text-fg")}>
                  {account.reportsAgainst}
                </td>
                <td className={cn(TD, "py-2.5")}>
                  {!account.isAdmin && !account.isDeleted && (
                    <ActionMenu
                      label={`Actions for ${account.name}`}
                      actions={[
                        account.suspendedAt
                          ? { label: "Unsuspend", icon: <ShieldOff />, onSelect: () => setAction({ kind: "unsuspend", account }) }
                          : { label: "Suspend", icon: <Ban />, danger: true, onSelect: () => setAction({ kind: "suspend", account }) },
                      ]}
                    />
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableFrame>
      <p className="text-sm text-fg-subtle">The 50 newest matches. Demo sample accounts are left out.</p>

      {action?.kind === "suspend" && <SuspendDialog person={action.account} onClose={() => setAction(null)} />}
      {action?.kind === "unsuspend" && (
        <ConfirmDialog
          title={`Unsuspend ${action.account.name}?`}
          description="They can log in again and their posts show again."
          confirmLabel="Unsuspend"
          busyLabel="Saving…"
          cancelLabel="Cancel"
          onConfirm={async () => {
            await apiFetch(`/admin/users/${action.account.id}/unsuspend`, { method: "POST" });
            refresh();
          }}
          onClose={() => setAction(null)}
        />
      )}
    </div>
  );
}

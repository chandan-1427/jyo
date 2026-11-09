import * as React from "react"
import { Link } from "react-router-dom"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Ban, CheckCircle2, EllipsisVertical, Search, ShieldOff, Trash2 } from "lucide-react"

import { apiFetch } from "@/lib/api/api"
import { formatDate, formatDayTime } from "@/lib/format"
import { REPORT_REASONS } from "@/lib/safety"
import { useDebouncedValue } from "@/lib/useDebouncedValue"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/admin/ui/alert-dialog"
import { Badge } from "@/admin/ui/badge"
import { Button } from "@/admin/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/admin/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/admin/ui/dropdown-menu"
import { Input } from "@/admin/ui/input"
import { Label } from "@/admin/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/admin/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/admin/ui/tabs"
import { Textarea } from "@/admin/ui/textarea"

type Person = { id: string; name: string; email: string; suspendedAt?: string | null; isDeleted?: boolean }

type Report = {
  id: string
  reason: string
  details: string | null
  postId: string | null
  postTitle: string
  postRemoved: boolean
  createdAt: string
  resolvedAt: string | null
  reporter: Person
  reported: Person
  reportsAgainst: number
}

type Account = Person & {
  phone: string
  emailVerified: boolean
  suspendedReason: string | null
  createdAt: string
  posts: number
  requests: number
  reportsAgainst: number
  isAdmin: boolean
}

const reasonLabel = (value: string) => REPORT_REASONS.find((r) => r.value === value)?.label ?? value

function useRefreshAdmin() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: ["admin"] })
}

// "Are you sure?" for one action, showing why it failed if it does.
function ConfirmAction({
  title,
  description,
  confirmLabel,
  destructive,
  run,
  onClose,
}: {
  title: string
  description: string
  confirmLabel: string
  destructive?: boolean
  run: () => Promise<unknown>
  onClose: () => void
}) {
  const refresh = useRefreshAdmin()
  const action = useMutation({
    mutationFn: run,
    onSuccess: () => {
      refresh()
      onClose()
    },
  })
  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {action.error && <p className="ad:text-sm ad:text-destructive">{action.error.message}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={action.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? "destructive" : "default"}
            disabled={action.isPending}
            onClick={(e) => {
              e.preventDefault()
              action.mutate()
            }}
          >
            {action.isPending ? "Working…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// Suspending asks for a reason, kept with the account for the record.
function SuspendDialog({ person, onClose }: { person: Person; onClose: () => void }) {
  const refresh = useRefreshAdmin()
  const [reason, setReason] = React.useState("")
  const suspend = useMutation({
    mutationFn: () => apiFetch(`/admin/users/${person.id}/suspend`, { method: "POST", body: JSON.stringify({ reason }) }),
    onSuccess: () => {
      refresh()
      onClose()
    },
  })
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suspend {person.name}?</DialogTitle>
          <DialogDescription>
            They're signed out everywhere, can't log in, and their posts are hidden. You can undo this under People.
          </DialogDescription>
        </DialogHeader>
        <div className="ad:grid ad:gap-2">
          <Label htmlFor="suspend-reason">Why? Only admins see this.</Label>
          <Textarea
            id="suspend-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Asked pickers for money"
          />
          {suspend.error && <p className="ad:text-sm ad:text-destructive">{suspend.error.message}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={suspend.isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => suspend.mutate()} disabled={suspend.isPending}>
            {suspend.isPending ? "Suspending…" : "Suspend"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PersonCell({ person, extra }: { person: Person; extra?: React.ReactNode }) {
  return (
    <div className="ad:min-w-0">
      <div className="ad:flex ad:flex-wrap ad:items-center ad:gap-1.5">
        <span className="ad:font-medium">{person.name}</span>
        {person.suspendedAt && <Badge variant="destructive">Suspended</Badge>}
        {person.isDeleted && <Badge variant="secondary">Deleted</Badge>}
        {extra}
      </div>
      <div className="ad:truncate ad:text-muted-foreground">{person.email}</div>
    </div>
  )
}

const EmptyRow = ({ cols, children }: { cols: number; children: React.ReactNode }) => (
  <TableRow>
    <TableCell colSpan={cols} className="ad:h-24 ad:text-center ad:text-muted-foreground">
      {children}
    </TableCell>
  </TableRow>
)

const TableFrame = ({ children }: { children: React.ReactNode }) => (
  <div className="ad:overflow-hidden ad:rounded-lg ad:border">{children}</div>
)

export function ReportsTable() {
  const [status, setStatus] = React.useState<"open" | "resolved">("open")
  const [action, setAction] = React.useState<{ kind: "remove" | "suspend" | "resolve"; report: Report } | null>(null)
  const { data, isPending, error } = useQuery<{ reports: Report[] }>({
    queryKey: ["admin", "reports", status],
    queryFn: () => apiFetch(`/admin/reports?status=${status}`),
  })

  return (
    <div className="ad:flex ad:flex-col ad:gap-4">
      <Tabs value={status} onValueChange={(v) => setStatus(v as "open" | "resolved")}>
        <TabsList>
          <TabsTrigger value="open">Open</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
        </TabsList>
      </Tabs>
      {error && <p className="ad:text-sm ad:text-destructive">{error.message}</p>}
      <TableFrame>
        <Table>
          <TableHeader className="ad:bg-muted">
            <TableRow>
              <TableHead>Report</TableHead>
              <TableHead>Reported</TableHead>
              <TableHead className="ad:hidden ad:md:table-cell">By</TableHead>
              <TableHead className="ad:hidden ad:sm:table-cell">When</TableHead>
              <TableHead className="ad:w-10">
                <span className="ad:sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <EmptyRow cols={5}>Loading…</EmptyRow>
            ) : !data?.reports.length ? (
              <EmptyRow cols={5}>{status === "open" ? "No open reports." : "No resolved reports yet."}</EmptyRow>
            ) : (
              data.reports.map((report) => (
                <TableRow key={report.id} className="ad:align-top">
                  <TableCell className="ad:max-w-80 ad:whitespace-normal">
                    <div className="ad:font-medium">{reasonLabel(report.reason)}</div>
                    <div className="ad:text-muted-foreground">
                      {report.postId && !report.postRemoved ? (
                        <Link to={`/posts/${report.postId}`} className="ad:underline ad:underline-offset-2">
                          {report.postTitle}
                        </Link>
                      ) : (
                        report.postTitle
                      )}
                      {report.postRemoved ? " (removed)" : !report.postId ? " (deleted by poster)" : ""}
                    </div>
                    {report.details && <p className="ad:mt-1.5 ad:text-pretty">“{report.details}”</p>}
                  </TableCell>
                  <TableCell className="ad:max-w-56">
                    <PersonCell
                      person={report.reported}
                      extra={report.reportsAgainst > 1 && <Badge variant="outline">{report.reportsAgainst} reports</Badge>}
                    />
                  </TableCell>
                  <TableCell className="ad:hidden ad:max-w-56 ad:md:table-cell">
                    <PersonCell person={report.reporter} />
                  </TableCell>
                  <TableCell className="ad:hidden ad:text-muted-foreground ad:tabular-nums ad:sm:table-cell">
                    {formatDayTime(report.createdAt)}
                  </TableCell>
                  <TableCell>
                    {!report.resolvedAt && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="ad:size-8 ad:text-muted-foreground">
                            <EllipsisVertical />
                            <span className="ad:sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="ad:w-52">
                          {report.postId && !report.postRemoved && (
                            <DropdownMenuItem variant="destructive" onSelect={() => setAction({ kind: "remove", report })}>
                              <Trash2 /> Remove post
                            </DropdownMenuItem>
                          )}
                          {!report.reported.suspendedAt && !report.reported.isDeleted && (
                            <DropdownMenuItem variant="destructive" onSelect={() => setAction({ kind: "suspend", report })}>
                              <Ban /> Suspend {report.reported.name}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => setAction({ kind: "resolve", report })}>
                            <CheckCircle2 /> Mark resolved
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableFrame>

      {action?.kind === "remove" && (
        <ConfirmAction
          title="Remove this post?"
          description={`“${action.report.postTitle}” disappears for everyone, including the person who shared it.`}
          confirmLabel="Remove post"
          destructive
          run={() => apiFetch(`/admin/posts/${action.report.postId}/remove`, { method: "POST" })}
          onClose={() => setAction(null)}
        />
      )}
      {action?.kind === "suspend" && <SuspendDialog person={action.report.reported} onClose={() => setAction(null)} />}
      {action?.kind === "resolve" && (
        <ConfirmAction
          title="Mark this report resolved?"
          description="It moves to Resolved. Do this once you've dealt with it, or decided nothing needs doing."
          confirmLabel="Mark resolved"
          run={() => apiFetch(`/admin/reports/${action.report.id}/resolve`, { method: "POST" })}
          onClose={() => setAction(null)}
        />
      )}
    </div>
  )
}

export function PeopleTable() {
  const [search, setSearch] = React.useState("")
  const term = useDebouncedValue(search.trim(), 300)
  const [action, setAction] = React.useState<{ kind: "suspend" | "unsuspend"; account: Account } | null>(null)
  const { data, isPending, error } = useQuery<{ users: Account[] }>({
    queryKey: ["admin", "users", term],
    queryFn: () => apiFetch(`/admin/users${term ? `?search=${encodeURIComponent(term)}` : ""}`),
  })

  return (
    <div className="ad:flex ad:flex-col ad:gap-4">
      <div className="ad:relative ad:max-w-sm">
        <Search className="ad:pointer-events-none ad:absolute ad:top-1/2 ad:left-2.5 ad:size-4 ad:-translate-y-1/2 ad:text-muted-foreground" />
        <Input
          type="search"
          aria-label="Search people"
          placeholder="Search by name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ad:pl-8"
        />
      </div>
      {error && <p className="ad:text-sm ad:text-destructive">{error.message}</p>}
      <TableFrame>
        <Table>
          <TableHeader className="ad:bg-muted">
            <TableRow>
              <TableHead>Person</TableHead>
              <TableHead className="ad:hidden ad:lg:table-cell">Phone</TableHead>
              <TableHead className="ad:hidden ad:md:table-cell">Joined</TableHead>
              <TableHead className="ad:text-right">Posts</TableHead>
              <TableHead className="ad:hidden ad:text-right ad:sm:table-cell">Requests</TableHead>
              <TableHead className="ad:text-right">Reports</TableHead>
              <TableHead className="ad:w-10">
                <span className="ad:sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              <EmptyRow cols={7}>Loading…</EmptyRow>
            ) : !data?.users.length ? (
              <EmptyRow cols={7}>Nobody matches.</EmptyRow>
            ) : (
              data.users.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="ad:max-w-64">
                    <PersonCell
                      person={account}
                      extra={
                        <>
                          {account.isAdmin && <Badge>Admin</Badge>}
                          {!account.emailVerified && <Badge variant="outline">Not verified</Badge>}
                        </>
                      }
                    />
                    {account.suspendedReason && (
                      <div className="ad:mt-1 ad:text-xs ad:whitespace-normal ad:text-destructive">
                        Suspended: {account.suspendedReason}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="ad:hidden ad:tabular-nums ad:lg:table-cell">{account.phone}</TableCell>
                  <TableCell className="ad:hidden ad:text-muted-foreground ad:md:table-cell">
                    {formatDate(account.createdAt)}
                  </TableCell>
                  <TableCell className="ad:text-right ad:tabular-nums">{account.posts}</TableCell>
                  <TableCell className="ad:hidden ad:text-right ad:tabular-nums ad:sm:table-cell">{account.requests}</TableCell>
                  <TableCell className={"ad:text-right ad:tabular-nums" + (account.reportsAgainst ? " ad:text-destructive" : "")}>
                    {account.reportsAgainst}
                  </TableCell>
                  <TableCell>
                    {!account.isAdmin && !account.isDeleted && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="ad:size-8 ad:text-muted-foreground">
                            <EllipsisVertical />
                            <span className="ad:sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="ad:w-44">
                          {account.suspendedAt ? (
                            <DropdownMenuItem onSelect={() => setAction({ kind: "unsuspend", account })}>
                              <ShieldOff /> Unsuspend
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem variant="destructive" onSelect={() => setAction({ kind: "suspend", account })}>
                              <Ban /> Suspend
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableFrame>
      <p className="ad:text-sm ad:text-muted-foreground">The 50 newest matches. Demo sample accounts are left out.</p>

      {action?.kind === "suspend" && <SuspendDialog person={action.account} onClose={() => setAction(null)} />}
      {action?.kind === "unsuspend" && (
        <ConfirmAction
          title={`Unsuspend ${action.account.name}?`}
          description="They can log in again and their posts show again."
          confirmLabel="Unsuspend"
          run={() => apiFetch(`/admin/users/${action.account.id}/unsuspend`, { method: "POST" })}
          onClose={() => setAction(null)}
        />
      )}
    </div>
  )
}

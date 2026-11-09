import { TrendingDown, TrendingUp } from "lucide-react"

import { Badge } from "@/admin/ui/badge"
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/admin/ui/card"

export type Overview = {
  people: number
  suspended: number
  activePosts: number
  openReports: number
  pickups: number
  mealsShared: number
  last30Days: {
    people: { now: number; before: number }
    posts: { now: number; before: number }
    requests: { now: number; before: number }
  }
}

// "+25%" against the 30 days before; nothing when there's nothing to compare.
function Trend({ now, before }: { now: number; before: number }) {
  if (!before) return null
  const change = Math.round(((now - before) / before) * 100)
  const Icon = change >= 0 ? TrendingUp : TrendingDown
  return (
    <Badge variant="outline">
      <Icon />
      {change >= 0 ? "+" : ""}
      {change}%
    </Badge>
  )
}

function StatCard({
  label,
  value,
  trend,
  note,
  detail,
  alert,
}: {
  label: string
  value: number | undefined
  trend?: { now: number; before: number }
  note: string
  detail: string
  alert?: boolean
}) {
  return (
    <Card className="ad:@container/card">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle
          className={
            "ad:text-2xl ad:font-semibold ad:tabular-nums ad:@[250px]/card:text-3xl" + (alert ? " ad:text-destructive" : "")
          }
        >
          {value ?? "–"}
        </CardTitle>
        {trend && (
          <CardAction>
            <Trend {...trend} />
          </CardAction>
        )}
      </CardHeader>
      <CardFooter className="ad:flex-col ad:items-start ad:gap-1.5 ad:text-sm">
        <div className="ad:line-clamp-1 ad:font-medium">{note}</div>
        <div className="ad:text-muted-foreground">{detail}</div>
      </CardFooter>
    </Card>
  )
}

export function SectionCards({ overview }: { overview?: Overview }) {
  const recent = overview?.last30Days
  return (
    <div className="ad:grid ad:grid-cols-1 ad:gap-4 ad:px-4 ad:*:data-[slot=card]:bg-gradient-to-t ad:*:data-[slot=card]:from-primary/5 ad:*:data-[slot=card]:to-card ad:*:data-[slot=card]:shadow-xs ad:lg:px-6 ad:@xl/main:grid-cols-2 ad:@5xl/main:grid-cols-4">
      <StatCard
        label="Open reports"
        value={overview?.openReports}
        alert={!!overview?.openReports}
        note={overview?.openReports ? "Waiting for you" : "Nothing waiting"}
        detail={overview?.suspended === 1 ? "1 account suspended" : `${overview?.suspended ?? 0} accounts suspended`}
      />
      <StatCard
        label="People"
        value={overview?.people}
        trend={recent?.people}
        note={`${recent?.people.now ?? 0} joined in the last 30 days`}
        detail="Accounts not deleted, demo samples left out"
      />
      <StatCard
        label="Posts in the last 30 days"
        value={recent?.posts.now}
        trend={recent?.posts}
        note={`${overview?.activePosts ?? 0} on offer or being picked up now`}
        detail={`${recent?.requests.now ?? 0} requests in the same 30 days`}
      />
      <StatCard
        label="Meals shared"
        value={overview?.mealsShared}
        note={`${overview?.pickups ?? 0} confirmed pickups`}
        detail="Counting only pickups someone confirmed"
      />
    </div>
  )
}

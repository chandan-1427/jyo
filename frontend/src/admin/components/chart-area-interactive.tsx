import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import { apiFetch } from "@/lib/api/api"
import { useIsMobile } from "@/admin/hooks/use-mobile"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/admin/ui/card"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/admin/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/admin/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/admin/ui/toggle-group"

type Day = { date: string; posts: number; requests: number }
type Range = "7" | "30" | "90"

const RANGES: { value: Range; label: string }[] = [
  { value: "90", label: "Last 3 months" },
  { value: "30", label: "Last 30 days" },
  { value: "7", label: "Last 7 days" },
]

const chartConfig = {
  posts: { label: "Posts", color: "var(--chart-1)" },
  requests: { label: "Requests", color: "var(--chart-2)" },
} satisfies ChartConfig

// The dates are already Indian calendar days; read them as such.
const day = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { month: "short", day: "numeric" })

export function ChartAreaInteractive() {
  const isMobile = useIsMobile()
  // Until someone picks a range, phones start on the last week (a narrow
  // chart can't show 90 days) and wider screens on the last 3 months.
  const [picked, setRange] = React.useState<Range | null>(null)
  const range = picked ?? (isMobile ? "7" : "90")

  const { data } = useQuery<{ days: Day[] }>({
    queryKey: ["admin", "activity", range],
    queryFn: () => apiFetch(`/admin/activity?days=${range}`),
  })
  const days = data?.days ?? []
  const totals = days.reduce((t, d) => ({ posts: t.posts + d.posts, requests: t.requests + d.requests }), { posts: 0, requests: 0 })
  const label = RANGES.find((r) => r.value === range)!.label.toLowerCase()

  return (
    <Card className="ad:@container/card">
      <CardHeader>
        <CardTitle>Posts and requests</CardTitle>
        <CardDescription className="ad:tabular-nums">
          {totals.posts} posts and {totals.requests} requests in the {label}
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={range}
            onValueChange={(v) => v && setRange(v as Range)}
            variant="outline"
            className="ad:hidden ad:*:data-[slot=toggle-group-item]:px-4! ad:@[767px]/card:flex"
          >
            {RANGES.map((r) => (
              <ToggleGroupItem key={r.value} value={r.value}>
                {r.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Select value={range} onValueChange={(v) => setRange(v as Range)}>
            <SelectTrigger
              className="ad:flex ad:w-40 ad:**:data-[slot=select-value]:block ad:**:data-[slot=select-value]:truncate ad:@[767px]/card:hidden"
              size="sm"
              aria-label="Time range"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="ad:rounded-xl">
              {RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value} className="ad:rounded-lg">
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="ad:px-2 ad:pt-4 ad:sm:px-6 ad:sm:pt-6">
        <ChartContainer config={chartConfig} className="ad:aspect-auto ad:h-[250px] ad:w-full">
          <AreaChart data={days}>
            <defs>
              <linearGradient id="fillPosts" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-posts)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-posts)" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="fillRequests" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-requests)" stopOpacity={0.6} />
                <stop offset="95%" stopColor="var(--color-requests)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} tickFormatter={day} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent labelFormatter={(value) => day(String(value))} indicator="dot" />}
            />
            <Area dataKey="requests" type="monotone" fill="url(#fillRequests)" stroke="var(--color-requests)" isAnimationActive={false} />
            <Area dataKey="posts" type="monotone" fill="url(#fillPosts)" stroke="var(--color-posts)" isAnimationActive={false} />
            <ChartLegend content={<ChartLegendContent />} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

import { Flag, LayoutDashboard, Users, type LucideIcon } from "lucide-react"

export type Section = "overview" | "reports" | "people"

export const SECTIONS: { value: Section; title: string; icon: LucideIcon }[] = [
  { value: "overview", title: "Overview", icon: LayoutDashboard },
  { value: "reports", title: "Reports", icon: Flag },
  { value: "people", title: "People", icon: Users },
]

import * as React from "react"
import { Link } from "react-router-dom"
import { ArrowLeft } from "lucide-react"

import { SECTIONS, type Section } from "@/admin/lib/sections"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/admin/ui/sidebar"

export function AppSidebar({
  section,
  onSection,
  openReports,
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  section: Section
  onSection: (section: Section) => void
  openReports?: number
  user: { name: string; email: string }
}) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="ad:flex ad:items-baseline ad:gap-2 ad:px-2 ad:py-1.5">
              <span className="ad:font-[Anek_Telugu_Variable] ad:text-2xl ad:font-semibold">
                Jyo<span className="ad:text-primary">.</span>
              </span>
              <span className="ad:text-sm ad:text-muted-foreground">Admin</span>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {SECTIONS.map((item) => (
                <SidebarMenuItem key={item.value}>
                  <SidebarMenuButton
                    tooltip={item.title}
                    isActive={section === item.value}
                    onClick={() => onSection(item.value)}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                  {item.value === "reports" && !!openReports && (
                    <SidebarMenuBadge className="ad:text-destructive">{openReports}</SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="ad:mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link to="/feed">
                    <ArrowLeft />
                    <span>Back to Jyo</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="ad:grid ad:px-2 ad:py-1.5 ad:text-left ad:text-sm ad:leading-tight">
          <span className="ad:truncate ad:font-medium">{user.name}</span>
          <span className="ad:truncate ad:text-xs ad:text-muted-foreground">{user.email}</span>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

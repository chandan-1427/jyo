import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import "@/admin/admin.css";
import { apiFetch } from "@/lib/api/api";
import { useAuth } from "@/context/AuthContext";
import { AppSidebar } from "@/admin/components/app-sidebar";
import { SECTIONS, type Section } from "@/admin/lib/sections";
import { ChartAreaInteractive } from "@/admin/components/chart-area-interactive";
import { PeopleTable, ReportsTable } from "@/admin/components/moderation";
import { SectionCards, type Overview } from "@/admin/components/section-cards";
import { SiteHeader } from "@/admin/components/site-header";
import { SidebarInset, SidebarProvider } from "@/admin/ui/sidebar";
import { TooltipProvider } from "@/admin/ui/tooltip";
import NotFound from "./NotFound";

// The admin portal: shadcn's dashboard-01 layout, in its own prefixed
// Tailwind build (admin/admin.css) and its own bundle, so none of it reaches
// the rest of Jyo. The server refuses non-admins too; this only spares them
// the page.
export default function Admin() {
  const { user } = useAuth();
  const [section, setSection] = React.useState<Section>("overview");
  const { data: overview } = useQuery<Overview>({
    queryKey: ["admin", "overview"],
    queryFn: () => apiFetch("/admin/overview"),
    enabled: !!user?.isAdmin,
  });

  if (!user?.isAdmin) return <NotFound />;

  const title = SECTIONS.find((s) => s.value === section)!.title;

  return (
    <div className="jyo-admin ad:min-h-svh ad:bg-background ad:font-sans ad:text-foreground ad:antialiased">
      <TooltipProvider>
        <SidebarProvider
          style={{ "--sidebar-width": "16rem", "--header-height": "3rem" } as React.CSSProperties}
        >
          <AppSidebar
            variant="inset"
            section={section}
            onSection={setSection}
            openReports={overview?.openReports}
            user={{ name: user.name, email: user.email }}
          />
          <SidebarInset>
            <SiteHeader title={title} />
            <div className="ad:@container/main ad:flex ad:flex-1 ad:flex-col ad:gap-2">
              <div className="ad:flex ad:flex-col ad:gap-4 ad:py-4 ad:md:gap-6 ad:md:py-6">
                {section === "overview" && (
                  <>
                    <SectionCards overview={overview} />
                    <div className="ad:px-4 ad:lg:px-6">
                      <ChartAreaInteractive />
                    </div>
                  </>
                )}
                {section === "reports" && (
                  <div className="ad:px-4 ad:lg:px-6">
                    <ReportsTable />
                  </div>
                )}
                {section === "people" && (
                  <div className="ad:px-4 ad:lg:px-6">
                    <PeopleTable />
                  </div>
                )}
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </div>
  );
}

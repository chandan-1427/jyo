import { Separator } from "@/admin/ui/separator"
import { SidebarTrigger } from "@/admin/ui/sidebar"

export function SiteHeader({ title }: { title: string }) {
  return (
    <header className="ad:flex ad:h-(--header-height) ad:shrink-0 ad:items-center ad:gap-2 ad:border-b ad:transition-[width,height] ad:ease-linear ad:group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="ad:flex ad:w-full ad:items-center ad:gap-1 ad:px-4 ad:lg:gap-2 ad:lg:px-6">
        <SidebarTrigger className="ad:-ml-1" />
        <Separator orientation="vertical" className="ad:mx-2 ad:data-[orientation=vertical]:h-4" />
        <h1 className="ad:text-base ad:font-medium">{title}</h1>
      </div>
    </header>
  )
}

"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/admin/lib/utils"
import { PanelLeftIcon } from "lucide-react"
import { Slot } from "radix-ui"

import { useIsMobile } from "@/admin/hooks/use-mobile"
import { Button } from "@/admin/ui/button"
import { Input } from "@/admin/ui/input"
import { Separator } from "@/admin/ui/separator"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/admin/ui/sheet"
import { Skeleton } from "@/admin/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/admin/ui/tooltip"

const SIDEBAR_COOKIE_NAME = "sidebar_state"
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
const SIDEBAR_WIDTH = "16rem"
const SIDEBAR_WIDTH_MOBILE = "18rem"
const SIDEBAR_WIDTH_ICON = "3rem"
const SIDEBAR_KEYBOARD_SHORTCUT = "b"

type SidebarContextProps = {
  state: "expanded" | "collapsed"
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

const SidebarContext = React.createContext<SidebarContextProps | null>(null)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }

  return context
}

function SidebarProvider({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const isMobile = useIsMobile()
  const [openMobile, setOpenMobile] = React.useState(false)

  // This is the internal state of the sidebar.
  // We use openProp and setOpenProp for control from outside the component.
  const [_open, _setOpen] = React.useState(defaultOpen)
  const open = openProp ?? _open
  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === "function" ? value(open) : value
      if (setOpenProp) {
        setOpenProp(openState)
      } else {
        _setOpen(openState)
      }

      // This sets the cookie to keep the sidebar state.
      document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`
    },
    [setOpenProp, open]
  )

  // Helper to toggle the sidebar.
  const toggleSidebar = React.useCallback(() => {
    return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open)
  }, [isMobile, setOpen, setOpenMobile])

  // Adds a keyboard shortcut to toggle the sidebar.
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault()
        toggleSidebar()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [toggleSidebar])

  // We add a state so that we can do data-state="expanded" or "collapsed".
  // This makes it easier to style the sidebar with Tailwind classes.
  const state = open ? "expanded" : "collapsed"

  const contextValue = React.useMemo<SidebarContextProps>(
    () => ({
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
    }),
    [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar]
  )

  return (
    <SidebarContext.Provider value={contextValue}>
      <TooltipProvider delayDuration={0}>
        <div
          data-slot="sidebar-wrapper"
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH,
              "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
              ...style,
            } as React.CSSProperties
          }
          className={cn(
            "ad:group/sidebar-wrapper ad:flex ad:min-h-svh ad:w-full ad:has-data-[variant=inset]:bg-sidebar",
            className
          )}
          {...props}
        >
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  )
}

function Sidebar({
  side = "left",
  variant = "sidebar",
  collapsible = "offcanvas",
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  side?: "left" | "right"
  variant?: "sidebar" | "floating" | "inset"
  collapsible?: "offcanvas" | "icon" | "none"
}) {
  const { isMobile, state, openMobile, setOpenMobile } = useSidebar()

  if (collapsible === "none") {
    return (
      <div
        data-slot="sidebar"
        className={cn(
          "ad:flex ad:h-full ad:w-(--sidebar-width) ad:flex-col ad:bg-sidebar ad:text-sidebar-foreground",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
        <SheetContent
          data-sidebar="sidebar"
          data-slot="sidebar"
          data-mobile="true"
          className="ad:w-(--sidebar-width) ad:bg-sidebar ad:p-0 ad:text-sidebar-foreground ad:[&>button]:hidden"
          style={
            {
              "--sidebar-width": SIDEBAR_WIDTH_MOBILE,
            } as React.CSSProperties
          }
          side={side}
        >
          <SheetHeader className="ad:sr-only">
            <SheetTitle>Sidebar</SheetTitle>
            <SheetDescription>Displays the mobile sidebar.</SheetDescription>
          </SheetHeader>
          <div className="ad:flex ad:h-full ad:w-full ad:flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <div
      className="ad:group ad:peer ad:hidden ad:text-sidebar-foreground ad:md:block"
      data-state={state}
      data-collapsible={state === "collapsed" ? collapsible : ""}
      data-variant={variant}
      data-side={side}
      data-slot="sidebar"
    >
      {/* This is what handles the sidebar gap on desktop */}
      <div
        data-slot="sidebar-gap"
        className={cn(
          "ad:relative ad:w-(--sidebar-width) ad:bg-transparent ad:transition-[width] ad:duration-200 ad:ease-linear",
          "ad:group-data-[collapsible=offcanvas]:w-0",
          "ad:group-data-[side=right]:rotate-180",
          variant === "floating" || variant === "inset"
            ? "ad:group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]"
            : "ad:group-data-[collapsible=icon]:w-(--sidebar-width-icon)"
        )}
      />
      <div
        data-slot="sidebar-container"
        className={cn(
          "ad:fixed ad:inset-y-0 ad:z-10 ad:hidden ad:h-svh ad:w-(--sidebar-width) ad:transition-[left,right,width] ad:duration-200 ad:ease-linear ad:md:flex",
          side === "left"
            ? "ad:left-0 ad:group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
            : "ad:right-0 ad:group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
          // Adjust the padding for floating and inset variants.
          variant === "floating" || variant === "inset"
            ? "ad:p-2 ad:group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]"
            : "ad:group-data-[collapsible=icon]:w-(--sidebar-width-icon) ad:group-data-[side=left]:border-r ad:group-data-[side=right]:border-l",
          className
        )}
        {...props}
      >
        <div
          data-sidebar="sidebar"
          data-slot="sidebar-inner"
          className="ad:flex ad:h-full ad:w-full ad:flex-col ad:bg-sidebar ad:group-data-[variant=floating]:rounded-lg ad:group-data-[variant=floating]:border ad:group-data-[variant=floating]:border-sidebar-border ad:group-data-[variant=floating]:shadow-sm"
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function SidebarTrigger({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      variant="ghost"
      size="icon"
      className={cn("ad:size-7", className)}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <PanelLeftIcon />
      <span className="ad:sr-only">Toggle Sidebar</span>
    </Button>
  )
}

function SidebarRail({ className, ...props }: React.ComponentProps<"button">) {
  const { toggleSidebar } = useSidebar()

  return (
    <button
      data-sidebar="rail"
      data-slot="sidebar-rail"
      aria-label="Toggle Sidebar"
      tabIndex={-1}
      onClick={toggleSidebar}
      title="Toggle Sidebar"
      className={cn(
        "ad:absolute ad:inset-y-0 ad:z-20 ad:hidden ad:w-4 ad:-translate-x-1/2 ad:transition-all ad:ease-linear ad:group-data-[side=left]:-right-4 ad:group-data-[side=right]:left-0 ad:after:absolute ad:after:inset-y-0 ad:after:left-1/2 ad:after:w-[2px] ad:hover:after:bg-sidebar-border ad:sm:flex",
        "ad:in-data-[side=left]:cursor-w-resize ad:in-data-[side=right]:cursor-e-resize",
        "ad:[[data-side=left][data-state=collapsed]_&]:cursor-e-resize ad:[[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
        "ad:group-data-[collapsible=offcanvas]:translate-x-0 ad:group-data-[collapsible=offcanvas]:after:left-full ad:hover:group-data-[collapsible=offcanvas]:bg-sidebar",
        "ad:[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
        "ad:[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
        className
      )}
      {...props}
    />
  )
}

function SidebarInset({ className, ...props }: React.ComponentProps<"main">) {
  return (
    <main
      data-slot="sidebar-inset"
      className={cn(
        "ad:relative ad:flex ad:w-full ad:flex-1 ad:flex-col ad:bg-background",
        "ad:md:peer-data-[variant=inset]:m-2 ad:md:peer-data-[variant=inset]:ml-0 ad:md:peer-data-[variant=inset]:rounded-xl ad:md:peer-data-[variant=inset]:shadow-sm ad:md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2",
        className
      )}
      {...props}
    />
  )
}

function SidebarInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  return (
    <Input
      data-slot="sidebar-input"
      data-sidebar="input"
      className={cn("ad:h-8 ad:w-full ad:bg-background ad:shadow-none", className)}
      {...props}
    />
  )
}

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-header"
      data-sidebar="header"
      className={cn("ad:flex ad:flex-col ad:gap-2 ad:p-2", className)}
      {...props}
    />
  )
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      data-sidebar="footer"
      className={cn("ad:flex ad:flex-col ad:gap-2 ad:p-2", className)}
      {...props}
    />
  )
}

function SidebarSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="sidebar-separator"
      data-sidebar="separator"
      className={cn("ad:mx-2 ad:w-auto ad:bg-sidebar-border", className)}
      {...props}
    />
  )
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      data-sidebar="content"
      className={cn(
        "ad:flex ad:min-h-0 ad:flex-1 ad:flex-col ad:gap-2 ad:overflow-auto ad:group-data-[collapsible=icon]:overflow-hidden",
        className
      )}
      {...props}
    />
  )
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group"
      data-sidebar="group"
      className={cn("ad:relative ad:flex ad:w-full ad:min-w-0 ad:flex-col ad:p-2", className)}
      {...props}
    />
  )
}

function SidebarGroupLabel({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "div"

  return (
    <Comp
      data-slot="sidebar-group-label"
      data-sidebar="group-label"
      className={cn(
        "ad:flex ad:h-8 ad:shrink-0 ad:items-center ad:rounded-md ad:px-2 ad:text-xs ad:font-medium ad:text-sidebar-foreground/70 ad:ring-sidebar-ring ad:outline-hidden ad:transition-[margin,opacity] ad:duration-200 ad:ease-linear ad:focus-visible:ring-2 ad:[&>svg]:size-4 ad:[&>svg]:shrink-0",
        "ad:group-data-[collapsible=icon]:-mt-8 ad:group-data-[collapsible=icon]:opacity-0",
        className
      )}
      {...props}
    />
  )
}

function SidebarGroupAction({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="sidebar-group-action"
      data-sidebar="group-action"
      className={cn(
        "ad:absolute ad:top-3.5 ad:right-3 ad:flex ad:aspect-square ad:w-5 ad:items-center ad:justify-center ad:rounded-md ad:p-0 ad:text-sidebar-foreground ad:ring-sidebar-ring ad:outline-hidden ad:transition-transform ad:hover:bg-sidebar-accent ad:hover:text-sidebar-accent-foreground ad:focus-visible:ring-2 ad:[&>svg]:size-4 ad:[&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "ad:after:absolute ad:after:-inset-2 ad:md:after:hidden",
        "ad:group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
}

function SidebarGroupContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group-content"
      data-sidebar="group-content"
      className={cn("ad:w-full ad:text-sm", className)}
      {...props}
    />
  )
}

function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu"
      data-sidebar="menu"
      className={cn("ad:flex ad:w-full ad:min-w-0 ad:flex-col ad:gap-1", className)}
      {...props}
    />
  )
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-item"
      data-sidebar="menu-item"
      className={cn("ad:group/menu-item ad:relative", className)}
      {...props}
    />
  )
}

const sidebarMenuButtonVariants = cva(
  "ad:peer/menu-button ad:flex ad:w-full ad:items-center ad:gap-2 ad:overflow-hidden ad:rounded-md ad:p-2 ad:text-left ad:text-sm ad:ring-sidebar-ring ad:outline-hidden ad:transition-[width,height,padding] ad:group-has-data-[sidebar=menu-action]/menu-item:pr-8 ad:group-data-[collapsible=icon]:size-8! ad:group-data-[collapsible=icon]:p-2! ad:hover:bg-sidebar-accent ad:hover:text-sidebar-accent-foreground ad:focus-visible:ring-2 ad:active:bg-sidebar-accent ad:active:text-sidebar-accent-foreground ad:disabled:pointer-events-none ad:disabled:opacity-50 ad:aria-disabled:pointer-events-none ad:aria-disabled:opacity-50 ad:data-[active=true]:bg-sidebar-accent ad:data-[active=true]:font-medium ad:data-[active=true]:text-sidebar-accent-foreground ad:data-[state=open]:hover:bg-sidebar-accent ad:data-[state=open]:hover:text-sidebar-accent-foreground ad:[&>span:last-child]:truncate ad:[&>svg]:size-4 ad:[&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "ad:hover:bg-sidebar-accent ad:hover:text-sidebar-accent-foreground",
        outline:
          "ad:bg-background ad:shadow-[0_0_0_1px_var(--sidebar-border)] ad:hover:bg-sidebar-accent ad:hover:text-sidebar-accent-foreground ad:hover:shadow-[0_0_0_1px_var(--sidebar-accent)]",
      },
      size: {
        default: "ad:h-8 ad:text-sm",
        sm: "ad:h-7 ad:text-xs",
        lg: "ad:h-12 ad:text-sm ad:group-data-[collapsible=icon]:p-0!",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function SidebarMenuButton({
  asChild = false,
  isActive = false,
  variant = "default",
  size = "default",
  tooltip,
  className,
  ...props
}: React.ComponentProps<"button"> & {
  asChild?: boolean
  isActive?: boolean
  tooltip?: string | React.ComponentProps<typeof TooltipContent>
} & VariantProps<typeof sidebarMenuButtonVariants>) {
  const Comp = asChild ? Slot.Root : "button"
  const { isMobile, state } = useSidebar()

  const button = (
    <Comp
      data-slot="sidebar-menu-button"
      data-sidebar="menu-button"
      data-size={size}
      data-active={isActive}
      className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
      {...props}
    />
  )

  if (!tooltip) {
    return button
  }

  if (typeof tooltip === "string") {
    tooltip = {
      children: tooltip,
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent
        side="right"
        align="center"
        hidden={state !== "collapsed" || isMobile}
        {...tooltip}
      />
    </Tooltip>
  )
}

function SidebarMenuAction({
  className,
  asChild = false,
  showOnHover = false,
  ...props
}: React.ComponentProps<"button"> & {
  asChild?: boolean
  showOnHover?: boolean
}) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="sidebar-menu-action"
      data-sidebar="menu-action"
      className={cn(
        "ad:absolute ad:top-1.5 ad:right-1 ad:flex ad:aspect-square ad:w-5 ad:items-center ad:justify-center ad:rounded-md ad:p-0 ad:text-sidebar-foreground ad:ring-sidebar-ring ad:outline-hidden ad:transition-transform ad:peer-hover/menu-button:text-sidebar-accent-foreground ad:hover:bg-sidebar-accent ad:hover:text-sidebar-accent-foreground ad:focus-visible:ring-2 ad:[&>svg]:size-4 ad:[&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "ad:after:absolute ad:after:-inset-2 ad:md:after:hidden",
        "ad:peer-data-[size=sm]/menu-button:top-1",
        "ad:peer-data-[size=default]/menu-button:top-1.5",
        "ad:peer-data-[size=lg]/menu-button:top-2.5",
        "ad:group-data-[collapsible=icon]:hidden",
        showOnHover &&
          "ad:group-focus-within/menu-item:opacity-100 ad:group-hover/menu-item:opacity-100 ad:peer-data-[active=true]/menu-button:text-sidebar-accent-foreground ad:data-[state=open]:opacity-100 ad:md:opacity-0",
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuBadge({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-menu-badge"
      data-sidebar="menu-badge"
      className={cn(
        "ad:pointer-events-none ad:absolute ad:right-1 ad:flex ad:h-5 ad:min-w-5 ad:items-center ad:justify-center ad:rounded-md ad:px-1 ad:text-xs ad:font-medium ad:text-sidebar-foreground ad:tabular-nums ad:select-none",
        "ad:peer-hover/menu-button:text-sidebar-accent-foreground ad:peer-data-[active=true]/menu-button:text-sidebar-accent-foreground",
        "ad:peer-data-[size=sm]/menu-button:top-1",
        "ad:peer-data-[size=default]/menu-button:top-1.5",
        "ad:peer-data-[size=lg]/menu-button:top-2.5",
        "ad:group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuSkeleton({
  className,
  showIcon = false,
  ...props
}: React.ComponentProps<"div"> & {
  showIcon?: boolean
}) {
  // Random width between 50 to 90%.
  const width = React.useMemo(() => {
    return `${Math.floor(Math.random() * 40) + 50}%`
  }, [])

  return (
    <div
      data-slot="sidebar-menu-skeleton"
      data-sidebar="menu-skeleton"
      className={cn("ad:flex ad:h-8 ad:items-center ad:gap-2 ad:rounded-md ad:px-2", className)}
      {...props}
    >
      {showIcon && (
        <Skeleton
          className="ad:size-4 ad:rounded-md"
          data-sidebar="menu-skeleton-icon"
        />
      )}
      <Skeleton
        className="ad:h-4 ad:max-w-(--skeleton-width) ad:flex-1"
        data-sidebar="menu-skeleton-text"
        style={
          {
            "--skeleton-width": width,
          } as React.CSSProperties
        }
      />
    </div>
  )
}

function SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="sidebar-menu-sub"
      data-sidebar="menu-sub"
      className={cn(
        "ad:mx-3.5 ad:flex ad:min-w-0 ad:translate-x-px ad:flex-col ad:gap-1 ad:border-l ad:border-sidebar-border ad:px-2.5 ad:py-0.5",
        "ad:group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuSubItem({
  className,
  ...props
}: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="sidebar-menu-sub-item"
      data-sidebar="menu-sub-item"
      className={cn("ad:group/menu-sub-item ad:relative", className)}
      {...props}
    />
  )
}

function SidebarMenuSubButton({
  asChild = false,
  size = "md",
  isActive = false,
  className,
  ...props
}: React.ComponentProps<"a"> & {
  asChild?: boolean
  size?: "sm" | "md"
  isActive?: boolean
}) {
  const Comp = asChild ? Slot.Root : "a"

  return (
    <Comp
      data-slot="sidebar-menu-sub-button"
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={isActive}
      className={cn(
        "ad:flex ad:h-7 ad:min-w-0 ad:-translate-x-px ad:items-center ad:gap-2 ad:overflow-hidden ad:rounded-md ad:px-2 ad:text-sidebar-foreground ad:ring-sidebar-ring ad:outline-hidden ad:hover:bg-sidebar-accent ad:hover:text-sidebar-accent-foreground ad:focus-visible:ring-2 ad:active:bg-sidebar-accent ad:active:text-sidebar-accent-foreground ad:disabled:pointer-events-none ad:disabled:opacity-50 ad:aria-disabled:pointer-events-none ad:aria-disabled:opacity-50 ad:[&>span:last-child]:truncate ad:[&>svg]:size-4 ad:[&>svg]:shrink-0 ad:[&>svg]:text-sidebar-accent-foreground",
        "ad:data-[active=true]:bg-sidebar-accent ad:data-[active=true]:text-sidebar-accent-foreground",
        size === "sm" && "ad:text-xs",
        size === "md" && "ad:text-sm",
        "ad:group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
}

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
}

"use client"

import * as React from "react"
import { cn } from "@/admin/lib/utils"
import { XIcon } from "lucide-react"
import { Dialog as SheetPrimitive } from "radix-ui"

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "ad:fixed ad:inset-0 ad:z-50 ad:bg-black/50 ad:data-[state=closed]:animate-out ad:data-[state=closed]:fade-out-0 ad:data-[state=open]:animate-in ad:data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "ad:fixed ad:z-50 ad:flex ad:flex-col ad:gap-4 ad:bg-background ad:shadow-lg ad:transition ad:ease-in-out ad:data-[state=closed]:animate-out ad:data-[state=closed]:duration-300 ad:data-[state=open]:animate-in ad:data-[state=open]:duration-500",
          side === "right" &&
            "ad:inset-y-0 ad:right-0 ad:h-full ad:w-3/4 ad:border-l ad:data-[state=closed]:slide-out-to-right ad:data-[state=open]:slide-in-from-right ad:sm:max-w-sm",
          side === "left" &&
            "ad:inset-y-0 ad:left-0 ad:h-full ad:w-3/4 ad:border-r ad:data-[state=closed]:slide-out-to-left ad:data-[state=open]:slide-in-from-left ad:sm:max-w-sm",
          side === "top" &&
            "ad:inset-x-0 ad:top-0 ad:h-auto ad:border-b ad:data-[state=closed]:slide-out-to-top ad:data-[state=open]:slide-in-from-top",
          side === "bottom" &&
            "ad:inset-x-0 ad:bottom-0 ad:h-auto ad:border-t ad:data-[state=closed]:slide-out-to-bottom ad:data-[state=open]:slide-in-from-bottom",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close className="ad:absolute ad:top-4 ad:right-4 ad:rounded-xs ad:opacity-70 ad:ring-offset-background ad:transition-opacity ad:hover:opacity-100 ad:focus:ring-2 ad:focus:ring-ring ad:focus:ring-offset-2 ad:focus:outline-hidden ad:disabled:pointer-events-none ad:data-[state=open]:bg-secondary">
            <XIcon className="ad:size-4" />
            <span className="ad:sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("ad:flex ad:flex-col ad:gap-1.5 ad:p-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("ad:mt-auto ad:flex ad:flex-col ad:gap-2 ad:p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("ad:font-semibold ad:text-foreground", className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("ad:text-sm ad:text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}

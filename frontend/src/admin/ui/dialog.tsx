import * as React from "react"
import { cn } from "@/admin/lib/utils"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { Button } from "@/admin/ui/button"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "ad:fixed ad:inset-0 ad:z-50 ad:bg-black/50 ad:data-[state=closed]:animate-out ad:data-[state=closed]:fade-out-0 ad:data-[state=open]:animate-in ad:data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "ad:fixed ad:top-[50%] ad:left-[50%] ad:z-50 ad:grid ad:w-full ad:max-w-[calc(100%-2rem)] ad:translate-x-[-50%] ad:translate-y-[-50%] ad:gap-4 ad:rounded-lg ad:border ad:bg-background ad:p-6 ad:shadow-lg ad:duration-200 ad:outline-none ad:data-[state=closed]:animate-out ad:data-[state=closed]:fade-out-0 ad:data-[state=closed]:zoom-out-95 ad:data-[state=open]:animate-in ad:data-[state=open]:fade-in-0 ad:data-[state=open]:zoom-in-95 ad:sm:max-w-lg",
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="ad:absolute ad:top-4 ad:right-4 ad:rounded-xs ad:opacity-70 ad:ring-offset-background ad:transition-opacity ad:hover:opacity-100 ad:focus:ring-2 ad:focus:ring-ring ad:focus:ring-offset-2 ad:focus:outline-hidden ad:disabled:pointer-events-none ad:data-[state=open]:bg-accent ad:data-[state=open]:text-muted-foreground ad:[&_svg]:pointer-events-none ad:[&_svg]:shrink-0 ad:[&_svg:not([class*=size-])]:size-4"
          >
            <XIcon />
            <span className="ad:sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("ad:flex ad:flex-col ad:gap-2 ad:text-center ad:sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "ad:flex ad:flex-col-reverse ad:gap-2 ad:sm:flex-row ad:sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("ad:text-lg ad:leading-none ad:font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("ad:text-sm ad:text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}

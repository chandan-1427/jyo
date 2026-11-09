import * as React from "react"
import { cn } from "@/admin/lib/utils"
import { Tooltip as TooltipPrimitive } from "radix-ui"

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "ad:z-50 ad:w-fit ad:origin-(--radix-tooltip-content-transform-origin) ad:animate-in ad:rounded-md ad:bg-foreground ad:px-3 ad:py-1.5 ad:text-xs ad:text-balance ad:text-background ad:fade-in-0 ad:zoom-in-95 ad:data-[side=bottom]:slide-in-from-top-2 ad:data-[side=left]:slide-in-from-right-2 ad:data-[side=right]:slide-in-from-left-2 ad:data-[side=top]:slide-in-from-bottom-2 ad:data-[state=closed]:animate-out ad:data-[state=closed]:fade-out-0 ad:data-[state=closed]:zoom-out-95",
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="ad:z-50 ad:size-2.5 ad:translate-y-[calc(-50%_-_2px)] ad:rotate-45 ad:rounded-[2px] ad:bg-foreground ad:fill-foreground" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }

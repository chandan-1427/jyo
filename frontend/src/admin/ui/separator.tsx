import * as React from "react"
import { cn } from "@/admin/lib/utils"
import { Separator as SeparatorPrimitive } from "radix-ui"

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "ad:shrink-0 ad:bg-border ad:data-[orientation=horizontal]:h-px ad:data-[orientation=horizontal]:w-full ad:data-[orientation=vertical]:h-full ad:data-[orientation=vertical]:w-px",
        className
      )}
      {...props}
    />
  )
}

export { Separator }

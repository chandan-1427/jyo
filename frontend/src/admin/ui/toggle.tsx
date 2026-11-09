"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/admin/lib/utils"
import { Toggle as TogglePrimitive } from "radix-ui"

const toggleVariants = cva(
  "ad:inline-flex ad:items-center ad:justify-center ad:gap-2 ad:rounded-md ad:text-sm ad:font-medium ad:whitespace-nowrap ad:transition-[color,box-shadow] ad:outline-none ad:hover:bg-muted ad:hover:text-muted-foreground ad:focus-visible:border-ring ad:focus-visible:ring-[3px] ad:focus-visible:ring-ring/50 ad:disabled:pointer-events-none ad:disabled:opacity-50 ad:aria-invalid:border-destructive ad:aria-invalid:ring-destructive/20 ad:data-[state=on]:bg-accent ad:data-[state=on]:text-accent-foreground ad:dark:aria-invalid:ring-destructive/40 ad:[&_svg]:pointer-events-none ad:[&_svg]:shrink-0 ad:[&_svg:not([class*=size-])]:size-4",
  {
    variants: {
      variant: {
        default: "ad:bg-transparent",
        outline:
          "ad:border ad:border-input ad:bg-transparent ad:shadow-xs ad:hover:bg-accent ad:hover:text-accent-foreground",
      },
      size: {
        default: "ad:h-9 ad:min-w-9 ad:px-2",
        sm: "ad:h-8 ad:min-w-8 ad:px-1.5",
        lg: "ad:h-10 ad:min-w-10 ad:px-2.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }

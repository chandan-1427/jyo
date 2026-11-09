import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/admin/lib/utils"
import { Slot } from "radix-ui"

const badgeVariants = cva(
  "ad:inline-flex ad:w-fit ad:shrink-0 ad:items-center ad:justify-center ad:gap-1 ad:overflow-hidden ad:rounded-full ad:border ad:border-transparent ad:px-2 ad:py-0.5 ad:text-xs ad:font-medium ad:whitespace-nowrap ad:transition-[color,box-shadow] ad:focus-visible:border-ring ad:focus-visible:ring-[3px] ad:focus-visible:ring-ring/50 ad:aria-invalid:border-destructive ad:aria-invalid:ring-destructive/20 ad:dark:aria-invalid:ring-destructive/40 ad:[&>svg]:pointer-events-none ad:[&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "ad:bg-primary ad:text-primary-foreground ad:[a&]:hover:bg-primary/90",
        secondary:
          "ad:bg-secondary ad:text-secondary-foreground ad:[a&]:hover:bg-secondary/90",
        destructive:
          "ad:bg-destructive ad:text-white ad:focus-visible:ring-destructive/20 ad:dark:bg-destructive/60 ad:dark:focus-visible:ring-destructive/40 ad:[a&]:hover:bg-destructive/90",
        outline:
          "ad:border-border ad:text-foreground ad:[a&]:hover:bg-accent ad:[a&]:hover:text-accent-foreground",
        ghost: "ad:[a&]:hover:bg-accent ad:[a&]:hover:text-accent-foreground",
        link: "ad:text-primary ad:underline-offset-4 ad:[a&]:hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }

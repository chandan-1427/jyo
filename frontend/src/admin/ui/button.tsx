import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/admin/lib/utils"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "ad:inline-flex ad:shrink-0 ad:items-center ad:justify-center ad:gap-2 ad:rounded-md ad:text-sm ad:font-medium ad:whitespace-nowrap ad:transition-all ad:outline-none ad:focus-visible:border-ring ad:focus-visible:ring-[3px] ad:focus-visible:ring-ring/50 ad:disabled:pointer-events-none ad:disabled:opacity-50 ad:aria-invalid:border-destructive ad:aria-invalid:ring-destructive/20 ad:dark:aria-invalid:ring-destructive/40 ad:[&_svg]:pointer-events-none ad:[&_svg]:shrink-0 ad:[&_svg:not([class*=size-])]:size-4",
  {
    variants: {
      variant: {
        default: "ad:bg-primary ad:text-primary-foreground ad:hover:bg-primary/90",
        destructive:
          "ad:bg-destructive ad:text-white ad:hover:bg-destructive/90 ad:focus-visible:ring-destructive/20 ad:dark:bg-destructive/60 ad:dark:focus-visible:ring-destructive/40",
        outline:
          "ad:border ad:bg-background ad:shadow-xs ad:hover:bg-accent ad:hover:text-accent-foreground ad:dark:border-input ad:dark:bg-input/30 ad:dark:hover:bg-input/50",
        secondary:
          "ad:bg-secondary ad:text-secondary-foreground ad:hover:bg-secondary/80",
        ghost:
          "ad:hover:bg-accent ad:hover:text-accent-foreground ad:dark:hover:bg-accent/50",
        link: "ad:text-primary ad:underline-offset-4 ad:hover:underline",
      },
      size: {
        default: "ad:h-9 ad:px-4 ad:py-2 ad:has-[>svg]:px-3",
        xs: "ad:h-6 ad:gap-1 ad:rounded-md ad:px-2 ad:text-xs ad:has-[>svg]:px-1.5 ad:[&_svg:not([class*=size-])]:size-3",
        sm: "ad:h-8 ad:gap-1.5 ad:rounded-md ad:px-3 ad:has-[>svg]:px-2.5",
        lg: "ad:h-10 ad:rounded-md ad:px-6 ad:has-[>svg]:px-4",
        icon: "ad:size-9",
        "icon-xs": "ad:size-6 ad:rounded-md ad:[&_svg:not([class*=size-])]:size-3",
        "icon-sm": "ad:size-8",
        "icon-lg": "ad:size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

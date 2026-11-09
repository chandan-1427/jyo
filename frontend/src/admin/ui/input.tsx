import * as React from "react"
import { cn } from "@/admin/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "ad:h-9 ad:w-full ad:min-w-0 ad:rounded-md ad:border ad:border-input ad:bg-transparent ad:px-3 ad:py-1 ad:text-base ad:shadow-xs ad:transition-[color,box-shadow] ad:outline-none ad:selection:bg-primary ad:selection:text-primary-foreground ad:file:inline-flex ad:file:h-7 ad:file:border-0 ad:file:bg-transparent ad:file:text-sm ad:file:font-medium ad:file:text-foreground ad:placeholder:text-muted-foreground ad:disabled:pointer-events-none ad:disabled:cursor-not-allowed ad:disabled:opacity-50 ad:md:text-sm ad:dark:bg-input/30",
        "ad:focus-visible:border-ring ad:focus-visible:ring-[3px] ad:focus-visible:ring-ring/50",
        "ad:aria-invalid:border-destructive ad:aria-invalid:ring-destructive/20 ad:dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }

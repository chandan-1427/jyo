import * as React from "react"
import { cn } from "@/admin/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "ad:flex ad:field-sizing-content ad:min-h-16 ad:w-full ad:rounded-md ad:border ad:border-input ad:bg-transparent ad:px-3 ad:py-2 ad:text-base ad:shadow-xs ad:transition-[color,box-shadow] ad:outline-none ad:placeholder:text-muted-foreground ad:focus-visible:border-ring ad:focus-visible:ring-[3px] ad:focus-visible:ring-ring/50 ad:disabled:cursor-not-allowed ad:disabled:opacity-50 ad:aria-invalid:border-destructive ad:aria-invalid:ring-destructive/20 ad:md:text-sm ad:dark:bg-input/30 ad:dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }

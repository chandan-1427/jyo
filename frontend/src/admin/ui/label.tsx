"use client"

import * as React from "react"
import { cn } from "@/admin/lib/utils"
import { Label as LabelPrimitive } from "radix-ui"

function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "ad:flex ad:items-center ad:gap-2 ad:text-sm ad:leading-none ad:font-medium ad:select-none ad:group-data-[disabled=true]:pointer-events-none ad:group-data-[disabled=true]:opacity-50 ad:peer-disabled:cursor-not-allowed ad:peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }

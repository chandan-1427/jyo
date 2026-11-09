"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/admin/lib/utils"
import { Tabs as TabsPrimitive } from "radix-ui"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "ad:group/tabs ad:flex ad:gap-2 ad:data-[orientation=horizontal]:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "ad:group/tabs-list ad:inline-flex ad:w-fit ad:items-center ad:justify-center ad:rounded-lg ad:p-[3px] ad:text-muted-foreground ad:group-data-[orientation=horizontal]/tabs:h-9 ad:group-data-[orientation=vertical]/tabs:h-fit ad:group-data-[orientation=vertical]/tabs:flex-col ad:data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "ad:bg-muted",
        line: "ad:gap-1 ad:bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "ad:relative ad:inline-flex ad:h-[calc(100%-1px)] ad:flex-1 ad:items-center ad:justify-center ad:gap-1.5 ad:rounded-md ad:border ad:border-transparent ad:px-2 ad:py-1 ad:text-sm ad:font-medium ad:whitespace-nowrap ad:text-foreground/60 ad:transition-all ad:group-data-[orientation=vertical]/tabs:w-full ad:group-data-[orientation=vertical]/tabs:justify-start ad:hover:text-foreground ad:focus-visible:border-ring ad:focus-visible:ring-[3px] ad:focus-visible:ring-ring/50 ad:focus-visible:outline-1 ad:focus-visible:outline-ring ad:disabled:pointer-events-none ad:disabled:opacity-50 ad:group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm ad:group-data-[variant=line]/tabs-list:data-[state=active]:shadow-none ad:dark:text-muted-foreground ad:dark:hover:text-foreground ad:[&_svg]:pointer-events-none ad:[&_svg]:shrink-0 ad:[&_svg:not([class*=size-])]:size-4",
        "ad:group-data-[variant=line]/tabs-list:bg-transparent ad:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent ad:dark:group-data-[variant=line]/tabs-list:data-[state=active]:border-transparent ad:dark:group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent",
        "ad:data-[state=active]:bg-background ad:data-[state=active]:text-foreground ad:dark:data-[state=active]:border-input ad:dark:data-[state=active]:bg-input/30 ad:dark:data-[state=active]:text-foreground",
        "ad:after:absolute ad:after:bg-foreground ad:after:opacity-0 ad:after:transition-opacity ad:group-data-[orientation=horizontal]/tabs:after:inset-x-0 ad:group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] ad:group-data-[orientation=horizontal]/tabs:after:h-0.5 ad:group-data-[orientation=vertical]/tabs:after:inset-y-0 ad:group-data-[orientation=vertical]/tabs:after:-right-1 ad:group-data-[orientation=vertical]/tabs:after:w-0.5 ad:group-data-[variant=line]/tabs-list:data-[state=active]:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("ad:flex-1 ad:outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }

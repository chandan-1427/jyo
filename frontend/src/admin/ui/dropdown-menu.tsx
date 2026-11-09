"use client"

import * as React from "react"
import { cn } from "@/admin/lib/utils"
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react"
import { DropdownMenu as DropdownMenuPrimitive } from "radix-ui"

function DropdownMenu({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuPortal({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
  return (
    <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
  )
}

function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      {...props}
    />
  )
}

function DropdownMenuContent({
  className,
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          "ad:z-50 ad:max-h-(--radix-dropdown-menu-content-available-height) ad:min-w-[8rem] ad:origin-(--radix-dropdown-menu-content-transform-origin) ad:overflow-x-hidden ad:overflow-y-auto ad:rounded-md ad:border ad:bg-popover ad:p-1 ad:text-popover-foreground ad:shadow-md ad:data-[side=bottom]:slide-in-from-top-2 ad:data-[side=left]:slide-in-from-right-2 ad:data-[side=right]:slide-in-from-left-2 ad:data-[side=top]:slide-in-from-bottom-2 ad:data-[state=closed]:animate-out ad:data-[state=closed]:fade-out-0 ad:data-[state=closed]:zoom-out-95 ad:data-[state=open]:animate-in ad:data-[state=open]:fade-in-0 ad:data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownMenuGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return (
    <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
  )
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean
  variant?: "default" | "destructive"
}) {
  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "ad:relative ad:flex ad:cursor-default ad:items-center ad:gap-2 ad:rounded-sm ad:px-2 ad:py-1.5 ad:text-sm ad:outline-hidden ad:select-none ad:focus:bg-accent ad:focus:text-accent-foreground ad:data-[disabled]:pointer-events-none ad:data-[disabled]:opacity-50 ad:data-[inset]:pl-8 ad:data-[variant=destructive]:text-destructive ad:data-[variant=destructive]:focus:bg-destructive/10 ad:data-[variant=destructive]:focus:text-destructive ad:dark:data-[variant=destructive]:focus:bg-destructive/20 ad:[&_svg]:pointer-events-none ad:[&_svg]:shrink-0 ad:[&_svg:not([class*=size-])]:size-4 ad:[&_svg:not([class*=text-])]:text-muted-foreground ad:data-[variant=destructive]:*:[svg]:text-destructive!",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        "ad:relative ad:flex ad:cursor-default ad:items-center ad:gap-2 ad:rounded-sm ad:py-1.5 ad:pr-2 ad:pl-8 ad:text-sm ad:outline-hidden ad:select-none ad:focus:bg-accent ad:focus:text-accent-foreground ad:data-[disabled]:pointer-events-none ad:data-[disabled]:opacity-50 ad:[&_svg]:pointer-events-none ad:[&_svg]:shrink-0 ad:[&_svg:not([class*=size-])]:size-4",
        className
      )}
      checked={checked}
      {...props}
    >
      <span className="ad:pointer-events-none ad:absolute ad:left-2 ad:flex ad:size-3.5 ad:items-center ad:justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CheckIcon className="ad:size-4" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  )
}

function DropdownMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
  return (
    <DropdownMenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  )
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      data-slot="dropdown-menu-radio-item"
      className={cn(
        "ad:relative ad:flex ad:cursor-default ad:items-center ad:gap-2 ad:rounded-sm ad:py-1.5 ad:pr-2 ad:pl-8 ad:text-sm ad:outline-hidden ad:select-none ad:focus:bg-accent ad:focus:text-accent-foreground ad:data-[disabled]:pointer-events-none ad:data-[disabled]:opacity-50 ad:[&_svg]:pointer-events-none ad:[&_svg]:shrink-0 ad:[&_svg:not([class*=size-])]:size-4",
        className
      )}
      {...props}
    >
      <span className="ad:pointer-events-none ad:absolute ad:left-2 ad:flex ad:size-3.5 ad:items-center ad:justify-center">
        <DropdownMenuPrimitive.ItemIndicator>
          <CircleIcon className="ad:size-2 ad:fill-current" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  )
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.Label
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn(
        "ad:px-2 ad:py-1.5 ad:text-sm ad:font-medium ad:data-[inset]:pl-8",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      data-slot="dropdown-menu-separator"
      className={cn("ad:-mx-1 ad:my-1 ad:h-px ad:bg-border", className)}
      {...props}
    />
  )
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "ad:ml-auto ad:text-xs ad:tracking-widest ad:text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSub({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
  return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean
}) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "ad:flex ad:cursor-default ad:items-center ad:gap-2 ad:rounded-sm ad:px-2 ad:py-1.5 ad:text-sm ad:outline-hidden ad:select-none ad:focus:bg-accent ad:focus:text-accent-foreground ad:data-[inset]:pl-8 ad:data-[state=open]:bg-accent ad:data-[state=open]:text-accent-foreground ad:[&_svg]:pointer-events-none ad:[&_svg]:shrink-0 ad:[&_svg:not([class*=size-])]:size-4 ad:[&_svg:not([class*=text-])]:text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ad:ml-auto ad:size-4" />
    </DropdownMenuPrimitive.SubTrigger>
  )
}

function DropdownMenuSubContent({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.SubContent
      data-slot="dropdown-menu-sub-content"
      className={cn(
        "ad:z-50 ad:min-w-[8rem] ad:origin-(--radix-dropdown-menu-content-transform-origin) ad:overflow-hidden ad:rounded-md ad:border ad:bg-popover ad:p-1 ad:text-popover-foreground ad:shadow-lg ad:data-[side=bottom]:slide-in-from-top-2 ad:data-[side=left]:slide-in-from-right-2 ad:data-[side=right]:slide-in-from-left-2 ad:data-[side=top]:slide-in-from-bottom-2 ad:data-[state=closed]:animate-out ad:data-[state=closed]:fade-out-0 ad:data-[state=closed]:zoom-out-95 ad:data-[state=open]:animate-in ad:data-[state=open]:fade-in-0 ad:data-[state=open]:zoom-in-95",
        className
      )}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}

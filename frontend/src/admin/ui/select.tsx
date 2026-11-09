import * as React from "react"
import { cn } from "@/admin/lib/utils"
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react"
import { Select as SelectPrimitive } from "radix-ui"

function Select({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectGroup({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Group>) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />
}

function SelectValue({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> & {
  size?: "sm" | "default"
}) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "ad:flex ad:w-fit ad:items-center ad:justify-between ad:gap-2 ad:rounded-md ad:border ad:border-input ad:bg-transparent ad:px-3 ad:py-2 ad:text-sm ad:whitespace-nowrap ad:shadow-xs ad:transition-[color,box-shadow] ad:outline-none ad:focus-visible:border-ring ad:focus-visible:ring-[3px] ad:focus-visible:ring-ring/50 ad:disabled:cursor-not-allowed ad:disabled:opacity-50 ad:aria-invalid:border-destructive ad:aria-invalid:ring-destructive/20 ad:data-[placeholder]:text-muted-foreground ad:data-[size=default]:h-9 ad:data-[size=sm]:h-8 ad:*:data-[slot=select-value]:line-clamp-1 ad:*:data-[slot=select-value]:flex ad:*:data-[slot=select-value]:items-center ad:*:data-[slot=select-value]:gap-2 ad:dark:bg-input/30 ad:dark:hover:bg-input/50 ad:dark:aria-invalid:ring-destructive/40 ad:[&_svg]:pointer-events-none ad:[&_svg]:shrink-0 ad:[&_svg:not([class*=size-])]:size-4 ad:[&_svg:not([class*=text-])]:text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="ad:size-4 ad:opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  position = "item-aligned",
  align = "center",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        className={cn(
          "ad:relative ad:z-50 ad:max-h-(--radix-select-content-available-height) ad:min-w-[8rem] ad:origin-(--radix-select-content-transform-origin) ad:overflow-x-hidden ad:overflow-y-auto ad:rounded-md ad:border ad:bg-popover ad:text-popover-foreground ad:shadow-md ad:data-[side=bottom]:slide-in-from-top-2 ad:data-[side=left]:slide-in-from-right-2 ad:data-[side=right]:slide-in-from-left-2 ad:data-[side=top]:slide-in-from-bottom-2 ad:data-[state=closed]:animate-out ad:data-[state=closed]:fade-out-0 ad:data-[state=closed]:zoom-out-95 ad:data-[state=open]:animate-in ad:data-[state=open]:fade-in-0 ad:data-[state=open]:zoom-in-95",
          position === "popper" &&
            "ad:data-[side=bottom]:translate-y-1 ad:data-[side=left]:-translate-x-1 ad:data-[side=right]:translate-x-1 ad:data-[side=top]:-translate-y-1",
          className
        )}
        position={position}
        align={align}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            "ad:p-1",
            position === "popper" &&
              "ad:h-[var(--radix-select-trigger-height)] ad:w-full ad:min-w-[var(--radix-select-trigger-width)] ad:scroll-my-1"
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn("ad:px-2 ad:py-1.5 ad:text-xs ad:text-muted-foreground", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "ad:relative ad:flex ad:w-full ad:cursor-default ad:items-center ad:gap-2 ad:rounded-sm ad:py-1.5 ad:pr-8 ad:pl-2 ad:text-sm ad:outline-hidden ad:select-none ad:focus:bg-accent ad:focus:text-accent-foreground ad:data-[disabled]:pointer-events-none ad:data-[disabled]:opacity-50 ad:[&_svg]:pointer-events-none ad:[&_svg]:shrink-0 ad:[&_svg:not([class*=size-])]:size-4 ad:[&_svg:not([class*=text-])]:text-muted-foreground ad:*:[span]:last:flex ad:*:[span]:last:items-center ad:*:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      <span
        data-slot="select-item-indicator"
        className="ad:absolute ad:right-2 ad:flex ad:size-3.5 ad:items-center ad:justify-center"
      >
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="ad:size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("ad:pointer-events-none ad:-mx-1 ad:my-1 ad:h-px ad:bg-border", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      data-slot="select-scroll-up-button"
      className={cn(
        "ad:flex ad:cursor-default ad:items-center ad:justify-center ad:py-1",
        className
      )}
      {...props}
    >
      <ChevronUpIcon className="ad:size-4" />
    </SelectPrimitive.ScrollUpButton>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      data-slot="select-scroll-down-button"
      className={cn(
        "ad:flex ad:cursor-default ad:items-center ad:justify-center ad:py-1",
        className
      )}
      {...props}
    >
      <ChevronDownIcon className="ad:size-4" />
    </SelectPrimitive.ScrollDownButton>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}

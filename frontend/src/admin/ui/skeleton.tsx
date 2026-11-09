import { cn } from "@/admin/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("ad:animate-pulse ad:rounded-md ad:bg-accent", className)}
      {...props}
    />
  )
}

export { Skeleton }

import { Link } from "react-router-dom";
import { UtensilsCrossed, Clock } from "lucide-react";
import type { FoodPost } from "../types/api";
import { formatPickupWindow } from "../lib/format";
import { StatusBadge } from "./ui/StatusBadge";

type Props = {
  post: FoodPost;
};

export default function PostCard({ post }: Props) {
  return (
    <Link
      to={`/posts/${post.id}`}
      className="bg-surface border border-border rounded-xl overflow-hidden hover:border-neutral-600 hover:bg-background transition-colors duration-150 block group"
    >
      {/* Photo */}
      {post.photoUrl ? (
        <img
          src={post.photoUrl}
          alt={post.title}
          className="w-full h-40 object-cover"
        />
      ) : (
        <div className="w-full h-40 bg-background flex items-center justify-center">
          <UtensilsCrossed className="w-8 h-8 text-subtle" />
        </div>
      )}

      {/* Content */}
      <div className="p-4 flex flex-col gap-2.5">

        <div className="flex items-start justify-between gap-2">
          <h2 className="font-semibold text-foreground text-sm leading-snug tracking-tight">
            {post.title}
          </h2>
          <StatusBadge status={post.status} />
        </div>

        {post.description && (
          <p className="text-xs text-subtle line-clamp-2 leading-relaxed">
            {post.description}
          </p>
        )}

        <div className="flex items-center justify-between text-xs text-subtle pt-0.5">
          <span>by {post.posterName}</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 shrink-0" />
            {formatPickupWindow(post.pickupWindowStart, post.pickupWindowEnd)}
          </span>
        </div>

      </div>
    </Link>
  );
}
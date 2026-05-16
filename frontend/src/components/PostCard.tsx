import { Link } from "react-router-dom";
import type { FoodPost } from "../types/api";
import { formatPickupWindow } from "../lib/format";

type Props = {
  post: FoodPost;
};

export default function PostCard({ post }: Props) {
  return (
    <Link
      to={`/posts/${post.id}`}
      className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition block"
    >
      {/* Photo */}
      {post.photoUrl ? (
        <img
          src={post.photoUrl}
          alt={post.title}
          className="w-full h-40 object-cover"
        />
      ) : (
        <div className="w-full h-40 bg-orange-50 flex items-center justify-center text-4xl">
          🍱
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800 text-base">{post.title}</h2>
          {post.status === "pending_approval" && (
            <span className="text-xs bg-yellow-50 text-yellow-600 px-2 py-0.5 rounded-full">
              Pending
            </span>
          )}
        </div>

        {post.description && (
          <p className="text-sm text-gray-400 mt-1 line-clamp-2">
            {post.description}
          </p>
        )}

        <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
          <span>by {post.posterName}</span>
          <span>🕐 {formatPickupWindow(post.pickupWindowStart, post.pickupWindowEnd)}</span>
        </div>
      </div>
    </Link>
  );
}
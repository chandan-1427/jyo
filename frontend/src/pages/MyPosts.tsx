import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import type { FoodPost } from "../types/api";

const statusStyles: Record<FoodPost["status"], string> = {
  open: "bg-green-50 text-green-600",
  pending_approval: "bg-yellow-50 text-yellow-600",
  closed: "bg-gray-100 text-gray-500",
  expired: "bg-red-50 text-red-400",
};

const statusLabels: Record<FoodPost["status"], string> = {
  open: "Open",
  pending_approval: "Pending",
  closed: "Closed",
  expired: "Expired",
};

export default function MyPosts() {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<FoodPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch("/posts/mine")
      .then((data) => setPosts(data.posts))
      .catch((err: unknown) => {
        if (err instanceof Error) setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
        Loading...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-800">My Posts</h1>
        <button
          onClick={() => navigate("/create")}
          className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-orange-600 transition"
        >
          + Post Food
        </button>
      </div>

      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-2">
          <p className="text-2xl">🍱</p>
          <p className="text-gray-500 text-sm">You haven't posted any food yet.</p>
          <button
            onClick={() => navigate("/create")}
            className="text-orange-500 text-sm hover:underline mt-1"
          >
            Post your first one
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map((post) => (
            <div
              key={post.id}
              onClick={() => navigate(`/posts/${post.id}`)}
              className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition cursor-pointer flex items-center gap-4"
            >
              {/* Thumbnail */}
              {post.photoUrl ? (
                <img
                  src={post.photoUrl}
                  alt={post.title}
                  className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-orange-50 flex items-center justify-center text-2xl flex-shrink-0">
                  🍱
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-800 truncate">{post.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(post.createdAt).toLocaleDateString()}
                </p>
              </div>

              {/* Status */}
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${statusStyles[post.status]}`}>
                {statusLabels[post.status]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
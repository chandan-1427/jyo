export type FoodPost = {
  id: string;
  // Only sent to the poster and, once approved, the picker.
  posterName?: string | null;
  title: string;
  description: string | null;
  photoUrl: string | null;
  pickupWindowStart: string;
  pickupWindowEnd: string;
  status: "open" | "pending_approval" | "closed" | "expired" | "completed";
  isDemo?: boolean;
  createdAt: string;
};

export type PickupRequest = {
  id: string;
  postId: string;
  pickerName: string;
  selfieUrl: string | null;
  etaMinutes: number;
  // missed: the poster said the approved picker never came. withdrawn: the
  // approved picker said they can't make it.
  status: "pending" | "approved" | "rejected" | "cancelled" | "missed" | "withdrawn" | "timed_out";
  // While pending: when it closes if the poster hasn't answered.
  answerBy?: string;
  isDemo?: boolean;
  createdAt: string;
};
// One of your own requests, as GET /requests/mine returns it: the request,
// plus enough of its post to show it as a card. Never where the post is.
export type MyRequest = {
  id: string;
  postId: string;
  postTitle: string;
  postDescription: string | null;
  postPhotoUrl: string | null;
  postStatus: FoodPost["status"];
  pickupWindowStart: string;
  pickupWindowEnd: string;
  pickerName: string;
  etaMinutes: number;
  status: PickupRequest["status"];
  isDemo?: boolean;
  createdAt: string;
};

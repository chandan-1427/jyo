export type FoodPost = {
  id: string;
  posterId: string;
  posterName: string;
  title: string;
  description: string | null;
  photoUrl: string | null;
  pickupWindowStart: string;
  pickupWindowEnd: string;
  status: "open" | "pending_approval" | "closed" | "expired";
  createdAt: string;
};

export type PickupRequest = {
  id: string;
  postId: string;
  pickerId: string;
  pickerName: string;
  selfieUrl: string | null;
  etaMinutes: number;
  status: "pending" | "approved" | "rejected" | "cancelled";
  createdAt: string;
};
import type { FoodPost } from "@/types/api";

export type Diet = NonNullable<FoodPost["diet"]>;

export const DIET_LABEL: Record<Diet, string> = { veg: "Veg", egg: "Egg", non_veg: "Non-veg" };
export const DIETS: Diet[] = ["veg", "egg", "non_veg"];

// "Veg, serves 4". Null for posts made before these were asked.
export function foodSummary(post: Pick<FoodPost, "diet" | "servings">): string | null {
  const parts = [post.diet ? DIET_LABEL[post.diet] : null, post.servings ? `serves ${post.servings}` : null].filter(
    (p): p is string => !!p
  );
  if (!parts.length) return null;
  const text = parts.join(", ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

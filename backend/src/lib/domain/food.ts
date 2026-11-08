const DIET_LABEL = { veg: "Veg", egg: "Egg", non_veg: "Non-veg" } as const;

// "Veg, serves 4", as the app shows it. Null for posts made before these
// were asked.
export function foodSummaryText(post: { diet: keyof typeof DIET_LABEL | null; servings: number | null }): string | null {
  const parts = [post.diet ? DIET_LABEL[post.diet] : null, post.servings ? `serves ${post.servings}` : null].filter(
    (p): p is string => !!p
  );
  if (!parts.length) return null;
  const text = parts.join(", ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

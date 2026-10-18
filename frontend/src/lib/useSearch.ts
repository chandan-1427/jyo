import { useState } from "react";

// Lower-cased, with accents removed, so "Pongal" finds "pongal" and "café"
// finds "cafe".
const normalize = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

// Filters a list as someone types. `text` picks what to search in each item
// (e.g. a post's title and description). Every word typed has to appear,
// in any order, so "rice curd" finds "Curd rice for 2".
export function useSearch<T>(items: T[], text: (item: T) => string) {
  const [query, setQuery] = useState("");
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const searching = terms.length > 0;
  const results = searching
    ? items.filter((item) => {
        const haystack = normalize(text(item));
        return terms.every((term) => haystack.includes(term));
      })
    : items;

  return { query, setQuery, results, searching };
}

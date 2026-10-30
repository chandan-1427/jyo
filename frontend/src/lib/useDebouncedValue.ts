import { useEffect, useState } from "react";

// `value`, once it has stopped changing for `ms`: a search box's text, sent
// once typing pauses rather than on every keystroke.
export function useDebouncedValue<T>(value: T, ms: number) {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);

  return settled;
}

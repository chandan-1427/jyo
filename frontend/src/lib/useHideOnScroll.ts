import { useEffect, useState } from "react";

// True while the user is scrolling down past the header, false as soon as they
// scroll back up. The 8px dead zone ignores trackpad jitter.
export function useHideOnScroll(offset = 64) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) < 8) return;
      setHidden(y > last && y > offset);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [offset]);

  return hidden;
}

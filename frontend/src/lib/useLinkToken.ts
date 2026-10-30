import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

// The token from an email link (?token=...), read once and then taken out of
// the address bar, so it doesn't linger in history or travel with anything
// that records the page URL. Kept in state, since the URL no longer has it.
export function useLinkToken() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [token] = useState(() => searchParams.get("token"));

  useEffect(() => {
    if (searchParams.has("token")) setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  return token;
}

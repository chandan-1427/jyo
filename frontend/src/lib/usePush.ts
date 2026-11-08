import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { disablePush, enablePush, getPushState, getServerKey, type PushState } from "./push";

export function usePush() {
  const [state, setState] = useState<PushState | null>(null);
  const refresh = useCallback(() => {
    getPushState().then(setState, () => setState("unsupported"));
  }, []);
  useEffect(refresh, [refresh]);

  const serverKey = useQuery({ queryKey: ["push", "key"], queryFn: getServerKey, staleTime: Infinity, retry: false });
  const enable = useMutation({ mutationFn: enablePush, onSettled: refresh });
  const disable = useMutation({ mutationFn: disablePush, onSettled: refresh });

  return {
    state,
    // Off on the server (no keys yet) or not known yet: don't offer it.
    available: !!serverKey.data,
    enable,
    disable,
  };
}

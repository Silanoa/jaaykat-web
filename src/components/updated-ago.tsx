import { useNow } from "../hooks/useNow";
import { updatedAgo } from "../lib/pay-demo";

export function UpdatedAgo({ at }: { at: number }) {
  const now = useNow(5000);
  if (!at) return null;
  return <span className="tabular text-xs text-subtle">{updatedAgo(Math.max(0, now - at))}</span>;
}

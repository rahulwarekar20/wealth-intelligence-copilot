/**
 * Coloured BUY / HOLD / SELL / TRIM / REBALANCE tag, used wherever the copilot
 * recommends an action. Colours come from actionColor in lib/ui.ts.
 */
import { actionColor } from "@/lib/ui";

const SIZES = {
  sm: "px-1.5 py-0.5 text-[11px]",
  md: "px-2 py-0.5 text-xs",
  lg: "px-3 py-1 text-sm",
};

export default function ActionBadge({
  action,
  size = "md",
  className = "",
}: {
  action: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span className={`rounded-md border text-center font-bold uppercase ${SIZES[size]} ${actionColor(action)} ${className}`}>
      {action}
    </span>
  );
}

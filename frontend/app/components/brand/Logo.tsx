/**
 * Brand identity: the logo mark and the "Wealth Intelligence Copilot" wordmark.
 *
 * The mark is the WIC icon (a "W" with a spark on a rounded square), drawn in
 * the app's ink-and-gold palette. The same drawing is used for the favicon in
 * app/icon.svg — keep the two in sync if the shape changes.
 */
import { useId } from "react";

/** The WIC logo mark. `size` is the width and height in pixels. */
export function LogoMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  // Unique gradient ids so several logos on one page don't share definitions
  const id = useId();
  const fill = `${id}-fill`;
  const shine = `${id}-shine`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={`shrink-0 drop-shadow-[0_4px_10px_rgba(36,30,26,0.25)] ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={fill} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4a4038" />
          <stop offset="1" stopColor="#1c1712" />
        </linearGradient>
        <linearGradient id={shine} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".16" />
          <stop offset=".5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="200" height="200" rx="46" fill={`url(#${fill})`} />
      <rect width="200" height="200" rx="46" fill={`url(#${shine})`} />
      <path
        d="M36 70 L68 148 L100 96 L132 148 L162 62"
        fill="none"
        stroke="#fdfaf2"
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M162 28 L168.5 51.5 L192 58 L168.5 64.5 L162 88 L155.5 64.5 L132 58 L155.5 51.5 Z" fill="#d8b25e" />
    </svg>
  );
}

/**
 * Logo mark plus the product name, set entirely in the display serif so
 * "Wealth Intelligence" and "Copilot" read as one name.
 * `stacked` puts "Copilot" on its own line (used in the narrow sidebar).
 */
export function Wordmark({
  size = 34,
  stacked = false,
  className = "",
}: {
  size?: number;
  stacked?: boolean;
  className?: string;
}) {
  return (
    <span className={`flex items-center gap-3 ${className}`}>
      <LogoMark size={size} />
      <span className="font-display font-semibold leading-tight tracking-tight text-ink-900">
        {stacked ? (
          <>
            <span className="block whitespace-nowrap text-[16px]">Wealth Intelligence</span>
            <span className="block text-[16px]">Copilot</span>
          </>
        ) : (
          <span className="text-lg">Wealth Intelligence Copilot</span>
        )}
      </span>
    </span>
  );
}

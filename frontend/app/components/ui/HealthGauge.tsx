/**
 * Ring gauge for the 0–100 portfolio health score. The arc fills clockwise and
 * is coloured green / gold / red by score (see healthStroke in lib/ui.ts).
 */
import { healthColor, healthStroke } from "@/lib/ui";

export default function HealthGauge({ score, size = 112 }: { score: number; size?: number }) {
  const clamped = Math.max(0, Math.min(100, score || 0));
  const stroke = 8;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  // Three-quarter arc, opening at the bottom
  const arc = circumference * 0.75;
  const filled = arc * (clamped / 100);

  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={`Health score ${clamped} out of 100`}>
      <svg width={size} height={size} className="rotate-[135deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-paper-200)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${circumference}`}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={healthStroke(clamped)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.16, 1, 0.3, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-display text-3xl font-medium leading-none ${healthColor(clamped)}`}>{clamped}</span>
        <span className="mt-1 text-[10px] uppercase tracking-widest text-ink-500">of 100</span>
      </div>
    </div>
  );
}

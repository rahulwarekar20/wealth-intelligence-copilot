"use client";

/**
 * Donut chart with a legend that doubles as its data table.
 *
 * - Hovering (or focusing) a slice or a legend row highlights it and shows its
 *   value in the centre, so the chart works by mouse and keyboard.
 * - Slices are separated by a thin gap in the card colour.
 * - The legend always lists every value, so nothing depends on colour alone.
 *
 * `renderExtra` adds content to the end of a legend row (e.g. a risk label).
 */
import { useState } from "react";
import type { Slice } from "@/lib/charts";

const SIZE = 200;
const STROKE = 30;
const RADIUS = (SIZE - STROKE) / 2;
const GAP_COLOR = "var(--color-paper-50)";

/** SVG path for a ring segment between two angles (0 = 12 o'clock, clockwise). */
function arcPath(startAngle: number, endAngle: number): string {
  const c = SIZE / 2;
  const point = (angle: number) => [c + RADIUS * Math.sin(angle), c - RADIUS * Math.cos(angle)];
  const [x1, y1] = point(startAngle);
  const [x2, y2] = point(endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${x2} ${y2}`;
}

/** Start/end angle of each slice, in order around the ring. */
function sliceAngles(slices: Slice[], total: number) {
  const arcs: { slice: Slice; start: number; end: number }[] = [];
  let angle = 0;
  for (const slice of slices) {
    const sweep = total > 0 ? (slice.value / total) * Math.PI * 2 : 0;
    arcs.push({ slice, start: angle, end: angle + sweep });
    angle += sweep;
  }
  return arcs;
}

export default function DonutChart({
  slices,
  centerLabel,
  centerValue,
  title,
  renderExtra,
}: {
  slices: Slice[];
  /** Small caption in the middle when nothing is hovered. */
  centerLabel: string;
  /** Large figure in the middle when nothing is hovered. */
  centerValue: string;
  /** Accessible name for the chart. */
  title: string;
  renderExtra?: (slice: Slice) => React.ReactNode;
}) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const active = slices.find((s) => s.key === activeKey);

  const arcs = sliceAngles(slices, total);

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
      {/* Ring */}
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={title}>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--color-paper-200)" strokeWidth={STROKE} />
          {arcs.map(({ slice, start, end }) => {
            const dimmed = activeKey !== null && activeKey !== slice.key;
            const common = {
              fill: "none",
              stroke: slice.color,
              strokeWidth: activeKey === slice.key ? STROKE + 6 : STROKE,
              opacity: dimmed ? 0.35 : 1,
              style: { transition: "opacity 0.15s, stroke-width 0.15s", cursor: "pointer", outline: "none" },
              tabIndex: 0,
              "aria-label": `${slice.label}: ${slice.value}%`,
              onMouseEnter: () => setActiveKey(slice.key),
              onMouseLeave: () => setActiveKey(null),
              onFocus: () => setActiveKey(slice.key),
              onBlur: () => setActiveKey(null),
            };
            return end - start >= Math.PI * 2 - 1e-6 ? (
              <circle key={slice.key} cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} {...common} />
            ) : (
              <path key={slice.key} d={arcPath(start, end)} {...common} />
            );
          })}
          {/* Thin gaps between slices, drawn on top in the card colour */}
          {arcs.length > 1 &&
            arcs.map(({ slice, start }) => {
              const c = SIZE / 2;
              const inner = RADIUS - STROKE / 2 - 4;
              const outer = RADIUS + STROKE / 2 + 4;
              return (
                <line
                  key={`gap-${slice.key}`}
                  x1={c + inner * Math.sin(start)}
                  y1={c - inner * Math.cos(start)}
                  x2={c + outer * Math.sin(start)}
                  y2={c - outer * Math.cos(start)}
                  stroke={GAP_COLOR}
                  strokeWidth={2}
                  pointerEvents="none"
                />
              );
            })}
        </svg>

        {/* Centre: the hovered slice, or the default headline */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-display text-3xl font-medium leading-none text-ink-900 tabular-nums">
            {active ? `${active.value}%` : centerValue}
          </span>
          <span className="mt-1.5 max-w-[110px] truncate text-[11px] uppercase tracking-widest text-ink-500">
            {active ? active.label : centerLabel}
          </span>
        </div>
      </div>

      {/* Legend / data table */}
      <ul className="w-full min-w-0 flex-1 divide-y divide-paper-200">
        {slices.map((s) => (
          <li
            key={s.key}
            onMouseEnter={() => setActiveKey(s.key)}
            onMouseLeave={() => setActiveKey(null)}
            className={`flex items-center gap-3 rounded-md px-2 py-2 text-sm transition ${
              activeKey === s.key ? "bg-paper-100" : ""
            }`}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="min-w-0 flex-1">
              <span className="font-medium text-ink-800">{s.label}</span>
              {s.detail && <span className="block truncate text-xs text-ink-500">{s.detail}</span>}
            </span>
            {renderExtra?.(s)}
            <span className="w-14 text-right tabular-nums text-ink-700">{s.value}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

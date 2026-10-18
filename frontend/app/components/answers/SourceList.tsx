/**
 * List of sources behind an answer. Sources with a URL (e.g. SEC filings) link out.
 */
import type { Source } from "@/lib/types";

export default function SourceList({ sources, heading = true }: { sources?: Source[]; heading?: boolean }) {
  if (!sources?.length) return null;
  return (
    <div className="mt-2">
      {heading && <p className="eyebrow mb-1.5">Sources</p>}
      <ul className="space-y-0.5">
        {sources.map((s) => (
          <li key={s.label} className="text-xs">
            {s.url ? (
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="link">
                {s.label}
              </a>
            ) : (
              <span className="text-ink-600">{s.label}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

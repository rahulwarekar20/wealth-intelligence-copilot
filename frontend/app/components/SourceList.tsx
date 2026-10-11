import type { Source } from "@/lib/types";

export default function SourceList({ sources, heading = true }: { sources?: Source[]; heading?: boolean }) {
  if (!sources?.length) return null;
  return (
    <div className="mt-2">
      {heading && <p className="text-gray-500 text-xs font-semibold mb-1">Sources</p>}
      <ul className="space-y-0.5">
        {sources.map((s) => (
          <li key={s.label} className="text-xs">
            {s.url ? (
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:text-teal-300 underline">
                {s.label}
              </a>
            ) : (
              <span className="text-gray-400">{s.label}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

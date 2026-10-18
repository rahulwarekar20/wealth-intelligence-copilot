/**
 * Coloured message box for errors, successes and notes.
 * Use this instead of hand-styling alert boxes so every page looks the same.
 */
const TONES = {
  error: "border-brick-100 bg-brick-50 text-brick-600",
  success: "border-fern-200 bg-fern-50 text-fern-700",
  info: "border-harbor-200 bg-harbor-50 text-harbor-700",
  note: "border-gold-200 bg-gold-50 text-ink-700",
};

export default function Callout({
  tone,
  children,
  className = "",
}: {
  tone: keyof typeof TONES;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${TONES[tone]} ${className}`}>{children}</div>
  );
}

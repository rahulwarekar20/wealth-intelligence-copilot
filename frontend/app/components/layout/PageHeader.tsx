/**
 * Editorial page title used at the top of every signed-in page:
 * a small gold eyebrow, a serif headline, an optional description, and
 * optional action buttons aligned to the right.
 */
export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-3xl">
        <p className="eyebrow mb-2 text-gold-500">{eyebrow}</p>
        <h1 className="font-display text-4xl font-medium tracking-tight text-ink-900">{title}</h1>
        {description && <p className="mt-2 text-[15px] leading-relaxed text-ink-600">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

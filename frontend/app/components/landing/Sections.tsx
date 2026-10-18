/**
 * Sections of the public landing page, top to bottom:
 * LandingNav → Hero → ExampleSection → HowItWorks → Features → TrustSection
 * → ClosingCta → LandingFooter. app/page.tsx composes them in that order.
 *
 * Sections that link to the sign-in form take an `onSignIn` callback, which
 * scrolls to the form and focuses the email field.
 */
import { Wordmark } from "../brand/Logo";
import { IconArrowRight, IconChat, IconLedger, IconQuote, IconShield } from "../ui/Icons";
import { CHAPTERS, FEATURES, HERO_STATS, TRUST_BLOCKS } from "./content";
import SignInCard from "./SignInCard";
import SpecimenCard from "./SpecimenCard";

type SignInProps = { onSignIn: () => void };

/** Small gold label + serif headline used to open each section. */
function SectionTitle({ eyebrow, children, light = false }: { eyebrow: string; children: React.ReactNode; light?: boolean }) {
  return (
    <>
      <p className={`eyebrow ${light ? "text-gold-300" : "text-gold-500"}`}>{eyebrow}</p>
      <h2 className={`mt-2 font-display text-4xl font-medium tracking-tight ${light ? "" : "text-ink-900"}`}>{children}</h2>
    </>
  );
}

/** Sticky top bar: logo, in-page links, and a Sign in button. */
export function LandingNav({ onSignIn }: SignInProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-paper-300/70 bg-paper-100/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <a href="#top"><Wordmark size={34} /></a>
        <nav className="hidden items-center gap-8 text-sm text-ink-600 md:flex">
          <a href="#how" className="transition hover:text-ink-900">How it works</a>
          <a href="#features" className="transition hover:text-ink-900">What it does</a>
          <a href="#trust" className="transition hover:text-ink-900">Why trust it</a>
        </nav>
        <button onClick={onSignIn} className="btn-primary px-4 py-2 text-sm">Sign in</button>
      </div>
    </header>
  );
}

/** Headline, value proposition and key figures, with the sign-in form alongside. */
export function Hero({ onSignIn, emailRef }: SignInProps & { emailRef: React.RefObject<HTMLInputElement | null> }) {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:pt-20">
      <div className="animate-rise">
        <p className="eyebrow inline-flex items-center gap-2 rounded-full border border-gold-200 bg-gold-50 px-3 py-1 text-gold-600">
          <IconShield size={14} /> AI investment copilot · Evidence first
        </p>
        <h1 className="mt-6 font-display text-5xl font-medium leading-[1.05] tracking-tight text-ink-900 sm:text-6xl">
          Investment decisions, <span className="italic text-gold-500">backed by evidence.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-600">
          Ask about any stock, your whole portfolio or your retirement. Specialist AI agents read SEC filings,
          live market data and your holdings — then explain every Buy, Hold or Sell with citations you can check.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button onClick={onSignIn} className="btn-primary px-6 py-3">
            Open your copilot <IconArrowRight size={16} />
          </button>
          <a href="#how" className="btn-secondary px-6 py-3">See how it works</a>
        </div>

        <dl className="mt-10 grid max-w-lg grid-cols-3 gap-6 border-t border-paper-300 pt-6">
          {HERO_STATS.map(([figure, label]) => (
            <div key={label}>
              <dt className="font-display text-3xl font-medium text-ink-900">{figure}</dt>
              <dd className="mt-1 text-xs leading-snug text-ink-500">{label}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="animate-rise [animation-delay:120ms]">
        <SignInCard emailRef={emailRef} />
      </div>
    </section>
  );
}

/** "Not a score. A reasoned answer." — the illustrative example card. */
export function ExampleSection() {
  return (
    <section className="mx-auto max-w-4xl px-4 pb-24 sm:px-6">
      <div className="ornament mb-8 text-[10px]">◆</div>
      <p className="mb-6 text-center font-display text-2xl text-ink-700">
        Not a score. <span className="italic">A reasoned answer.</span>
      </p>
      <SpecimenCard />
    </section>
  );
}

/** Three numbered steps from adding holdings to deciding. */
export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 border-y border-paper-300 bg-paper-50/60">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <SectionTitle eyebrow="How it works">
            From question to <span className="italic">considered decision</span>
          </SectionTitle>
        </div>
        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {CHAPTERS.map((c) => (
            <li key={c.n} className="card p-6">
              <p className="font-display text-sm italic text-gold-500">Chapter {c.n}</p>
              <h3 className="mt-2 font-display text-2xl font-medium text-ink-900">{c.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-600">{c.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** Six-feature grid. */
export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
      <div className="max-w-2xl">
        <SectionTitle eyebrow="What it does">
          A research desk, <span className="italic">on call</span>
        </SectionTitle>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-600">
          The work an analyst would do before you trade — read the filings, check the market, weigh it against
          what you already own — done in seconds, and shown in full.
        </p>
      </div>
      <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ Icon, title, body }) => (
          <div key={title}>
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-paper-300 bg-paper-50 text-gold-500 shadow-card">
              <Icon size={20} />
            </span>
            <h3 className="mt-4 font-display text-xl font-medium text-ink-900">{title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-600">{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Dark band explaining the guardrails. */
export function TrustSection() {
  return (
    <section id="trust" className="scroll-mt-20 bg-ink-900 text-paper-100">
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <SectionTitle eyebrow="Why trust it" light>
            Careful answers, <span className="italic text-gold-200">built for real money</span>
          </SectionTitle>
          <p className="mt-4 text-[15px] leading-relaxed text-paper-300">
            The copilot is designed to show its work and admit what it doesn&apos;t know — because a confident
            wrong answer costs more than an honest “it depends”.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {TRUST_BLOCKS.map((block) => (
            <div key={block.title} className="rounded-2xl border border-ink-700 bg-ink-800/60 p-6">
              <h3 className="font-display text-xl font-medium text-paper-50">{block.title}</h3>
              <ul className="mt-4 space-y-3">
                {block.items.map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-snug text-paper-300">
                    <span className="mt-1 text-[8px] text-gold-300">◆</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Final call to action before the footer. */
export function ClosingCta({ onSignIn }: SignInProps) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
      <div className="ornament mb-8 text-[10px]">◆</div>
      <h2 className="font-display text-4xl font-medium tracking-tight text-ink-900">
        Ready to make your next move <span className="italic text-gold-500">with evidence?</span>
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-ink-600">
        Try it with the demo portfolio — five holdings, ready to analyse — or create your own account.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button onClick={onSignIn} className="btn-primary px-6 py-3">
          Open your copilot <IconArrowRight size={16} />
        </button>
      </div>
      <div className="mt-10 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-ink-500">
        <span className="flex items-center gap-2"><IconLedger size={16} className="text-gold-500" /> Live portfolio dashboard</span>
        <span className="flex items-center gap-2"><IconChat size={16} className="text-gold-500" /> Plain-English questions</span>
        <span className="flex items-center gap-2"><IconQuote size={16} className="text-gold-500" /> Cited SEC evidence</span>
      </div>
    </section>
  );
}

/** Footer with the investment-advice disclaimer. */
export function LandingFooter() {
  return (
    <footer className="border-t border-paper-300 bg-paper-50/60">
      <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-6 px-4 py-10 sm:px-6">
        <Wordmark size={28} />
        <p className="max-w-xl text-xs leading-relaxed text-ink-500">
          Informational only. Not personalised investment advice. Analysis is generated by AI from public filings,
          market data and the information you provide, and may be incomplete or wrong. Consult a qualified financial
          advisor before making investment decisions.
        </p>
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-8 text-xs text-ink-400 sm:px-6">
        © {new Date().getFullYear()} Wealth Intelligence Copilot
      </div>
    </footer>
  );
}

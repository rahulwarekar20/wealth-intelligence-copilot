# WIC Frontend

Next.js 16 frontend for the Wealth Intelligence Copilot. See the [project README](../README.md) for setup, architecture and the full feature list.

## Development

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint     # ESLint
npm test         # unit and component tests (Vitest)
npm run check    # typecheck + lint + tests — run before every release
npm run build    # production build
```

The backend URL comes from `NEXT_PUBLIC_API_URL` (copy `.env.example` to `.env.local`). It defaults to `http://localhost:8000`.

## Layout

Each page in `app/<route>/page.tsx` only loads data and arranges sections; the sections themselves are small components in a folder named after the feature. Every file starts with a comment saying what it does.

| Path | Purpose |
|---|---|
| `app/page.tsx` | Public landing page with sign-in |
| `app/dashboard/` | Portfolio overview, holdings management and AI strategy |
| `app/strategy/` | Analyse Portfolio: full portfolio-wide AI strategy |
| `app/chat/` | Ask Copilot: one chat for stocks, comparisons, portfolio and retirement |
| `app/upload/` | Document upload and management |
| `app/profile/` | Investor profile and other assets |
| `app/alerts/` | In-app alerts |
| `app/track-record/` | How past calls played out |
| `app/report/` | Print-ready advisor report |
| `app/icon.svg` | Favicon (the WIC logo mark) |
| `app/globals.css` | Design system: colour palette, fonts, and shared classes (`card`, `btn-primary`, `field`, `eyebrow`...) |

**Components** (`app/components/`)

| Folder | Contents |
|---|---|
| `brand/` | `LogoMark` and `Wordmark` |
| `layout/` | `PageLayout` (sidebar shell), `PageContainer` (page width and margins), `PageHeader`, `Sidebar` |
| `ui/` | Generic building blocks: `Icons`, `Callout`, `ActionBadge`, `HealthGauge`, `DonutChart` |
| `answers/` | Copilot answer cards: recommendation, retirement, strategy, sources |
| `landing/` | Landing page sections, sign-in card, and `content.ts` (all landing copy) |
| `dashboard/` | Dashboard cards: value, health, holdings table, add-holding form, broker import, concentration, strategy panel |
| `profile/` | Profile form and other-assets card |
| `strategy/` | Analyse Portfolio sections: health overview, priority actions, recommendation mix, position cards, "since your last analysis" note |
| `chat/` | Message bubbles, answer router, starter questions, input box |
| `documents/` | Upload panel, document list, how-it-works steps |

**Logic** (`lib/`)

| File | Purpose |
|---|---|
| `api.ts` | All backend calls, auth token handling, error messages |
| `usePortfolio.ts` | Portfolio summary plus add/remove holding |
| `strategy.ts` | `useStrategy`: AI strategy shared by Dashboard and Analyse Portfolio |
| `useChat.ts` | Ask Copilot conversation state |
| `useAlerts.ts` | Alerts shared by the sidebar badge and the Alerts page (polls every 5 min) |
| `time.ts` | "3 min ago" / "as of 2:41 pm" wording |
| `chatSession.ts` | Converts answers to text for conversation history |
| `sessionStore.ts` | Per-tab persistence (chat history, cached strategy) |
| `ui.ts` | Shared colours (actions, health, concentration) and number formatting |
| `charts.ts` | Donut-chart data (allocation by ticker, recommendation mix) and the validated chart palette |
| `types.ts` | API response types |

`/retire` and `/journal` redirect to `/chat`. Their features are now part of the unified copilot.

Tests live next to the code they cover (`*.test.ts(x)`); shared test data builders are in `test/fixtures.ts`.

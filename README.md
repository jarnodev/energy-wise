# Energy Wise

When is electricity cheap? Energy Wise shows Dutch dynamic electricity and gas prices and helps you act on them:

- **Now & cheapest moment**: the current price and the cheapest block of 1–4 hours, today and tomorrow
- **All-in prices**: market price + energy tax + your supplier's markup, with or without VAT
- **Quarter-hour prices** for today and tomorrow, 30-day history and gas prices per gas day
- **Solar**: expected production for your postcode and panels, best hours for own use and the value of self-consumption once net metering ends (1 January 2027)
- **Calculators**: dynamic vs. fixed contract over the past year, EV charging planner, home battery simulation
- **Notifications** (Web Push), a **calendar feed** with the cheapest hours and an **open JSON API** for Home Assistant
- A **daily summary** written by Workers AI

Built with Next.js 15, deployed as a Cloudflare Worker via [OpenNext](https://opennext.js.org/cloudflare), with D1 for storage and a cron trigger for background jobs.

## How it works

| Part | Where |
|------|-------|
| Price sources (EnergyZero) | `lib/energyzero.ts` |
| Storage and backfilling in D1 | `lib/price-store.ts`, `migrations/` |
| Reading prices in pages and routes | `lib/prices.ts` |
| Price math, cheapest blocks, planners | `lib/pricing.ts`, `lib/planner.ts` |
| Cron jobs: ingest, summary, notifications | `lib/jobs.ts`, `worker.ts` |
| Web Push (RFC 8291 / RFC 8292 on WebCrypto) | `lib/webpush.ts`, `public/sw.js` |
| UI | `components/energy/` |

The cron runs every hour at :45. It stores new prices (tomorrow's appear around 13:00), backfills up to 400 days of history in small steps, writes tomorrow's summary and sends notifications.

## Local development

```bash
npm install
npx wrangler d1 migrations apply energy-wise --local   # create the local database
node scripts/generate-vapid-keys.mjs >> .dev.vars      # optional: enables notifications locally
npm run dev
```

`.dev.vars` should also contain `NEXTJS_ENV=development`. Without a database, pages fetch prices live.

To test in the Workers runtime, including the cron handler:

```bash
npx opennextjs-cloudflare build
npx wrangler dev --local --test-scheduled
curl "http://localhost:8787/__scheduled?cron=45+*+*+*+*"
```

Workers AI only runs remotely; locally the summary falls back to a template.

## Deploying

One-time setup:

```bash
npx wrangler login
npx wrangler d1 create energy-wise              # put the printed database_id in wrangler.jsonc
npx wrangler d1 migrations apply energy-wise --remote
node scripts/generate-vapid-keys.mjs            # put VAPID_PUBLIC_KEY in wrangler.jsonc (vars)
npx wrangler secret put VAPID_PRIVATE_KEY       # paste the private key
```

Then deploy with `npm run deploy`. Apply new files in `migrations/` with `npx wrangler d1 migrations apply energy-wise --remote` before deploying code that needs them.

## API

All endpoints are public JSON (CORS enabled). Prices are in EUR; `mode=allin|market`, `vat=false`, `markup` (EUR/kWh excl. VAT) and `markup_gas` change how prices are calculated.

| Endpoint | Returns |
|----------|---------|
| `GET /api/v1/now?hours=2` | Current price, level and the next cheapest block |
| `GET /api/v1/prices?kind=electricity&from=YYYY-MM-DD&till=YYYY-MM-DD&interval=quarter\|hour` | Prices for up to 400 days |
| `GET /api/v1/prices?kind=gas` | Gas prices per gas day |
| `GET /api/calendar?hours=2` | iCalendar feed with the cheapest block per day |
| `GET /api/summary` | Latest daily summary |

Data: [EnergyZero](https://www.energyzero.nl) (prices), [Open-Meteo](https://open-meteo.com) (solar forecast), [PDOK](https://www.pdok.nl) (geocoding).

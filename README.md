# AI Logistics Operating System

An agentic control tower that monitors deliveries, predicts delays, reroutes vehicles,
notifies customers and ops staff, and processes SLA-based refunds — autonomously.

## Architecture

```
/
├─ server/      Node 20 + TypeScript + Express + Socket.IO + Prisma
├─ client/      React 18 + Vite + Tailwind CSS + Google Maps
└─ shared/      Shared TypeScript enums and DTO types
```

The fleet is **simulated**. Integrations (Google Maps, Slack, Twilio, PayPal) are **real**.
The decision engine is **deterministic** — a rule table, not an LLM planner.
`AGENT_DRY_RUN=true` (default) makes zero external API calls.

## Prerequisites

- Node.js ≥ 20
- pnpm ≥ 9 — `npm install -g pnpm`
- Docker Desktop (for PostgreSQL)
- API keys: Google Maps (server + browser), Slack bot token, Twilio, PayPal sandbox

## Quick start

```bash
# 1. Clone and install
git clone <repo>
cd ai-logistics-os
pnpm install

# 2. Configure environment
cp .env.example .env
# Fill in .env — at minimum DATABASE_URL and the four API key groups

# 3. Start the database
docker compose up -d

# 4. Run migrations and seed
pnpm db:migrate
pnpm db:seed

# 5. Start the app
pnpm dev
# → Server:  http://localhost:3001
# → Client:  http://localhost:5173
# → Health:  http://localhost:3001/health
```

## Environment variables

See `.env.example` for the full list with descriptions.

Key flags:

| Variable             | Default   | Effect                                           |
| -------------------- | --------- | ------------------------------------------------ |
| `AGENT_DRY_RUN`      | `true`    | Log all actions, make zero external calls        |
| `PAYPAL_ENV`         | `sandbox` | `live` triggers a startup warning and real money |
| `SIMULATION_TICK_MS` | `5000`    | How often vehicles advance (ms)                  |

## Refund guardrails

| Guard                 | Default                                              |
| --------------------- | ---------------------------------------------------- |
| Auto-approve limit    | $50 — above this goes to human queue                 |
| Max per refund        | $200 or 50% of shipment value                        |
| Daily circuit breaker | 10 refunds **or** $500 total — whichever trips first |

## Build phases

| Phase | Status  | Description                                           |
| ----- | ------- | ----------------------------------------------------- |
| 0     | ✅ Done | Monorepo scaffold, env validation, health endpoint    |
| 1     | Pending | Prisma schema, migrations, seed, REST CRUD            |
| 2     | Pending | Simulation engine, Socket.IO, live map                |
| 3     | Pending | Decision engine (dry-run), monitoring loop, audit log |
| 4     | Pending | Integrations: Slack → Twilio → PayPal sandbox         |
| 5     | Pending | Full dashboard: activity feed, panels, approval queue |
| 6     | Pending | Hardening: retries, rate limits, unit tests           |

## SDK versions used

| SDK                  | Package                               | Version |
| -------------------- | ------------------------------------- | ------- |
| Google Maps (server) | `@googlemaps/google-maps-services-js` | 3.4.2   |
| Slack                | `@slack/web-api`                      | 7.16.0  |
| Twilio               | `twilio`                              | 6.0.2   |
| PayPal               | `@paypal/paypal-server-sdk`           | 2.3.0   |

## Future work (out of scope for MVP)

- Real GPS hardware / driver mobile app
- User authentication and multi-tenant support
- Production payment-capture UI
- Historical analytics and reporting

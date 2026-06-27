# Railnews

Daily Scandinavian railway news briefings from configurable web sources.

## Stack

- Node.js + Express serves the public frontend and JSON API.
- SQLite stores sources, topics, crawled articles, and daily briefings.
- A scheduled in-process cron job creates a daily briefing.
- Optional OpenAI-compatible API generation via `OPENAI_API_KEY`.

## Local setup

```bash
npm install
cp .env.example .env
npm run dev
```

Then open `http://localhost:3000`.

The app loads `.env` on startup. Restart the server after changing values such as `OPENAI_API_KEY`.

The public German website is available at `/`.
The German backend for sources, topics, and manual briefing runs is available at `/admin/`.

Create a briefing manually:

```bash
npm run briefing
```

The command output includes `llmConfigured`. If it is `false`, the app did not receive `OPENAI_API_KEY` and will use the German fallback briefing.

## Coolify

Use the included `Dockerfile`.

Recommended persistent volume:

```text
/app/data
```

Set at least these environment variables:

```text
ADMIN_TOKEN=<long random string>
CRON_SECRET=<long random string>
OPENAI_API_KEY=<optional>
```

The app runs its own daily cron from `BRIEFING_CRON` and `BRIEFING_TIMEZONE`.
For Coolify health checks, use `GET /health` (expects HTTP 200 with `{"status": "ok"}`).
For Dockerfile deployments on Coolify, the image also includes a Docker `HEALTHCHECK` that probes `http://127.0.0.1:3000/health`.
If you prefer Coolify scheduled tasks, run:

```bash
npm run briefing
```

or call:

```text
POST /api/cron/daily?secret=<CRON_SECRET>
```

## First source

The app seeds these first sources and focuses on Scandinavian railway topics by default:

- `https://www.lok-report.de/`
- `https://jarnvagar.nu/`
- `https://railmarket.com/eu/sweden/news`
- `https://railcolornews.com/`
- `https://www.therailagenda.com/feed`
- `https://www.svt.se/` (with strict railway-focused filtering)
- `https://www.schwedenreis.li/reisen` (travel reports are always considered relevant)

RSS/Atom feeds, including Substack feeds such as The Rail Agenda, are crawled directly when a source URL ends in `/feed` or returns feed XML.

`FOCUS_KEYWORDS` acts as the region gate. The editable topics then classify or refine matching Scandinavian stories.

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

The public German website is available at `/`.
The German backend for sources, topics, and manual briefing runs is available at `/admin/`.

Create a briefing manually:

```bash
npm run briefing
```

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

`FOCUS_KEYWORDS` acts as the region gate. The editable topics then classify or refine matching Scandinavian stories.

# Railnews

Daily Scandinavian railway news briefings from configurable web sources.

## Stack

- Node.js + Express serves the public frontend and JSON API.
- SQLite stores sources, topics, crawled articles, and daily briefings.
- A scheduled in-process cron job creates a daily briefing.
- Optional OpenAI-compatible API generation via `OPENAI_API_KEY`.

## Local setup

The project uses [mise](https://mise.jdx.dev/getting-started.html) to keep the
Node.js version and common commands consistent across computers. After cloning
the repository and installing mise, run:

```bash
mise install
mise run setup
mise run dev
```

Then open `http://localhost:3000`.

`mise run setup` installs the exact dependencies from `package-lock.json` and
creates `.env` from `.env.example` only when `.env` does not exist. The app
loads `.env` on startup; restart the server after changing values such as
`OPENAI_API_KEY`. The file stays local and is not committed.

Useful project commands:

```bash
mise run dev       # start the local server
mise run test      # run the test suite
mise run briefing  # generate a briefing
mise tasks         # list all available tasks
```

With mise activated in your shell, `node` and `npm` automatically use the
project's pinned runtime. Without shell activation, `mise run ...` and
`mise exec -- node --version` work on every supported shell.

The public German website is available at `/`.
The German backend for sources, topics, and manual briefing runs is available at `/admin/`.

Create a briefing manually:

```bash
mise run briefing
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
OPENAI_TIMEOUT_MS=60000
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

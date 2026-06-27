# AGENTS.md

## Cursor Cloud specific instructions

Railnews is a single Node.js (>= 20) + Express app that serves a German-language
Scandinavian railway-news site, a JSON API, and a German admin backend. It uses an
embedded SQLite database (`better-sqlite3`, native module) and in-process `node-cron`
jobs. There is no separate frontend build and no external database/service to run.
Standard commands live in `README.md` and `package.json`.

### Running the app (one service)

- The dev startup script already runs `npm install` and ensures a `.env` exists
  (`cp .env.example .env`). The bundled `.env.example` works out of the box.
- Start it with `npm run dev` (alias `npm start`), which runs `node src/server.js` and
  listens on `http://0.0.0.0:3000`. `npm run dev` and `npm start` are identical (no
  separate prod build / watcher).
- Health check: `GET /health` returns `{"status":"ok"}`.

### Seed data (real-world dump)

- A real-world SQLite dump lives at `seed/*.sqlite` (committed, e.g.
  `seed/railnews-20260524-101709.sqlite`; ~270 articles, ~31 briefings, ~110 comments).
- The startup script copies the newest `seed/*.sqlite` to `data/railnews.sqlite` only
  when that file does not already exist, so a fresh VM boots with real data. To reload
  it manually: stop the server, `rm -f data/railnews.sqlite*`, then
  `cp "$(ls -t seed/*.sqlite | head -1)" data/railnews.sqlite`, and restart.
- The app's own `seedStarterContent()` (`src/db.js`) only injects sample rows when the
  `articles` table is empty, so it leaves the real dump untouched.

### Non-obvious caveats

- There are no automated tests and no lint script in `package.json`; "lint/test" is
  limited to `node --check` syntax checks. Don't expect a test runner.
- The server has no hot reload — restart `node src/server.js` after code changes.
- The SQLite schema is auto-created on startup. DB file lives at `DATABASE_PATH`
  (default `./data/railnews.sqlite`, gitignored under `data/`). On a DB with no
  seed/dump present, startup auto-creates default sources/topics plus a sample briefing.
- Admin write endpoints (`/api/sources`, `/api/briefings/run`, `/api/crawl/run`, etc.)
  require header `x-admin-token: <ADMIN_TOKEN>` (or `?token=`). With the default
  `.env`, `ADMIN_TOKEN=change-me`. If `ADMIN_TOKEN` is unset, admin auth is bypassed.
  The admin UI is at `/admin/`.
- Public actions need no auth: submit a manual story via `POST /api/public/stories`
  and post chapter comments via `POST /api/briefings/:id/comments`.
- `OPENAI_API_KEY` is optional. Without it, briefings use a German extractive fallback
  (`runDailyBriefing` returns `llmConfigured:false`). Crawling real sources
  (`POST /api/crawl/run` / scheduled cron) needs outbound internet but is not required
  to boot or test the app.

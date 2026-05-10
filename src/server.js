import express from 'express';
import cron from 'node-cron';
import { config } from './config.js';
import {
  createBriefingComment,
  db,
  latestArticles,
  latestBriefings,
  latestCrawlFailures,
  listBriefingComments,
  listSources,
  listTopics,
  searchArticles
} from './db.js';
import { backfillJarnvagarPublishedAt, backfillRailmarketPublishedAt, crawlSources } from './crawler.js';
import { runDailyBriefing, runEveningBriefingIfNeeded } from './jobs/dailyBriefing.js';

const app = express();
app.use(express.json());
app.use(express.static('public', {
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    if (path.endsWith('/sw.js') || path.endsWith('\\sw.js')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      return;
    }

    if (path.endsWith('/index.html') || path.endsWith('\\index.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

function requireAdmin(req, res, next) {
  if (!config.adminToken) return next();
  const token = req.get('x-admin-token') || req.query.token;
  if (token !== config.adminToken) return res.status(401).json({ error: 'Missing or invalid admin token' });
  next();
}


app.get('/health', (_req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(503).json({ status: 'error', error: error.message });
  }
});

app.get('/api/public', (_req, res) => {
  const briefings = latestBriefings();
  const commentsByBriefing = Object.fromEntries(
    briefings.map((briefing) => [briefing.id, listBriefingComments(briefing.id)])
  );
  res.json({
    briefings,
    articles: latestArticles(),
    commentsByBriefing
  });
});

app.get('/api/briefings/:briefingId/comments', (req, res) => {
  const briefingId = Number(req.params.briefingId);
  if (!Number.isInteger(briefingId) || briefingId <= 0) {
    return res.status(400).json({ error: 'Invalid briefing id' });
  }
  const briefing = db.prepare('SELECT id FROM briefings WHERE id = ?').get(briefingId);
  if (!briefing) return res.status(404).json({ error: 'Briefing not found' });
  res.json({ comments: listBriefingComments(briefingId) });
});

app.post('/api/briefings/:briefingId/comments', (req, res) => {
  const briefingId = Number(req.params.briefingId);
  if (!Number.isInteger(briefingId) || briefingId <= 0) {
    return res.status(400).json({ error: 'Invalid briefing id' });
  }
  const briefing = db.prepare('SELECT id FROM briefings WHERE id = ?').get(briefingId);
  if (!briefing) return res.status(404).json({ error: 'Briefing not found' });

  const chapterKey = String(req.body.chapterKey || '').trim().slice(0, 140);
  const chapterTitle = String(req.body.chapterTitle || '').trim().slice(0, 240);
  const commentText = String(req.body.commentText || '').trim().slice(0, 1200);
  const commenterFace = String(req.body.commenterFace || '').trim();

  if (!chapterKey) return res.status(400).json({ error: 'chapterKey is required' });
  if (!commentText) return res.status(400).json({ error: 'commentText is required' });
  if (!['left', 'right'].includes(commenterFace)) {
    return res.status(400).json({ error: "commenterFace must be 'left' or 'right'" });
  }

  const comment = createBriefingComment({
    briefingId,
    chapterKey,
    chapterTitle,
    commentText,
    commenterFace
  });
  res.status(201).json({ ok: true, comment });
});

app.get('/api/articles/search', (req, res) => {
  const query = String(req.query.q || '').trim();
  if (!query) return res.status(400).json({ error: 'q query parameter is required' });

  const rawLimit = req.query.limit;
  const limit = rawLimit === undefined ? 50 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit <= 0) {
    return res.status(400).json({ error: 'limit must be a positive integer' });
  }

  res.json({ query, articles: searchArticles(query, limit) });
});

app.get('/api/admin/state', requireAdmin, (_req, res) => {
  res.json({
    sources: listSources(),
    topics: listTopics(),
    briefings: latestBriefings(),
    articles: latestArticles(),
    crawlFailures: latestCrawlFailures()
  });
});

function todayKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zurich',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function manualSourceId() {
  db.prepare(`
    INSERT OR IGNORE INTO sources (name, url, keywords, active)
    VALUES (?, ?, ?, 0)
  `).run('Manuelle Meldungen', 'https://railnews.local/manual-stories', 'manuell,Einreichung,Story');
  return db.prepare('SELECT id FROM sources WHERE url = ?').get('https://railnews.local/manual-stories').id;
}

app.post('/api/public/stories', async (req, res, next) => {
  try {
    const { title, url, excerpt = '' } = req.body;
    if (!title || !url) return res.status(400).json({ error: 'title and url are required' });

    let normalizedUrl;
    try {
      normalizedUrl = new URL(url).toString();
    } catch {
      return res.status(400).json({ error: 'url must be a valid URL' });
    }

    const cleanTitle = title.trim().slice(0, 240);
    const cleanExcerpt = excerpt.trim().slice(0, 1000);
    if (cleanTitle.length < 6) return res.status(400).json({ error: 'title is too short' });

    db.prepare(`
      INSERT INTO articles (source_id, url, title, excerpt, published_at, matched_topics)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(url) DO UPDATE SET
        title = excluded.title,
        excerpt = excluded.excerpt,
        published_at = excluded.published_at,
        matched_topics = excluded.matched_topics
    `).run(
      manualSourceId(),
      normalizedUrl,
      cleanTitle,
      cleanExcerpt || 'Manuell hinzugefügte Meldung für das heutige Briefing.',
      new Date().toISOString(),
      JSON.stringify(['Manuell'])
    );

    const briefing = await runDailyBriefing(todayKey(), { crawl: false });
    res.status(201).json({ ok: true, briefing });
  } catch (error) {
    next(error);
  }
});

app.post('/api/sources', requireAdmin, (req, res) => {
  const { name, url, keywords = '' } = req.body;
  if (!name || !url) return res.status(400).json({ error: 'name and url are required' });
  const result = db.prepare('INSERT INTO sources (name, url, keywords) VALUES (?, ?, ?)').run(name.trim(), url.trim(), keywords.trim());
  res.status(201).json({ id: result.lastInsertRowid });
});

app.patch('/api/sources/:id', requireAdmin, (req, res) => {
  const { name, url, keywords, active } = req.body;
  db.prepare(`
    UPDATE sources
    SET name = COALESCE(?, name),
        url = COALESCE(?, url),
        keywords = COALESCE(?, keywords),
        active = COALESCE(?, active)
    WHERE id = ?
  `).run(name?.trim(), url?.trim(), keywords?.trim(), active === undefined ? null : Number(Boolean(active)), req.params.id);
  res.json({ ok: true });
});

app.post('/api/topics', requireAdmin, (req, res) => {
  const { label, keywords } = req.body;
  if (!label || !keywords) return res.status(400).json({ error: 'label and keywords are required' });
  const result = db.prepare('INSERT INTO topics (label, keywords) VALUES (?, ?)').run(label.trim(), keywords.trim());
  res.status(201).json({ id: result.lastInsertRowid });
});

app.patch('/api/topics/:id', requireAdmin, (req, res) => {
  const { label, keywords, active } = req.body;
  db.prepare(`
    UPDATE topics
    SET label = COALESCE(?, label),
        keywords = COALESCE(?, keywords),
        active = COALESCE(?, active)
    WHERE id = ?
  `).run(label?.trim(), keywords?.trim(), active === undefined ? null : Number(Boolean(active)), req.params.id);
  res.json({ ok: true });
});

app.post('/api/briefings/run', requireAdmin, async (_req, res, next) => {
  try {
    res.json(await runDailyBriefing(undefined, { crawl: false }));
  } catch (error) {
    next(error);
  }
});

app.post('/api/briefings/evening/run', requireAdmin, async (_req, res, next) => {
  try {
    res.json(await runEveningBriefingIfNeeded(undefined, { crawl: false }));
  } catch (error) {
    next(error);
  }
});

app.post('/api/crawl/run', requireAdmin, async (_req, res, next) => {
  try {
    const results = await crawlSources();
    res.json({ ok: true, results });
  } catch (error) {
    next(error);
  }
});

app.post('/api/articles/redate/jarnvagar', requireAdmin, async (_req, res, next) => {
  try {
    const result = await backfillJarnvagarPublishedAt();
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

app.post('/api/articles/redate/railmarket', requireAdmin, async (_req, res, next) => {
  try {
    const result = await backfillRailmarketPublishedAt();
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

app.post('/api/cron/daily', async (req, res, next) => {
  if (config.cronSecret && req.query.secret !== config.cronSecret) {
    return res.status(401).json({ error: 'Missing or invalid cron secret' });
  }
  try {
    res.json(await runDailyBriefing());
  } catch (error) {
    next(error);
  }
});

app.delete('/api/articles/today', requireAdmin, (_req, res, next) => {
  try {
    const result = db.prepare(`
      DELETE FROM articles
      WHERE date(COALESCE(published_at, created_at), 'localtime') = date('now', 'localtime')
    `).run();
    res.json({ ok: true, deleted: result.changes });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/articles/:id', requireAdmin, (req, res, next) => {
  try {
    const articleId = Number(req.params.id);
    if (!Number.isInteger(articleId) || articleId <= 0) {
      return res.status(400).json({ error: 'Invalid article id' });
    }
    const result = db.prepare('DELETE FROM articles WHERE id = ?').run(articleId);
    if (result.changes === 0) return res.status(404).json({ error: 'Article not found' });
    res.json({ ok: true, deleted: 1 });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: error.message || 'Unexpected error' });
});

cron.schedule(config.briefingCron, () => {
  runDailyBriefing().catch((error) => console.error('Scheduled briefing failed', error));
}, { timezone: config.briefingTimezone });

cron.schedule('30 12 * * *', () => {
  crawlSources().catch((error) => console.error('Scheduled midday crawl failed', error));
}, { timezone: config.briefingTimezone });

cron.schedule('30 18 * * *', () => {
  runEveningBriefingIfNeeded().catch((error) => console.error('Scheduled evening briefing failed', error));
}, { timezone: config.briefingTimezone });

app.listen(config.port, config.host, () => {
  console.log(`Railnews listening on http://${config.host}:${config.port}`);
});

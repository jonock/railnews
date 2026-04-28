import express from 'express';
import cron from 'node-cron';
import { config } from './config.js';
import { db, latestArticles, latestBriefings, listSources, listTopics } from './db.js';
import { runDailyBriefing } from './jobs/dailyBriefing.js';

const app = express();
app.use(express.json());
app.use(express.static('public'));

function requireAdmin(req, res, next) {
  if (!config.adminToken) return next();
  const token = req.get('x-admin-token') || req.query.token;
  if (token !== config.adminToken) return res.status(401).json({ error: 'Missing or invalid admin token' });
  next();
}

app.get('/api/public', (_req, res) => {
  res.json({
    briefings: latestBriefings(),
    articles: latestArticles()
  });
});

app.get('/api/admin/state', requireAdmin, (_req, res) => {
  res.json({
    sources: listSources(),
    topics: listTopics(),
    briefings: latestBriefings(),
    articles: latestArticles()
  });
});

app.post('/api/sources', requireAdmin, (req, res) => {
  const { name, url } = req.body;
  if (!name || !url) return res.status(400).json({ error: 'name and url are required' });
  const result = db.prepare('INSERT INTO sources (name, url) VALUES (?, ?)').run(name.trim(), url.trim());
  res.status(201).json({ id: result.lastInsertRowid });
});

app.patch('/api/sources/:id', requireAdmin, (req, res) => {
  const { name, url, active } = req.body;
  db.prepare(`
    UPDATE sources
    SET name = COALESCE(?, name),
        url = COALESCE(?, url),
        active = COALESCE(?, active)
    WHERE id = ?
  `).run(name?.trim(), url?.trim(), active === undefined ? null : Number(Boolean(active)), req.params.id);
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
    res.json(await runDailyBriefing());
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

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: error.message || 'Unexpected error' });
});

cron.schedule(config.briefingCron, () => {
  runDailyBriefing().catch((error) => console.error('Scheduled briefing failed', error));
}, { timezone: config.briefingTimezone });

app.listen(config.port, config.host, () => {
  console.log(`Railnews listening on http://${config.host}:${config.port}`);
});

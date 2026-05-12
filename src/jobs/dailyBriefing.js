import { db } from '../db.js';
import { crawlSources } from '../crawler.js';
import {
  createBriefingText,
  createEveningBriefingText,
  isLlmConfigured,
  shouldCreateEveningBriefing
} from '../llm.js';

function parseArticleIds(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.map((id) => Number(id)).filter(Number.isFinite);
  } catch {
    return [];
  }
}

function recentBriefingsBefore(date, limit = 5) {
  return db.prepare(`
    SELECT id, briefing_date, briefing_type, title, summary, article_ids
    FROM briefings
    WHERE briefing_date < ?
    ORDER BY briefing_date DESC, created_at DESC
    LIMIT ?
  `).all(date, limit);
}

function articleIdsFromBriefings(briefings) {
  return new Set(
    briefings.flatMap((briefing) => parseArticleIds(briefing.article_ids))
  );
}

function excludeRecentlyBriefedArticles(articles, recentBriefings, limit = 30) {
  const recentlyBriefedArticleIds = articleIdsFromBriefings(recentBriefings);
  return articles
    .filter((article) => !recentlyBriefedArticleIds.has(article.id))
    .slice(0, limit);
}

function todayKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zurich',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

export async function runDailyBriefing(date = todayKey(), options = {}) {
  const crawlResults = options.crawl === false ? [] : await crawlSources();
  const recentBriefings = recentBriefingsBefore(date);
  const candidateArticles = db.prepare(`
    SELECT articles.*, sources.name AS source_name
    FROM articles
    JOIN sources ON sources.id = articles.source_id
    WHERE date(COALESCE(articles.published_at, articles.created_at)) >= date(?, '-1 day')
    ORDER BY COALESCE(articles.published_at, articles.created_at) DESC
    LIMIT 80
  `).all(date);
  const articles = excludeRecentlyBriefedArticles(candidateArticles, recentBriefings);

  const summary = await createBriefingText(articles, { recentBriefings });
  const title = `Skandinavien-Bahnbriefing - ${date}`;
  const articleIds = JSON.stringify(articles.map((article) => article.id));

  db.prepare(`
    INSERT INTO briefings (briefing_date, briefing_type, title, summary, article_ids)
    VALUES (?, 'daily', ?, ?, ?)
    ON CONFLICT(briefing_date) DO UPDATE SET
      briefing_type = 'daily',
      title = excluded.title,
      summary = excluded.summary,
      article_ids = excluded.article_ids,
      created_at = CURRENT_TIMESTAMP
  `).run(date, title, summary, articleIds);

  return { date, crawlResults, articleCount: articles.length, llmConfigured: isLlmConfigured() };
}

export async function runEveningBriefingIfNeeded(date = todayKey(), options = {}) {
  const crawlResults = options.crawl === false ? [] : await crawlSources();
  const morningBriefing = db.prepare(`
    SELECT *
    FROM briefings
    WHERE briefing_date = ? AND briefing_type = 'daily'
  `).get(date);

  if (!morningBriefing) {
    return { date, crawlResults, created: false, reason: 'Kein Morgen-Briefing vorhanden.' };
  }

  const existingEveningBriefing = db.prepare(`
    SELECT id
    FROM briefings
    WHERE briefing_type = 'evening'
      AND briefing_date >= ?
      AND briefing_date < ?
    LIMIT 1
  `).get(`${date}T00:00:00`, `${date}T23:59:59`);

  if (existingEveningBriefing) {
    return { date, crawlResults, created: false, reason: 'Abend-Briefing existiert bereits.' };
  }

  const eveningArticles = db.prepare(`
    SELECT articles.*, sources.name AS source_name
    FROM articles
    JOIN sources ON sources.id = articles.source_id
    WHERE articles.created_at > ?
    ORDER BY articles.created_at DESC, articles.id DESC
    LIMIT 30
  `).all(morningBriefing.created_at);

  const shouldCreate = await shouldCreateEveningBriefing({ morningBriefing, eveningArticles });
  if (!shouldCreate) {
    return {
      date,
      crawlResults,
      created: false,
      articleCount: eveningArticles.length,
      reason: 'Nicht genug große neue Entwicklungen seit dem Morgen.'
    };
  }

  const summary = await createEveningBriefingText({ morningBriefing, eveningArticles });
  const title = 'Skandinavien-Abendbriefing';
  const articleIds = JSON.stringify(eveningArticles.map((article) => article.id));
  const briefingDate = `${date}T18:30:00`;

  db.prepare(`
    INSERT INTO briefings (briefing_date, briefing_type, title, summary, article_ids)
    VALUES (?, 'evening', ?, ?, ?)
    ON CONFLICT(briefing_date) DO UPDATE SET
      briefing_type = 'evening',
      title = excluded.title,
      summary = excluded.summary,
      article_ids = excluded.article_ids,
      created_at = CURRENT_TIMESTAMP
  `).run(briefingDate, title, summary, articleIds);

  return {
    date,
    crawlResults,
    created: true,
    articleCount: eveningArticles.length,
    llmConfigured: isLlmConfigured()
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runDailyBriefing()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

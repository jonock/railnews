import { db } from '../db.js';
import { crawlSources } from '../crawler.js';
import { createBriefingText } from '../llm.js';

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
  const articles = db.prepare(`
    SELECT articles.*, sources.name AS source_name
    FROM articles
    JOIN sources ON sources.id = articles.source_id
    WHERE date(COALESCE(articles.published_at, articles.created_at)) >= date(?, '-2 day')
    ORDER BY COALESCE(articles.published_at, articles.created_at) DESC
    LIMIT 30
  `).all(date);

  const summary = await createBriefingText(articles);
  const title = `Skandinavien-Bahnbriefing - ${date}`;
  const articleIds = JSON.stringify(articles.map((article) => article.id));

  db.prepare(`
    INSERT INTO briefings (briefing_date, title, summary, article_ids)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(briefing_date) DO UPDATE SET
      title = excluded.title,
      summary = excluded.summary,
      article_ids = excluded.article_ids,
      created_at = CURRENT_TIMESTAMP
  `).run(date, title, summary, articleIds);

  return { date, crawlResults, articleCount: articles.length };
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

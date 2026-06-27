import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config.js';
import { db as articlesDb } from './db.js';

const rollingStockPath = path.resolve(
  process.env.ROLLING_STOCK_DATABASE_PATH || './data/rolling-stock.sqlite'
);
const seedPath = path.resolve('./data/rolling-stock-seed.json');

fs.mkdirSync(path.dirname(rollingStockPath), { recursive: true });

export const rollingStockDb = new Database(rollingStockPath);
rollingStockDb.pragma('journal_mode = WAL');

rollingStockDb.exec(`
  CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    name_de TEXT NOT NULL,
    name_sv TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('lok_wagen', 'triebzuege', 'sonstiges')),
    operator TEXT NOT NULL,
    manufacturer TEXT NOT NULL DEFAULT '',
    count TEXT NOT NULL DEFAULT '',
    max_speed_kmh INTEGER,
    formation TEXT NOT NULL DEFAULT '',
    routes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active'
      CHECK(status IN ('active', 'refurbishment', 'on_order', 'legacy', 'testing')),
    summary_de TEXT NOT NULL DEFAULT '',
    summary_sv TEXT NOT NULL DEFAULT '',
    article_keywords TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

export const CATEGORIES = {
  lok_wagen: { de: 'Lok & Wagen', sv: 'Lok & vagnar' },
  triebzuege: { de: 'Triebzüge', sv: 'Motorvagnståg' },
  sonstiges: { de: 'Sonstiges', sv: 'Övrigt' }
};

export const OPERATORS = [
  'SJ',
  'Snälltåget',
  'VR Sverige',
  'Inlandsbanan',
  'Norrtåg / Transitio',
  'Green Cargo',
  'Regional'
];

function seedRollingStock() {
  const count = rollingStockDb.prepare('SELECT COUNT(*) AS count FROM vehicles').get().count;
  if (count > 0) return;

  if (!fs.existsSync(seedPath)) {
    console.warn(`Rolling stock seed file not found: ${seedPath}`);
    return;
  }

  const entries = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  const insert = rollingStockDb.prepare(`
    INSERT INTO vehicles (
      slug, name_de, name_sv, category, operator, manufacturer, count,
      max_speed_kmh, formation, routes, status, summary_de, summary_sv, article_keywords
    ) VALUES (
      @slug, @name_de, @name_sv, @category, @operator, @manufacturer, @count,
      @max_speed_kmh, @formation, @routes, @status, @summary_de, @summary_sv, @article_keywords
    )
  `);

  const tx = rollingStockDb.transaction((items) => {
    items.forEach((item) => insert.run({
      ...item,
      max_speed_kmh: item.max_speed_kmh ?? null
    }));
  });
  tx(entries);
}

seedRollingStock();

function mapVehicle(row) {
  if (!row) return null;
  return {
    ...row,
    category_label: CATEGORIES[row.category] || { de: row.category, sv: row.category }
  };
}

export function getRollingStockCatalog() {
  const vehicles = rollingStockDb.prepare(`
    SELECT slug, name_de, name_sv, category, operator, status, max_speed_kmh
    FROM vehicles
    ORDER BY
      CASE category
        WHEN 'lok_wagen' THEN 1
        WHEN 'triebzuege' THEN 2
        WHEN 'sonstiges' THEN 3
        ELSE 4
      END,
      name_de COLLATE NOCASE
  `).all();

  return {
    categories: CATEGORIES,
    operators: OPERATORS,
    vehicles: vehicles.map((vehicle) => ({
      ...vehicle,
      category_label: CATEGORIES[vehicle.category]
    }))
  };
}

export function getVehicleBySlug(slug) {
  const row = rollingStockDb.prepare('SELECT * FROM vehicles WHERE slug = ?').get(slug);
  return mapVehicle(row);
}

function escapeLikePattern(value) {
  return String(value).replace(/[%_\\]/g, '\\$&');
}

function parseKeywords(raw) {
  return String(raw || '')
    .split(',')
    .map((keyword) => keyword.trim())
    .filter(Boolean);
}

const rollingStockTopicLabels = new Set([
  'Fahrzeuge und Signaltechnik',
  'Rolling stock and signalling'
]);

function articleMatchesRollingStockTopic(matchedTopicsRaw) {
  try {
    const topics = JSON.parse(matchedTopicsRaw || '[]');
    return topics.some((topic) => rollingStockTopicLabels.has(topic));
  } catch {
    return false;
  }
}

function keywordScore(haystackTitle, haystackExcerpt, keyword) {
  const normalized = keyword.toLowerCase();
  const title = haystackTitle.toLowerCase();
  const excerpt = haystackExcerpt.toLowerCase();
  let score = 0;

  if (title.includes(normalized)) score += 4;
  else if (excerpt.includes(normalized)) score += 1;

  if (normalized.length >= 10) score += 1;
  return score;
}

export function getRelatedArticlesForVehicle(slug, limit = 8) {
  const vehicle = getVehicleBySlug(slug);
  if (!vehicle) return { vehicle: null, articles: [] };

  const keywords = parseKeywords(vehicle.article_keywords);
  if (keywords.length === 0) {
    return { vehicle: { slug: vehicle.slug, name_de: vehicle.name_de }, articles: [] };
  }

  const cappedLimit = Math.max(1, Math.min(Math.trunc(Number(limit) || 8), 20));
  const conditions = [];
  const params = [];

  keywords.forEach((keyword) => {
    const pattern = `%${escapeLikePattern(keyword)}%`;
    conditions.push('(LOWER(articles.title) LIKE LOWER(?) ESCAPE \'\\\' OR LOWER(articles.excerpt) LIKE LOWER(?) ESCAPE \'\\\')');
    params.push(pattern, pattern);
  });

  const sql = `
    SELECT articles.*, sources.name AS source_name
    FROM articles
    JOIN sources ON sources.id = articles.source_id
    WHERE ${conditions.join(' OR ')}
    ORDER BY COALESCE(articles.published_at, articles.created_at) DESC, articles.id DESC
  `;

  const rows = articlesDb.prepare(sql).all(...params);
  const scored = new Map();

  for (const row of rows) {
    if (scored.has(row.id)) continue;

    let score = 0;
    keywords.forEach((keyword) => {
      score += keywordScore(row.title, row.excerpt, keyword);
    });

    if (articleMatchesRollingStockTopic(row.matched_topics)) score += 1;
    if (score === 0) continue;

    scored.set(row.id, {
      ...row,
      match_score: score,
      rolling_stock_topic: articleMatchesRollingStockTopic(row.matched_topics)
    });
  }

  const articles = [...scored.values()]
    .sort((left, right) => {
      if (right.match_score !== left.match_score) return right.match_score - left.match_score;
      const leftDate = new Date(left.published_at || left.created_at).getTime() || 0;
      const rightDate = new Date(right.published_at || right.created_at).getTime() || 0;
      if (rightDate !== leftDate) return rightDate - leftDate;
      return right.id - left.id;
    })
    .slice(0, cappedLimit)
    .map(({ match_score, ...article }) => article);

  return {
    vehicle: { slug: vehicle.slug, name_de: vehicle.name_de, name_sv: vehicle.name_sv },
    articles
  };
}

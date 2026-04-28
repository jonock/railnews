import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

export const db = new Database(config.databasePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    keywords TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL UNIQUE,
    keywords TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS articles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    url TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    excerpt TEXT NOT NULL DEFAULT '',
    published_at TEXT,
    matched_topics TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS briefings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    briefing_date TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    article_ids TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS crawl_failures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    error_message TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const sourceColumns = db.prepare('PRAGMA table_info(sources)').all().map((column) => column.name);
if (!sourceColumns.includes('keywords')) {
  db.exec("ALTER TABLE sources ADD COLUMN keywords TEXT NOT NULL DEFAULT ''");
}

const defaultSources = [
  ['LOK Report', 'https://www.lok-report.de/', 'Schweden,Norwegen,Dänemark,Finnland,Skandinavien,Trafikverket,Bane NOR,Banedanmark,DSB,SJ,VR', 1],
  ['Järnvägar.nu', 'https://jarnvagar.nu/', 'järnväg,tåg,spår,trafik,underhåll,Ostlänken,Malmbanan,X2000,SJ,Trafikverket,nationella planen,nattåg', 1],
  ['RAILMARKET Sweden', 'https://railmarket.com/eu/sweden/news', 'Sweden,Swedish,SJ,Trafikverket,Green Cargo,Transitio,Norrtåg,Stockholm,Gothenburg,Malmö,Kiruna', 1],
  ['Manuelle Meldungen', 'https://railnews.local/manual-stories', 'manuell,Einreichung,Story', 0]
];

const insertSource = db.prepare('INSERT OR IGNORE INTO sources (name, url, keywords, active) VALUES (?, ?, ?, ?)');
const updateEmptySourceKeywords = db.prepare("UPDATE sources SET keywords = ? WHERE url = ? AND TRIM(keywords) = ''");
defaultSources.forEach(([name, url, keywords, active]) => {
  insertSource.run(name, url, keywords, active);
  updateEmptySourceKeywords.run(keywords, url);
});

const topicCount = db.prepare('SELECT COUNT(*) AS count FROM topics').get().count;
if (topicCount === 0) {
  const insertTopic = db.prepare('INSERT INTO topics (label, keywords) VALUES (?, ?)');
  [
    ['Betrieb und Infrastruktur', 'Bahn,Eisenbahn,Zug,Strecke,Infrastruktur,railway,train,line,infrastructure,Korridor,järnväg,tåg,spår,trafik,underhåll,Malmbanan,Ostlänken'],
    ['Projekte und Ausschreibungen', 'Ausschreibung,Vergabe,Projekt,Modernisierung,contract,tender,upgrade,Ausbau,upphandling,investering,nationella planen'],
    ['Fahrzeuge und Signaltechnik', 'Fahrzeug,Triebzug,Lokomotive,ERTMS,ETCS,Signal,rolling stock,locomotive,fordon,signalsystem,X2000']
  ].forEach(([label, keywords]) => insertTopic.run(label, keywords));
}

const renameTopic = db.prepare('UPDATE topics SET label = ? WHERE label = ?');
renameTopic.run('Betrieb und Infrastruktur', 'Operations and infrastructure');
renameTopic.run('Projekte und Ausschreibungen', 'Projects and tenders');
renameTopic.run('Fahrzeuge und Signaltechnik', 'Rolling stock and signalling');

function appendTopicKeywords(label, keywords) {
  const topic = db.prepare('SELECT id, keywords FROM topics WHERE label = ?').get(label);
  if (!topic) return;
  const existing = new Set(topic.keywords.split(',').map((keyword) => keyword.trim()).filter(Boolean));
  keywords.forEach((keyword) => existing.add(keyword));
  db.prepare('UPDATE topics SET keywords = ? WHERE id = ?').run([...existing].join(','), topic.id);
}

appendTopicKeywords('Betrieb und Infrastruktur', ['järnväg', 'tåg', 'spår', 'trafik', 'underhåll', 'Malmbanan', 'Ostlänken']);
appendTopicKeywords('Projekte und Ausschreibungen', ['upphandling', 'investering', 'nationella planen']);
appendTopicKeywords('Fahrzeuge und Signaltechnik', ['fordon', 'signalsystem', 'X2000']);

function seedStarterContent() {
  const articleCount = db.prepare('SELECT COUNT(*) AS count FROM articles').get().count;
  if (articleCount > 0) return;

  const sources = Object.fromEntries(db.prepare('SELECT id, name FROM sources').all().map((source) => [source.name, source.id]));
  const insertArticle = db.prepare(`
    INSERT OR IGNORE INTO articles (source_id, url, title, excerpt, published_at, matched_topics)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const starterArticles = [
    [
      sources['Järnvägar.nu'],
      'https://jarnvagar.nu/stopp-for-ostlanken-och-tenhult-byarum/',
      'Stopp för Ostlänken och Tenhult–Byarum',
      'Die schwedische Infrastrukturplanung verschiebt Prioritäten: Ostlänken wird gekürzt, Tenhult–Byarum gestoppt und andere Bahnprojekte werden neu bewertet.',
      '2026-04-28T08:00:00+02:00',
      ['Betrieb und Infrastruktur', 'Projekte und Ausschreibungen']
    ],
    [
      sources['Järnvägar.nu'],
      'https://jarnvagar.nu/okad-satsning-pa-malmbanan/',
      'Ökad satsning på Malmbanan',
      'Mehr Aufmerksamkeit für die Malmbanan: Die wichtige Erzbahn im Norden bleibt ein Schwerpunkt für Kapazität, Unterhalt und robuste Güterverkehre.',
      '2026-04-27T08:00:00+02:00',
      ['Betrieb und Infrastruktur']
    ],
    [
      sources['Järnvägar.nu'],
      'https://jarnvagar.nu/totalstopp-for-x2000-efter-hjulskada/',
      'Totalstopp för X2000 efter hjulskada',
      'SJ stoppte den X2000-Verkehr nach einem Radschaden vorübergehend. Der Vorfall zeigt, wie sensibel Fahrzeugverfügbarkeit und Flottenkontrolle bleiben.',
      '2026-04-26T08:00:00+02:00',
      ['Fahrzeuge und Signaltechnik']
    ]
  ];

  const articleIds = [];
  starterArticles.forEach(([sourceId, url, title, excerpt, publishedAt, topics]) => {
    if (!sourceId) return;
    const result = insertArticle.run(sourceId, url, title, excerpt, publishedAt, JSON.stringify(topics));
    const article = db.prepare('SELECT id FROM articles WHERE url = ?').get(url);
    if (article) articleIds.push(article.id);
  });

  db.prepare(`
    INSERT OR IGNORE INTO briefings (briefing_date, title, summary, article_ids)
    VALUES (?, ?, ?, ?)
  `).run(
    '2026-04-28',
    'Skandinavien-Bahnbriefing - 2026-04-28',
    [
      'Schweden steht diese Woche im Mittelpunkt: Die neue Infrastrukturplanung verschiebt einzelne Projektprioritäten, während die Malmbanan weiter als strategische Güterachse hervorsticht.',
      '',
      'Besonders relevant sind die Entscheidungen rund um Ostlänken und Tenhult–Byarum. Sie zeigen, dass Kapazitätsausbau, Finanzierung und Umsetzbarkeit stärker gegeneinander abgewogen werden.',
      '',
      'Im Fahrzeugbereich bleibt die X2000-Flotte im Blick. Der kurzzeitige Verkehrsstopp nach einem Radschaden unterstreicht die Bedeutung von Verfügbarkeit und technischer Überwachung im Fernverkehr.'
    ].join('\n'),
    JSON.stringify(articleIds)
  );
}

seedStarterContent();

export function listSources() {
  return db.prepare('SELECT * FROM sources ORDER BY name').all();
}

export function listTopics() {
  return db.prepare('SELECT * FROM topics ORDER BY label').all();
}

export function latestBriefings(limit = 14) {
  return db.prepare('SELECT * FROM briefings ORDER BY briefing_date DESC LIMIT ?').all(limit);
}

export function latestArticles(limit = 50) {
  return db.prepare(`
    SELECT articles.*, sources.name AS source_name
    FROM articles
    JOIN sources ON sources.id = articles.source_id
    ORDER BY COALESCE(articles.published_at, articles.created_at) DESC, articles.id DESC
    LIMIT ?
  `).all(limit);
}

export function logCrawlFailures(failures) {
  if (!Array.isArray(failures) || failures.length === 0) return;
  const insertFailure = db.prepare(`
    INSERT INTO crawl_failures (source_name, source_url, error_message)
    VALUES (?, ?, ?)
  `);
  const pruneFailures = db.prepare(`
    DELETE FROM crawl_failures
    WHERE id NOT IN (
      SELECT id FROM crawl_failures ORDER BY created_at DESC, id DESC LIMIT 200
    )
  `);

  const tx = db.transaction((items) => {
    items.forEach((item) => {
      insertFailure.run(item.sourceName, item.sourceUrl, item.errorMessage);
    });
    pruneFailures.run();
  });

  tx(failures);
}

export function latestCrawlFailures(limit = 30) {
  return db.prepare(`
    SELECT id, source_name, source_url, error_message, created_at
    FROM crawl_failures
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `).all(limit);
}

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
`);

const sourceCount = db.prepare('SELECT COUNT(*) AS count FROM sources').get().count;
if (sourceCount === 0) {
  db.prepare('INSERT INTO sources (name, url) VALUES (?, ?)').run('LOK Report', 'https://www.lok-report.de/');
}

const topicCount = db.prepare('SELECT COUNT(*) AS count FROM topics').get().count;
if (topicCount === 0) {
  const insertTopic = db.prepare('INSERT INTO topics (label, keywords) VALUES (?, ?)');
  [
    ['Betrieb und Infrastruktur', 'Bahn,Eisenbahn,Zug,Strecke,Infrastruktur,railway,train,line,infrastructure,Korridor'],
    ['Projekte und Ausschreibungen', 'Ausschreibung,Vergabe,Projekt,Modernisierung,contract,tender,upgrade,Ausbau'],
    ['Fahrzeuge und Signaltechnik', 'Fahrzeug,Triebzug,Lokomotive,ERTMS,ETCS,Signal,rolling stock,locomotive']
  ].forEach(([label, keywords]) => insertTopic.run(label, keywords));
}

const renameTopic = db.prepare('UPDATE topics SET label = ? WHERE label = ?');
renameTopic.run('Betrieb und Infrastruktur', 'Operations and infrastructure');
renameTopic.run('Projekte und Ausschreibungen', 'Projects and tenders');
renameTopic.run('Fahrzeuge und Signaltechnik', 'Rolling stock and signalling');

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

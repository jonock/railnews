import * as cheerio from 'cheerio';
import { db, listSources, listTopics } from './db.js';
import { config } from './config.js';

const USER_AGENT = 'RailnewsBot/0.1 (+daily railway briefing; contact site owner)';

function absoluteUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function cleanText(value) {
  return value.replace(/\s+/g, ' ').trim();
}

function parseGermanDate(text) {
  const months = {
    januar: '01',
    februar: '02',
    märz: '03',
    maerz: '03',
    april: '04',
    mai: '05',
    juni: '06',
    juli: '07',
    august: '08',
    september: '09',
    oktober: '10',
    november: '11',
    dezember: '12'
  };
  const match = cleanText(text).match(/(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)\s*(\d{4})(?:\s*(\d{1,2}):(\d{2}))?/);
  if (!match) return null;
  const [, day, monthName, year, hour = '00', minute = '00'] = match;
  const month = months[monthName.toLowerCase().replace('ä', 'ae')];
  if (!month) return null;
  return `${year}-${month}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}:00+01:00`;
}

function toIsoDateTime(year, month, day) {
  if (!year || !month || !day) return null;
  const y = String(year);
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  if (!/^\d{4}$/.test(y) || !/^\d{2}$/.test(m) || !/^\d{2}$/.test(d)) return null;
  return `${y}-${m}-${d}T00:00:00Z`;
}

function parseRailmarketDateFromText(text) {
  const normalized = cleanText(text);
  if (!normalized) return null;

  const ymd = normalized.match(/\b(20\d{2})[./-](\d{1,2})[./-](\d{1,2})\b/);
  if (ymd) return toIsoDateTime(ymd[1], ymd[2], ymd[3]);

  const dmy = normalized.match(/\b(\d{1,2})[./-](\d{1,2})[./-](20\d{2})\b/);
  if (dmy) return toIsoDateTime(dmy[3], dmy[2], dmy[1]);

  const monthMap = {
    january: '01',
    february: '02',
    march: '03',
    april: '04',
    may: '05',
    june: '06',
    july: '07',
    august: '08',
    september: '09',
    october: '10',
    november: '11',
    december: '12'
  };
  const monthName = normalized.match(/\b([A-Za-z]+)\s+(\d{1,2}),\s*(20\d{2})\b/);
  if (monthName) {
    const month = monthMap[monthName[1].toLowerCase()];
    if (month) return toIsoDateTime(monthName[3], month, monthName[2]);
  }

  return null;
}

function parseRailmarketDate($, element, container, articleUrl) {
  const parseIsoCandidate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  };

  const elementDate = $(element).attr('datetime') || $(element).find('time[datetime]').first().attr('datetime');
  const elementIso = parseIsoCandidate(elementDate);
  if (elementIso) return elementIso;

  const containerDate = container.find('time[datetime], [datetime]').first().attr('datetime');
  const containerIso = parseIsoCandidate(containerDate);
  if (containerIso) return containerIso;

  const fromText = parseRailmarketDateFromText(container.text());
  if (fromText) return fromText;

  const fromUrl = articleUrl.match(/\/(20\d{2})[/-](\d{1,2})[/-](\d{1,2})(?:[/-]|$)/);
  if (fromUrl) return toIsoDateTime(fromUrl[1], fromUrl[2], fromUrl[3]);

  return null;
}

function topicMatches(article, topics) {
  const haystack = `${article.title} ${article.excerpt}`.toLowerCase();
  return topics
    .filter((topic) => topic.active)
    .filter((topic) => topic.keywords.split(',').some((keyword) => haystack.includes(keyword.trim().toLowerCase())))
    .map((topic) => topic.label);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesFocus(article) {
  const haystack = `${article.title} ${article.excerpt}`.toLowerCase();
  return config.focusKeywords.some((keyword) => {
    if (keyword.length <= 3) {
      return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(keyword)}([^\\p{L}\\p{N}]|$)`, 'iu').test(haystack);
    }
    return haystack.includes(keyword);
  });
}

function matchesSourceKeywords(article, source) {
  const keywords = source.keywords?.split(',').map((keyword) => keyword.trim().toLowerCase()).filter(Boolean) || [];
  if (keywords.length === 0) return matchesFocus(article);

  const haystack = `${article.title} ${article.excerpt}`.toLowerCase();
  return keywords.some((keyword) => {
    if (keyword.length <= 3) {
      return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(keyword)}([^\\p{L}\\p{N}]|$)`, 'iu').test(haystack);
    }
    return haystack.includes(keyword);
  });
}

function sourceImpliesFocus(source) {
  return source.url.includes('jarnvagar.nu') || source.url.includes('railmarket.com/eu/sweden');
}

function extractLokReport($, source) {
  const articles = [];
  $('a').each((_, element) => {
    const href = $(element).attr('href');
    const url = absoluteUrl(href, source.url);
    const title = cleanText($(element).text());
    if (!url || title.length < 12 || /weiterlesen/i.test(title)) return;
    if (!url.includes('lok-report.de/news/')) return;

    const container = $(element).closest('article, .item, .catItemView, .latestItemView, .blog-item');
    const excerpt = cleanText(container.text()).slice(0, 900);
    const publishedAt = parseGermanDate(excerpt);

    articles.push({ url, title, excerpt, publishedAt });
  });

  return articles;
}

function extractGeneric($, source) {
  const articles = [];
  $('article a[href], h1 a[href], h2 a[href], h3 a[href], .item a[href]').each((_, element) => {
    const url = absoluteUrl($(element).attr('href'), source.url);
    const title = cleanText($(element).text());
    if (!url || title.length < 12) return;
    const container = $(element).closest('article, .item, div');
    articles.push({
      url,
      title,
      excerpt: cleanText(container.text()).slice(0, 900),
      publishedAt: null
    });
  });
  return articles;
}

function extractJarnvagar($, source) {
  const articles = [];
  $('article.et_pb_post, article.post').each((_, element) => {
    const link = $(element).find('h2 a[href], .entry-title a[href], a[href]').first();
    const url = absoluteUrl(link.attr('href'), source.url);
    const title = cleanText(link.text());
    if (!url || title.length < 12) return;

    const excerpt = cleanText($(element).find('.post-content, .entry-summary, p').text() || $(element).text()).slice(0, 900);
    articles.push({ url, title, excerpt, publishedAt: null });
  });
  return articles;
}

function extractRailmarket($, source) {
  const articles = [];
  $('a[href]').each((_, element) => {
    const url = absoluteUrl($(element).attr('href'), source.url);
    const title = cleanText($(element).text());
    if (!url || title.length < 12) return;
    if (!url.includes('railmarket.com/news/')) return;

    const container = $(element).closest('article, li, .card, div');
    articles.push({
      url,
      title,
      excerpt: cleanText(container.text()).slice(0, 900),
      publishedAt: parseRailmarketDate($, element, container, url)
    });
  });
  return articles;
}

function extractArticles($, source) {
  if (source.url.includes('lok-report.de')) return extractLokReport($, source);
  if (source.url.includes('jarnvagar.nu')) return extractJarnvagar($, source);
  if (source.url.includes('railmarket.com')) return extractRailmarket($, source);
  return extractGeneric($, source);
}

export async function crawlSources() {
  const sources = listSources().filter((source) => source.active);
  const topics = listTopics();
  const insert = db.prepare(`
    INSERT INTO articles (source_id, url, title, excerpt, published_at, matched_topics)
    VALUES (@sourceId, @url, @title, @excerpt, @publishedAt, @matchedTopics)
    ON CONFLICT(url) DO UPDATE SET
      title = excluded.title,
      excerpt = excluded.excerpt,
      published_at = COALESCE(excluded.published_at, articles.published_at),
      matched_topics = excluded.matched_topics
  `);

  const results = [];
  for (const source of sources) {
    try {
      const response = await fetch(source.url, {
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/html,application/xhtml+xml'
        }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const html = await response.text();
      if (/Just a moment|challenges\.cloudflare\.com/i.test(html)) {
        throw new Error('Cloudflare challenge');
      }

      const $ = cheerio.load(html);
      const extracted = extractArticles($, source);
      const seen = new Set();
      let saved = 0;

      for (const article of extracted) {
        if (seen.has(article.url)) continue;
        seen.add(article.url);
        if (!sourceImpliesFocus(source) && !matchesSourceKeywords(article, source)) continue;
        const matches = topicMatches(article, topics);
        insert.run({
          sourceId: source.id,
          url: article.url,
          title: article.title,
          excerpt: article.excerpt,
          publishedAt: article.publishedAt,
          matchedTopics: JSON.stringify(matches.length ? matches : ['Allgemein'])
        });
        saved += 1;
      }

      results.push({ source: source.name, found: extracted.length, saved });
    } catch (error) {
      results.push({ source: source.name, found: 0, saved: 0, error: error.message });
    }
  }

  return results;
}

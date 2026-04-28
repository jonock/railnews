import path from 'node:path';
import fs from 'node:fs';

function loadDotEnv() {
  const envPath = path.resolve('.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, '');

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

export const config = {
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || '0.0.0.0',
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:3000',
  databasePath: path.resolve(process.env.DATABASE_PATH || './data/railnews.sqlite'),
  adminToken: process.env.ADMIN_TOKEN || '',
  cronSecret: process.env.CRON_SECRET || '',
  briefingCron: process.env.BRIEFING_CRON || '15 6 * * *',
  briefingTimezone: process.env.BRIEFING_TIMEZONE || 'Europe/Zurich',
  focusKeywords: (process.env.FOCUS_KEYWORDS || 'Schweden,Norwegen,Dänemark,Finnland,Skandinavien,Sweden,Norway,Denmark,Finland,Scandinavia,Trafikverket,Bane NOR,Banedanmark,Väylävirasto,DSB,SJ,VR')
    .split(',')
    .map((keyword) => keyword.trim().toLowerCase())
    .filter(Boolean),
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    model: process.env.OPENAI_MODEL || 'gpt-4.1-mini'
  }
};

import path from 'node:path';

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

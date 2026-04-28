import { config } from './config.js';

function extractiveBriefing(articles) {
  if (articles.length === 0) {
    return 'No matching Scandinavian railway updates were found today.';
  }

  return articles.map((article) => {
    const topics = JSON.parse(article.matched_topics || '[]').join(', ');
    const excerpt = article.excerpt.replace(article.title, '').trim().slice(0, 360);
    return `- ${article.title}${topics ? ` (${topics})` : ''}\n  ${excerpt}\n  Link: ${article.url}`;
  }).join('\n\n');
}

export async function createBriefingText(articles) {
  if (!config.openai.apiKey) return extractiveBriefing(articles);

  const input = [
    {
      role: 'system',
      content: 'Du schreibst knappe tägliche Briefings zur Eisenbahnbranche auf Deutsch. Erhalte Quellenlinks unverändert. Fokussiere auf Skandinavien und praktische Auswirkungen für die Branche.'
    },
    {
      role: 'user',
      content: `Erstelle ein deutsches Tagesbriefing aus diesen Artikeln. Gruppiere zusammengehörige Meldungen, erkläre kurz die Relevanz und nenne jede Quellen-URL.\n\n${JSON.stringify(articles, null, 2)}`
    }
  ];

  const response = await fetch(`${config.openai.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.openai.apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: config.openai.model,
      messages: input,
      temperature: 0.2
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Briefing LLM request failed: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || extractiveBriefing(articles);
}

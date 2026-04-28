import { config } from './config.js';

function extractiveBriefing(articles) {
  if (articles.length === 0) {
    return 'Heute wurden keine passenden Eisenbahnmeldungen aus Skandinavien gefunden.';
  }

  const intro = 'Automatisch erzeugtes deutschsprachiges Kurzbriefing auf Basis der gefundenen Quellenmeldungen.';
  const items = articles.map((article) => {
    const topics = JSON.parse(article.matched_topics || '[]').join(', ');
    const source = article.source_name ? ` von ${article.source_name}` : '';
    return `- Originaltitel: ${article.title}${topics ? ` (${topics})` : ''}\n  Einordnung: Diese Meldung${source} wurde als relevant für das skandinavische Bahnmonitoring erkannt. Bitte die Quelle für Details, Zahlen und Originalformulierungen prüfen.\n  Quelle: ${article.url}`;
  }).join('\n\n');

  return `${intro}\n\n${items}`;
}

export async function createBriefingText(articles) {
  if (!config.openai.apiKey) return extractiveBriefing(articles);

  const input = [
    {
      role: 'system',
      content: 'Du schreibst ausschließlich auf Deutsch. Du erstellst knappe tägliche Briefings zur Eisenbahnbranche. Übersetze fremdsprachige Inhalte sinngemäß ins Deutsche, erhalte Quellenlinks unverändert und fokussiere auf Skandinavien sowie praktische Auswirkungen für die Branche.'
    },
    {
      role: 'user',
      content: `Erstelle ein Tagesbriefing vollständig auf Deutsch aus diesen Artikeln. Gruppiere zusammengehörige Meldungen, übersetze schwedische oder englische Titel/Inhalte sinngemäß, erkläre kurz die Relevanz und nenne jede Quellen-URL.\n\n${JSON.stringify(articles, null, 2)}`
    }
  ];

  try {
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
      console.error(`Briefing-LLM-Anfrage fehlgeschlagen: ${response.status} ${error}`);
      return extractiveBriefing(articles);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || extractiveBriefing(articles);
  } catch (error) {
    console.error('Briefing-LLM-Anfrage fehlgeschlagen:', error);
    return extractiveBriefing(articles);
  }
}

export function isLlmConfigured() {
  return Boolean(config.openai.apiKey);
}

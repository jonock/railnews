import { config } from './config.js';

function extractiveBriefing(articles) {
  if (articles.length === 0) {
    return 'Heute wurden keine passenden Eisenbahnmeldungen aus Skandinavien gefunden.';
  }

  const grouped = new Map();
  for (const article of articles) {
    const topics = JSON.parse(article.matched_topics || '[]');
    const primaryTopic = topics[0] || 'Allgemeine Entwicklungen';
    if (!grouped.has(primaryTopic)) grouped.set(primaryTopic, []);
    grouped.get(primaryTopic).push(article);
  }

  const sections = [...grouped.entries()].map(([topic, topicArticles]) => {
    const paragraphs = topicArticles.map((article) => {
      const source = article.source_name ? ` (${article.source_name})` : '';
      return `${article.title}${source}. Quelle: ${article.url}`;
    }).join('\n\n');
    return `## ${topic}\n${paragraphs}`;
  }).join('\n\n');

  return `Automatisch erzeugtes deutschsprachiges Kurzbriefing auf Basis der gefundenen Quellenmeldungen.\n\n${sections}`;
}

export async function createBriefingText(articles) {
  if (!config.openai.apiKey) return extractiveBriefing(articles);

  const input = [
    {
      role: 'system',
      content: 'Du schreibst ausschließlich auf Deutsch. Du erstellst knappe tägliche Briefings zur Eisenbahnbranche. Übersetze fremdsprachige Inhalte sinngemäß ins Deutsche, erhalte Quellenlinks unverändert und fokussiere auf Skandinavien sowie praktische Auswirkungen für die Branche. Antworte mit klaren Zwischentiteln und kurzen Absätzen.'
    },
    {
      role: 'user',
      content: `Erstelle ein Tagesbriefing vollständig auf Deutsch aus diesen Artikeln.

Formatvorgaben:
- Verwende nur Zwischentitel (Markdown "## ...") und darunter kurze Absätze.
- KEINE nummerierten Listen.
- KEINE Bullet-Listen.
- Jeder Absatz muss mindestens eine konkrete Quellen-URL enthalten.
- Gruppiere zusammengehörige Meldungen pro Zwischentitel.
- Beende mit einem kurzen Abschnitt "## Einordnung" als Fließtext.

Inhalt:
- Übersetze schwedische oder englische Titel/Inhalte sinngemäß.
- Erkläre kurz die Relevanz für die Bahnbranche in Skandinavien.

Artikel:
${JSON.stringify(articles, null, 2)}`
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

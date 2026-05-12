import { config } from './config.js';

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function compactRecentBriefings(recentBriefings = []) {
  const briefings = Array.isArray(recentBriefings) ? recentBriefings : [];
  return briefings.map((briefing) => ({
    datum: briefing.briefing_date,
    typ: briefing.briefing_type || 'daily',
    titel: briefing.title,
    zusammenfassung: String(briefing.summary || '').slice(0, 2500),
    artikel_ids: parseJsonArray(briefing.article_ids)
  }));
}

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

export async function createBriefingText(articles, options = {}) {
  if (!config.openai.apiKey) return extractiveBriefing(articles);

  const recentBriefings = compactRecentBriefings(options.recentBriefings);

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
- Wiederhole keine Artikel, URLs oder inhaltlich gleichen Meldungen aus den letzten Briefings.
- Wenn ein Artikel nur eine bereits berichtete Meldung ohne substanzielle neue Entwicklung wiederholt, lasse ihn weg.
- Falls es zu einem früher erwähnten Thema wirklich neue Fakten gibt, benenne nur die neue Entwicklung und formuliere sie klar als Update.
- Beende mit einem kurzen Abschnitt "## Einordnung" als Fließtext.

Inhalt:
- Übersetze schwedische oder englische Titel/Inhalte sinngemäß.
- Erkläre kurz die Relevanz für die Bahnbranche in Skandinavien.
- Wenn eine Meldung eine Staatsbahn betrifft, formuliere kollegial mit Bezug auf die jeweilige Bahn: SJ als schwedische Staatsbahn, Vy als norwegische Staatsbahn, DSB als dänische Staatsbahn und VR als finnische Staatsbahn. Nutze dabei Formulierungen wie "Bei den Kollegen der dänischen Staatsbahn DSB ..." oder eine passende natürliche Variante.

Letzte Briefings als Ausschluss-Kontext (nicht wiederholen):
${JSON.stringify(recentBriefings, null, 2)}

Neue Kandidatenartikel für dieses Tagesbriefing:
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

export async function shouldCreateEveningBriefing({ morningBriefing, eveningArticles }) {
  if (eveningArticles.length < 5) return false;
  if (!config.openai.apiKey) return eveningArticles.length >= 7;

  const input = [
    {
      role: 'system',
      content: 'Du bewertest deutschsprachige Eisenbahn-Briefings nüchtern. Antworte ausschließlich mit kompaktem JSON.'
    },
    {
      role: 'user',
      content: `Entscheide, ob aus diesen neu gefundenen Abend-Artikeln ein zusätzliches Abend-Briefing entstehen soll.

Erstelle es nur, wenn es gegenüber dem Morgen-Briefing große neue Entwicklungen, viele substanzielle Zusatzmeldungen oder klare Schwerpunktverschiebungen gibt.

Antworte ausschließlich als JSON mit diesem Schema:
{"create":true|false,"reason":"kurze deutsche Begründung"}

Morgen-Briefing:
${morningBriefing?.summary || 'Kein Morgen-Briefing vorhanden.'}

Neue Abend-Artikel:
${JSON.stringify(eveningArticles, null, 2)}`
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
        temperature: 0
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Abend-Briefing-Evaluation fehlgeschlagen: ${response.status} ${error}`);
      return eveningArticles.length >= 7;
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() || '';
    const parsed = JSON.parse(text);
    return Boolean(parsed.create);
  } catch (error) {
    console.error('Abend-Briefing-Evaluation fehlgeschlagen:', error);
    return eveningArticles.length >= 7;
  }
}

export async function createEveningBriefingText({ morningBriefing, eveningArticles }) {
  if (!config.openai.apiKey) {
    return extractiveBriefing(eveningArticles);
  }

  const input = [
    {
      role: 'system',
      content: 'Du schreibst ausschließlich auf Deutsch. Du erstellst ein kurzes Abend-Update zur Eisenbahnbranche in Skandinavien. Der Ton ist fachlich, aber lockerer und leicht humorvoll. Du darfst freundlich über dänische Sprache, norwegische Zurückhaltung oder schwedisches Laissez-faire scherzen, aber nie verletzend, stereotyp-abwertend oder respektlos. Quellenlinks bleiben unverändert.'
    },
    {
      role: 'user',
      content: `Erstelle ein zusätzliches Abend-Briefing aus den neuen Artikeln. Es soll klar als Abend-Update funktionieren und nicht das Morgen-Briefing wiederholen.

Formatvorgaben:
- Verwende nur Zwischentitel (Markdown "## ...") und darunter kurze Absätze.
- KEINE nummerierten Listen.
- KEINE Bullet-Listen.
- Jeder Absatz muss mindestens eine konkrete Quellen-URL enthalten.
- Beende mit einem kurzen Abschnitt "## Feierabend-Einordnung" als lockerer Fließtext.

Inhalt:
- Konzentriere dich auf das, was seit dem Morgen neu oder deutlich wichtiger geworden ist.
- Formuliere etwas lockerer und pointierter als morgens.
- Wenn eine Meldung eine Staatsbahn betrifft, formuliere kollegial mit Bezug auf die jeweilige Bahn: SJ als schwedische Staatsbahn, Vy als norwegische Staatsbahn, DSB als dänische Staatsbahn und VR als finnische Staatsbahn.

Morgen-Briefing:
${morningBriefing?.summary || 'Kein Morgen-Briefing vorhanden.'}

Neue Abend-Artikel:
${JSON.stringify(eveningArticles, null, 2)}`
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
        temperature: 0.45
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Abend-Briefing-LLM-Anfrage fehlgeschlagen: ${response.status} ${error}`);
      return extractiveBriefing(eveningArticles);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || extractiveBriefing(eveningArticles);
  } catch (error) {
    console.error('Abend-Briefing-LLM-Anfrage fehlgeschlagen:', error);
    return extractiveBriefing(eveningArticles);
  }
}

export function isLlmConfigured() {
  return Boolean(config.openai.apiKey);
}

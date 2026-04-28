const briefingList = document.querySelector('#briefingList');
const articleList = document.querySelector('#articleList');

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

async function api(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(new Date(value));
}

function renderBriefings(briefings) {
  briefingList.innerHTML = briefings.length ? briefings.map((briefing) => `
    <article class="briefing-card">
      <p class="meta">${escapeHtml(briefing.briefing_date)}</p>
      <h3>${escapeHtml(briefing.title)}</h3>
      <pre>${escapeHtml(briefing.summary)}</pre>
    </article>
  `).join('') : '<p>Noch keine Briefings vorhanden.</p>';
}

function renderArticles(articles) {
  articleList.innerHTML = articles.length ? articles.map((article) => {
    const tags = JSON.parse(article.matched_topics || '[]');
    const date = article.published_at || article.created_at;
    return `
      <article class="article-card">
        <a href="${escapeHtml(article.url)}" target="_blank" rel="noreferrer">${escapeHtml(article.title)}</a>
        <div class="tags">${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>
        <p>${escapeHtml(article.excerpt.slice(0, 240))}</p>
        <small>${escapeHtml(article.source_name)}${date ? ` · ${escapeHtml(formatDate(date))}` : ''}</small>
      </article>
    `;
  }).join('') : '<p>Noch keine passenden Meldungen gefunden.</p>';
}

async function load() {
  const data = await api('/api/public');
  renderBriefings(data.briefings);
  renderArticles(data.articles);
}

load().catch((error) => {
  briefingList.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
});

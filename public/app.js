const briefingList = document.querySelector('#briefingList');
const articleList = document.querySelector('#articleList');
const storyDialog = document.querySelector('#storyDialog');
const storyStatus = document.querySelector('#storyStatus');
const storyTitle = document.querySelector('#storyTitle');
const storyUrl = document.querySelector('#storyUrl');
const storyExcerpt = document.querySelector('#storyExcerpt');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Service worker registration failed', error);
    });
  });
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    cache: 'no-store',
    ...options
  });
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
  const data = await api(`/api/public?t=${Date.now()}`);
  renderBriefings(data.briefings);
  renderArticles(data.articles);
}

document.querySelector('#openStoryDialog').addEventListener('click', () => {
  storyStatus.textContent = '';
  storyDialog.showModal();
});

document.querySelector('#cancelStory').addEventListener('click', () => {
  storyDialog.close();
});

document.querySelector('.story-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  storyStatus.textContent = 'Meldung wird gespeichert und Briefing neu erstellt...';

  try {
    await api('/api/public/stories', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: storyTitle.value,
        url: storyUrl.value,
        excerpt: storyExcerpt.value
      })
    });

    storyTitle.value = '';
    storyUrl.value = '';
    storyExcerpt.value = '';
    storyDialog.close();
    await load();
    document.querySelector('#briefing').scrollIntoView({ behavior: 'smooth' });
  } catch (error) {
    storyStatus.textContent = error.message;
  }
});

load().catch((error) => {
  briefingList.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
});

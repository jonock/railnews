const state = {
  token: localStorage.getItem('railnews.adminToken') || ''
};

const status = document.querySelector('#status');
const briefingList = document.querySelector('#briefingList');
const sourceList = document.querySelector('#sourceList');
const topicList = document.querySelector('#topicList');
const articleList = document.querySelector('#articleList');
const tokenDialog = document.querySelector('#tokenDialog');
const sourceDialog = document.querySelector('#sourceDialog');
const sourceIdInput = document.querySelector('#sourceIdInput');
const sourceNameInput = document.querySelector('#sourceNameInput');
const sourceUrlInput = document.querySelector('#sourceUrlInput');
const sourceKeywordsInput = document.querySelector('#sourceKeywordsInput');
const runBriefingButton = document.querySelector('#runBriefing');
const runCrawlButton = document.querySelector('#runCrawl');
const deleteTodayArticlesButton = document.querySelector('#deleteTodayArticles');

let currentSources = [];
let actionsBusy = false;

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function headers() {
  return {
    'content-type': 'application/json',
    ...(state.token ? { 'x-admin-token': state.token } : {})
  };
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) }
  });
  if (response.status === 401) {
    tokenDialog.showModal();
    throw new Error('Admin-Token erforderlich');
  }
  if (!response.ok) throw new Error(await response.text());
  return response.json();
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

function renderSources(sources) {
  currentSources = sources;
  sourceList.innerHTML = sources.map((source) => `
    <div class="mini-item">
      <strong>${escapeHtml(source.name)}</strong>
      <small>${escapeHtml(source.url)}</small>
      <small>${escapeHtml(source.keywords || 'Keine Keywords gesetzt')}</small>
      <small>${source.active ? 'Aktiv' : 'Pausiert'}</small>
      <button class="secondary edit-source" type="button" data-source-id="${source.id}">Keywords bearbeiten</button>
    </div>
  `).join('');
}

function renderTopics(topics) {
  topicList.innerHTML = topics.map((topic) => `
    <div class="mini-item">
      <strong>${escapeHtml(topic.label)}</strong>
      <small>${escapeHtml(topic.keywords)}</small>
      <small>${topic.active ? 'Aktiv' : 'Pausiert'}</small>
    </div>
  `).join('');
}

function renderArticles(articles) {
  articleList.innerHTML = articles.length ? articles.map((article) => {
    const tags = JSON.parse(article.matched_topics || '[]');
    return `
      <article class="article-card">
        <button class="secondary article-delete" type="button" data-article-id="${article.id}" aria-label="Artikel löschen">Löschen</button>
        <a href="${escapeHtml(article.url)}" target="_blank" rel="noreferrer">${escapeHtml(article.title)}</a>
        <div class="tags">${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>
        <p>${escapeHtml(article.excerpt.slice(0, 220))}</p>
        <small>${escapeHtml(article.source_name)}</small>
      </article>
    `;
  }).join('') : '<p>Noch keine passenden Meldungen gefunden.</p>';
}

async function load() {
  status.textContent = 'Wird geladen';
  const data = await api('/api/admin/state');
  renderBriefings(data.briefings);
  renderSources(data.sources);
  renderTopics(data.topics);
  renderArticles(data.articles);
  status.textContent = 'Bereit';
}

function setActionLoading(button, loadingText, active) {
  if (!button) return;
  if (active) {
    button.dataset.loading = 'true';
    button.dataset.originalLabel = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
    return;
  }
  button.disabled = false;
  button.dataset.loading = 'false';
  if (button.dataset.originalLabel) {
    button.textContent = button.dataset.originalLabel;
  }
}

function syncActionButtonsState() {
  [runBriefingButton, runCrawlButton, deleteTodayArticlesButton].forEach((button) => {
    if (!button) return;
    const isLoading = button.dataset.loading === 'true';
    button.disabled = actionsBusy || isLoading;
  });
  articleList.querySelectorAll('.article-delete').forEach((button) => {
    button.disabled = actionsBusy;
  });
}

function setActionsBusy(active) {
  actionsBusy = active;
  syncActionButtonsState();
}

document.querySelector('#sourceForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  await api('/api/sources', {
    method: 'POST',
    body: JSON.stringify(Object.fromEntries(form))
  });
  event.currentTarget.reset();
  await load();
});

sourceList.addEventListener('click', (event) => {
  const button = event.target.closest('.edit-source');
  if (!button) return;
  const source = currentSources.find((item) => String(item.id) === button.dataset.sourceId);
  if (!source) return;

  sourceIdInput.value = source.id;
  sourceNameInput.value = source.name;
  sourceUrlInput.value = source.url;
  sourceKeywordsInput.value = source.keywords || '';
  sourceDialog.showModal();
});

document.querySelector('#saveSource').addEventListener('click', async (event) => {
  event.preventDefault();
  await api(`/api/sources/${sourceIdInput.value}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: sourceNameInput.value,
      url: sourceUrlInput.value,
      keywords: sourceKeywordsInput.value
    })
  });
  sourceDialog.close();
  await load();
});

document.querySelector('#topicForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  await api('/api/topics', {
    method: 'POST',
    body: JSON.stringify(Object.fromEntries(form))
  });
  event.currentTarget.reset();
  await load();
});

runBriefingButton.addEventListener('click', async () => {
  if (actionsBusy) return;
  setActionsBusy(true);
  setActionLoading(runBriefingButton, 'Briefing wird erstellt', true);
  status.textContent = 'Briefing wird erstellt';
  try {
    await api('/api/briefings/run', { method: 'POST' });
    await load();
    status.textContent = 'Briefing erfolgreich erstellt';
  } catch (error) {
    status.textContent = `Fehler beim Briefing: ${error.message}`;
  } finally {
    setActionLoading(runBriefingButton, '', false);
    setActionsBusy(false);
  }
});

runCrawlButton.addEventListener('click', async () => {
  if (actionsBusy) return;
  setActionsBusy(true);
  setActionLoading(runCrawlButton, 'Crawling läuft', true);
  status.textContent = 'Crawling wird gestartet';
  try {
    const response = await api('/api/crawl/run', { method: 'POST' });
    const savedTotal = (response.results || []).reduce((sum, source) => sum + (source.saved || 0), 0);
    await load();
    status.textContent = `Crawling fertig (${savedTotal} neue/aktualisierte Meldungen)`;
  } catch (error) {
    status.textContent = `Fehler beim Crawling: ${error.message}`;
  } finally {
    setActionLoading(runCrawlButton, '', false);
    setActionsBusy(false);
  }
});

deleteTodayArticlesButton.addEventListener('click', async () => {
  if (actionsBusy) return;
  if (!window.confirm('Alle heutigen Artikel wirklich löschen?')) return;
  setActionsBusy(true);
  setActionLoading(deleteTodayArticlesButton, 'Lösche heutige Artikel', true);
  status.textContent = 'Heutige Artikel werden gelöscht';
  try {
    const response = await api('/api/articles/today', { method: 'DELETE' });
    await load();
    status.textContent = `${response.deleted || 0} heutige Artikel gelöscht`;
  } catch (error) {
    status.textContent = `Fehler beim Löschen: ${error.message}`;
  } finally {
    setActionLoading(deleteTodayArticlesButton, '', false);
    setActionsBusy(false);
  }
});

articleList.addEventListener('click', async (event) => {
  const button = event.target.closest('.article-delete');
  if (!button || actionsBusy) return;
  const articleId = button.dataset.articleId;
  if (!articleId) return;
  if (!window.confirm('Diesen Artikel wirklich löschen?')) return;
  setActionsBusy(true);
  status.textContent = 'Artikel wird gelöscht';
  try {
    await api(`/api/articles/${articleId}`, { method: 'DELETE' });
    await load();
    status.textContent = 'Artikel gelöscht';
  } catch (error) {
    status.textContent = `Fehler beim Löschen: ${error.message}`;
  } finally {
    setActionsBusy(false);
  }
});

document.querySelector('#saveToken').addEventListener('click', () => {
  state.token = document.querySelector('#tokenInput').value.trim();
  localStorage.setItem('railnews.adminToken', state.token);
});

load().catch((error) => {
  status.textContent = error.message;
});

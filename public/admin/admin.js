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

let currentSources = [];

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

document.querySelector('#runBriefing').addEventListener('click', async () => {
  status.textContent = 'Briefing wird erstellt';
  await api('/api/briefings/run', { method: 'POST' });
  await load();
});

document.querySelector('#saveToken').addEventListener('click', () => {
  state.token = document.querySelector('#tokenInput').value.trim();
  localStorage.setItem('railnews.adminToken', state.token);
});

load().catch((error) => {
  status.textContent = error.message;
});

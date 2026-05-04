const briefingList = document.querySelector('#briefingList');
const articleList = document.querySelector('#articleList');
const storyDialog = document.querySelector('#storyDialog');
const storyStatus = document.querySelector('#storyStatus');
const storyTitle = document.querySelector('#storyTitle');
const storyUrl = document.querySelector('#storyUrl');
const storyExcerpt = document.querySelector('#storyExcerpt');
const articleSearchForm = document.querySelector('#articleSearchForm');
const articleSearchInput = document.querySelector('#articleSearchInput');
const clearArticleSearchButton = document.querySelector('#clearArticleSearch');
const articleSearchStatus = document.querySelector('#articleSearchStatus');

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


function publicationNameFromUrl(url) {
  try {
    const { hostname } = new URL(url);
    const cleanHost = hostname.replace(/^www\./, '').toLowerCase();
    const map = {
      'railmarket.com': 'RailMarket',
      'railcolornews.com': 'Railcolor News',
      'lok-report.de': 'Lok-Report',
      'jarnvagar.nu': 'Järnvägar.nu'
    };
    return map[cleanHost] || cleanHost;
  } catch {
    return 'Quelle';
  }
}

function replaceLinksWithPills(text = '') {
  const renderPill = (url) => {
    const trimmedUrl = url.replace(/[.,;:!?]+$/, '');
    const safeUrl = escapeHtml(trimmedUrl);
    const label = escapeHtml(publicationNameFromUrl(trimmedUrl));
    return `<a class="source-pill" href="${safeUrl}" target="_blank" rel="noreferrer">${label}</a>`;
  };

  return text.replace(/\(\s*(https?:\/\/[^\s)]+)\s*\)|https?:\/\/[^\s<)]+/g, (match, wrappedUrl) => {
    return renderPill(wrappedUrl || match);
  });
}

function renderBriefingBody(text = '') {
  const escaped = escapeHtml(text);
  return escaped
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      if (block.startsWith('## ')) return `<h4>${block.slice(3)}</h4>`;
      if (block.startsWith('### ')) return `<h5>${block.slice(4)}</h5>`;
      return `<p>${replaceLinksWithPills(block).replace(/\n/g, '<br>')}</p>`;
    })
    .join('');
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

function formatDateTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function todayBriefingKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zurich',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function renderBriefings(briefings) {
  if (!briefings.length) {
    briefingList.innerHTML = '<p>Noch keine Briefings vorhanden.</p>';
    return;
  }

  const todayKey = todayBriefingKey();
  briefingList.innerHTML = briefings.map((briefing) => {
    const isToday = briefing.briefing_date === todayKey;
    return `
      <article class="briefing-card">
        <details class="briefing-details"${isToday ? ' open data-lock-open="true"' : ''}>
          <summary class="briefing-summary">
            <p class="meta">${escapeHtml(briefing.briefing_date)}</p>
            <h3>${escapeHtml(briefing.title)}</h3>
            <p class="meta">Erstellt: ${escapeHtml(formatDateTime(briefing.created_at))}</p>
            ${isToday ? '' : '<span class="briefing-toggle-label">Vergangenes Briefing öffnen</span>'}
          </summary>
          <div class="briefing-body">${renderBriefingBody(briefing.summary)}</div>
        </details>
      </article>
    `;
  }).join('');

  briefingList.querySelectorAll('.briefing-details[data-lock-open="true"]').forEach((item) => {
    item.addEventListener('toggle', () => {
      if (!item.open) item.open = true;
    });
  });
}

function formatDateGroup(value) {
  if (!value) return 'Ohne Datum';
  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(new Date(value));
}

function renderArticles(articles) {
  if (!articles.length) {
    articleList.innerHTML = '<p>Noch keine passenden Meldungen gefunden.</p>';
    return;
  }

  const grouped = new Map();
  for (const article of articles) {
    const date = article.published_at || article.created_at;
    const groupKey = date ? new Date(date).toISOString().slice(0, 10) : 'undated';
    if (!grouped.has(groupKey)) grouped.set(groupKey, { label: formatDateGroup(date), items: [] });
    grouped.get(groupKey).items.push(article);
  }

  articleList.innerHTML = [...grouped.values()].map((group) => `
    <section class="article-date-group">
      <h3 class="article-date-heading">${escapeHtml(group.label)}</h3>
      <div class="article-grid">
        ${group.items.map((article) => {
          const tags = JSON.parse(article.matched_topics || '[]');
          const date = article.published_at || article.created_at;
          return `
            <article class="article-card">
              <a href="${escapeHtml(article.url)}" target="_blank" rel="noreferrer">${escapeHtml(article.title)}</a>
              <div class="tags">${tags.map((tag) => `<span class=\"tag\">${escapeHtml(tag)}</span>`).join('')}</div>
              <p>${escapeHtml(article.excerpt.slice(0, 240))}</p>
              <small>${escapeHtml(article.source_name)}${date ? ` · ${escapeHtml(formatDate(date))}` : ''}</small>
            </article>
          `;
        }).join('')}
      </div>
    </section>
  `).join('');
}

async function load() {
  const data = await api(`/api/public?t=${Date.now()}`);
  renderBriefings(data.briefings);
  renderArticles(data.articles);
  articleSearchStatus.textContent = '';
}

async function runArticleSearch() {
  const query = articleSearchInput.value.trim();
  if (!query) {
    articleSearchStatus.textContent = 'Bitte einen Suchbegriff eingeben.';
    return;
  }

  articleSearchStatus.textContent = `Suche nach „${query}“…`;
  const data = await api(`/api/articles/search?q=${encodeURIComponent(query)}&t=${Date.now()}`);
  renderArticles(data.articles);
  articleSearchStatus.textContent = `${data.articles.length} Treffer für „${query}“`;
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

articleSearchForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await runArticleSearch();
  } catch (error) {
    articleSearchStatus.textContent = error.message;
  }
});

clearArticleSearchButton.addEventListener('click', async () => {
  articleSearchInput.value = '';
  articleSearchStatus.textContent = '';
  try {
    const data = await api(`/api/public?t=${Date.now()}`);
    renderArticles(data.articles);
  } catch (error) {
    articleSearchStatus.textContent = error.message;
  }
});

load().catch((error) => {
  briefingList.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
});

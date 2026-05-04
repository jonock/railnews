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
const commentDialog = document.querySelector('#commentDialog');
const commentContext = document.querySelector('#commentContext');
const commentText = document.querySelector('#commentText');
const commentStatus = document.querySelector('#commentStatus');
const faceImagePicker = document.querySelector('#faceImagePicker');
const faceSelectionLabel = document.querySelector('#faceSelectionLabel');
const commentFaceValue = document.querySelector('#commentFaceValue');
const readCommentDialog = document.querySelector('#readCommentDialog');
const readCommentMeta = document.querySelector('#readCommentMeta');
const readCommentBody = document.querySelector('#readCommentBody');
let selectedCommentTarget = null;
let commentsByBriefing = {};

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

function chapterSlug(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'chapter';
}

function hashString(value = '') {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function buildBriefingChapters(text = '') {
  return String(text || '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, index) => {
      const escapedBlock = escapeHtml(block);
      if (block.startsWith('## ')) {
        const title = block.slice(3).trim();
        const key = `${chapterSlug(title)}-${hashString(`h2:${title}`)}`;
        return { key, title, html: `<h4>${escapeHtml(title)}</h4>` };
      }
      if (block.startsWith('### ')) {
        const title = block.slice(4).trim();
        const key = `${chapterSlug(title)}-${hashString(`h3:${title}`)}`;
        return { key, title, html: `<h5>${escapeHtml(title)}</h5>` };
      }
      const title = `Abschnitt ${index + 1}`;
      const key = `body-${hashString(`p:${block}`)}`;
      return {
        key,
        title,
        html: `<p>${replaceLinksWithPills(escapedBlock).replace(/\n/g, '<br>')}</p>`
      };
    })
}

function commentFaceImage(commenterFace) {
  return commenterFace === 'left' ? '/images/buenzli.png' : '/images/schlufi.png';
}

function commentFaceLabel(commenterFace) {
  return commenterFace === 'left' ? 'Bünzli' : 'Schlufi';
}

function renderChapterCommentFaces(briefingId, chapterKey) {
  const comments = commentsByBriefing[briefingId] || [];
  const filtered = comments.filter((comment) => comment.chapter_key === chapterKey);
  if (!filtered.length) return '';
  return `
    <aside class="chapter-comment-faces" aria-label="Kommentare zu diesem Abschnitt">
      ${filtered.map((comment) => {
        const payload = JSON.stringify({
          text: comment.comment_text,
          date: formatDateTime(comment.created_at),
          commenter: commentFaceLabel(comment.commenter_face)
        });
        return `
        <button type="button" class="chapter-comment-face"
          aria-label="Kommentar von ${escapeHtml(commentFaceLabel(comment.commenter_face))} anzeigen"
          data-comment-payload="${escapeHtml(payload)}">
          <img src="${commentFaceImage(comment.commenter_face)}" alt="" width="56" height="56" loading="lazy">
        </button>`;
      }).join('')}
    </aside>
  `;
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
    const chapters = buildBriefingChapters(briefing.summary);
    let activeHeadingTitle = '';
    const chapterMarkup = chapters.map((chapter) => {
      const isHeading = chapter.html.startsWith('<h4>') || chapter.html.startsWith('<h5>');
      if (isHeading) {
        activeHeadingTitle = chapter.title;
        return `<div class="chapter-main">${chapter.html}</div>`;
      }

      const chapterTitle = activeHeadingTitle || chapter.title;
      const commentFacesHtml = renderChapterCommentFaces(briefing.id, chapter.key);
      return `
        <section class="briefing-chapter${commentFacesHtml ? ' briefing-chapter-has-faces' : ''}"
          data-briefing-id="${briefing.id}"
          data-briefing-title="${escapeHtml(briefing.title)}"
          data-chapter-key="${chapter.key}"
          data-chapter-title="${escapeHtml(chapterTitle)}">
          <div class="chapter-content-row">
            <div class="chapter-main" role="button" tabindex="0" aria-label="Diesen Abschnitt kommentieren">${chapter.html}</div>
            ${commentFacesHtml}
          </div>
        </section>
      `;
    }).join('');

    return `
      <article class="briefing-card">
        <details class="briefing-details"${isToday ? ' open data-lock-open="true"' : ''}>
          <summary class="briefing-summary">
            <p class="meta">${escapeHtml(briefing.briefing_date)}</p>
            <h3>${escapeHtml(briefing.title)}</h3>
            <p class="meta">Erstellt: ${escapeHtml(formatDateTime(briefing.created_at))}</p>
            ${isToday ? '' : '<span class="briefing-toggle-label">Vergangenes Briefing öffnen</span>'}
          </summary>
          <div class="briefing-body">${chapterMarkup}</div>
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
  commentsByBriefing = data.commentsByBriefing || {};
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

function openCommentDialog(chapterElement) {
  selectedCommentTarget = {
    briefingId: Number(chapterElement.dataset.briefingId),
    briefingTitle: chapterElement.dataset.briefingTitle || '',
    chapterKey: chapterElement.dataset.chapterKey || '',
    chapterTitle: chapterElement.dataset.chapterTitle || ''
  };
  commentContext.textContent = `${selectedCommentTarget.briefingTitle} · ${selectedCommentTarget.chapterTitle}`;
  commentText.value = '';
  commentStatus.textContent = '';
  commentFaceValue.value = 'left';
  faceSelectionLabel.textContent = 'Ausgewählt: Bünzli';
  faceImagePicker.querySelectorAll('.face-hotspot').forEach((button) => {
    button.dataset.selected = button.dataset.face === 'left' ? 'true' : 'false';
  });
  commentDialog.showModal();
}

briefingList.addEventListener('click', (event) => {
  const faceButton = event.target.closest('.chapter-comment-face');
  if (faceButton) {
    event.preventDefault();
    event.stopPropagation();
    let payload;
    try {
      payload = JSON.parse(faceButton.dataset.commentPayload || '{}');
    } catch {
      return;
    }
    readCommentMeta.textContent = `${payload.commenter} · ${payload.date || ''}`.trim();
    readCommentBody.textContent = payload.text || '';
    readCommentDialog.showModal();
    return;
  }
  const chapterElement = event.target.closest('.briefing-chapter');
  if (!chapterElement) return;
  if (!event.target.closest('.chapter-main')) return;
  if (event.target.closest('a')) return;
  openCommentDialog(chapterElement);
});

document.querySelector('#closeReadComment').addEventListener('click', () => {
  readCommentDialog.close();
});

briefingList.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const main = event.target.closest('.briefing-chapter .chapter-main');
  if (!main) return;
  const chapterElement = main.closest('.briefing-chapter');
  if (!chapterElement) return;
  event.preventDefault();
  openCommentDialog(chapterElement);
});

document.querySelector('#cancelComment').addEventListener('click', () => {
  commentDialog.close();
});

document.querySelector('.comment-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!selectedCommentTarget) return;
  const selectedFace = commentFaceValue.value || 'left';
  commentStatus.textContent = 'Kommentar wird gespeichert...';
  try {
    await api(`/api/briefings/${selectedCommentTarget.briefingId}/comments`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chapterKey: selectedCommentTarget.chapterKey,
        chapterTitle: selectedCommentTarget.chapterTitle,
        commentText: commentText.value,
        commenterFace: selectedFace
      })
    });
    commentDialog.close();
    await load();
  } catch (error) {
    commentStatus.textContent = error.message;
  }
});

faceImagePicker.addEventListener('click', (event) => {
  const hotspot = event.target.closest('.face-hotspot');
  if (!hotspot) return;
  const face = hotspot.dataset.face === 'right' ? 'right' : 'left';
  commentFaceValue.value = face;
  faceSelectionLabel.textContent = face === 'left' ? 'Ausgewählt: Bünzli' : 'Ausgewählt: Schlufi';
  faceImagePicker.querySelectorAll('.face-hotspot').forEach((button) => {
    button.dataset.selected = button.dataset.face === face ? 'true' : 'false';
  });
});

load().catch((error) => {
  briefingList.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
});

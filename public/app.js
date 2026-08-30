import { briefingTitle, calendarDaysUntil, formatDateTime, formatLongDate, localDateKey } from './dateTime.js';

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
const themeColor = document.querySelector('#themeColor');
const belgienCountdown = document.querySelector('#belgienCountdown');
const belgienCountdownDays = document.querySelector('#belgienCountdownDays');
const belgienCountdownLabel = document.querySelector('#belgienCountdownLabel');
const belgienCountdownDate = document.querySelector('#belgienCountdownDate');
const belgienCountdownFact = document.querySelector('#belgienCountdownFact');
const belgienCountdownFactText = document.querySelector('#belgienCountdownFactText');
const floatingBadge = document.querySelector('#floatingBadge');
const floatingBadgeLogo = document.querySelector('#floatingBadgeLogo');
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
const existingCommentsSection = document.querySelector('#existingCommentsSection');
const existingCommentsBody = document.querySelector('#existingCommentsBody');
let selectedCommentTarget = null;
let commentsByBriefing = {};

const COMMENTER_FACE_STORAGE_KEY = 'railnews:commenter-face';
const BELGIENREISLI_DATE = '2026-09-10';
const BELGIENREISLI_END_DATE = '2026-09-13';
const BELGIENREISLI_TIME_ZONE = 'Europe/Zurich';
const BELGIENREISLI_THEME_COLOR = '#f4bb19';
const DEFAULT_THEME_COLOR = '#0d5f4b';
const belgienSpecialOverrideValue = new URLSearchParams(window.location.search).get('belgien-special');
const belgienSpecialOverride = belgienSpecialOverrideValue === '1'
  ? true
  : belgienSpecialOverrideValue === '0' ? false : null;
const BELGIENREISLI_FACTS = [
  'Am 5. Mai 1835 fuhr zwischen Brüssel und Mechelen die erste Eisenbahn auf dem europäischen Festland.',
  'Brüssel war die erste Hauptstadt der Welt, die mit der Eisenbahn erreichbar war.',
  'König Leopold I. sah bei der Eröffnungsfahrt 1835 zu, fuhr aber nicht mit: Eine Mitfahrt galt offenbar noch als zu riskant.',
  'Die drei Eröffnungszüge von 1835 wurden von den englischen Dampflokomotiven La Flèche, Stephenson und L’Elephant gezogen.',
  'Le Belge, die erste in Belgien gebaute Lokomotive, verliess am 30. Dezember 1835 das Cockerill-Werk in Seraing.',
  'Schon 1843 umfasste das staatliche belgische Eisenbahnnetz 556 Kilometer; sein zentraler Knoten war Mechelen.',
  '1846 wurden Brüssel und Paris als erste zwei Hauptstädte der Welt direkt per Eisenbahn miteinander verbunden.',
  'In nur 40 Jahren entstanden in Belgien fast 3.400 Kilometer Bahnstrecken – eines der dichtesten Netze der Welt.',
  '1870 betrieben 39 private Gesellschaften in Belgien 2.231 Kilometer Bahn, der Staat dagegen erst 863 Kilometer.',
  'Vor dem Ersten Weltkrieg gehörten bereits 4.786 Kilometer Bahn dem Staat; nur noch 275 Kilometer waren privat.',
  'Mit fast 80.000 Beschäftigten war die belgische Staatsbahn vor dem Ersten Weltkrieg der grösste Arbeitgeber des Landes.',
  '1892 führte Belgien als erstes Land auf dem europäischen Festland die Greenwich Mean Time als landesweite Standardzeit ein.',
  'Die belgische Industrie baute zwischen 1835 und 1939 mehr als 16.000 Dampflokomotiven; über 10.000 davon gingen in den Export.',
  'Bis 1918 war ein Viertel des belgischen Bahnnetzes zerstört oder unbrauchbar, jeder dritte Bahnhof war nicht zugänglich.',
  'Die SNCB-NMBS wurde 1926 gegründet und feiert 2026 ihr hundertjähriges Bestehen.',
  '1931 führte die SNCB-NMBS ihre ersten Metallwagen ein; die Innenräume gestaltete Henry van de Velde.',
  '1933 machte die durchgehende automatische Druckluftbremse rund 3.000 Bremser im belgischen Güterverkehr überflüssig.',
  '1935 nahm zwischen Brüssel und Antwerpen die erste elektrifizierte Strecke der SNCB-NMBS den Betrieb auf.',
  'Das berühmte ovale B-Logo entwarf Jean De Roy. Ab 1938 wurde es allgemein verwendet.',
  'Die stromlinienförmige Dampflok Typ 12 erreichte 165 km/h und fuhr 1940 in nur 57 Minuten von Brüssel nach Ostende.',
  '1948 war das 5.034 Kilometer lange belgische Bahnnetz das dichteste der Welt.',
  '1956 führte die SNCB-NMBS den ersten Autoreisezug auf dem europäischen Festland ein.',
  '1966 fuhr zwischen Ath und Denderleeuw der letzte kommerzielle Dampfzug der SNCB-NMBS.',
  'Mit Brüssel-Schuman eröffnete 1969 Belgiens erster gemeinsamer Bahnhof für Eisenbahn und Metro.',
  'Seit 1970 können elektrische Züge den Flughafen Brüssel-Zaventem erreichen.',
  'Schon 1975 führte die SNCB-NMBS ein Kombiangebot für Bahn und Fahrrad ein.',
  'Seit dem IC-IR-Plan von 1984 fahren belgische Züge nach festen Fahrplänen.',
  '1994 verband der Eurostar Brüssel durch den Kanaltunnel mit London.',
  '1996 nahm Thalys den Hochgeschwindigkeitsverkehr von und nach Brüssel auf.',
  '2009 war Belgien das erste europäische Land mit einem vollständig fertiggestellten Hochgeschwindigkeitsnetz.',
  'Seit 2012 bindet die Diabolo-Bahnstrecke den unterirdischen Flughafenbahnhof direkt an die wichtigsten Achsen des Netzes an.',
  '2015 startete das S-Bahn-Angebot in und um Brüssel.',
  'Belgien eröffnete seine erste Bahnstrecke 1835 – zwölf Jahre vor der Schweizer Spanischbrötlibahn von 1847.',
  'Die SBB nahm 1902 den Betrieb auf, die SNCB-NMBS erst 1926: Die belgische Staatsbahn ist 24 Jahre jünger als die schweizerische.',
  'Infrabel betreibt 3.602 Kilometer Bahnstrecken; das gesamte Schweizer Netz umfasst 5.317 Kilometer und zählt dabei mehrere Betreiber und Spurweiten.',
  'Das Infrabel-Netz ist vollständig normalspurig. Zur Schweizer Bahnwelt gehören dagegen auch zahlreiche Schmalspur- und Zahnradbahnen.',
  'Als Belgien 1935 seine erste elektrische Strecke eröffnete, stand in der Schweiz bereits seit Jahren mehr als die Hälfte des SBB-Netzes unter Strom.',
  'Belgien fährt überwiegend mit 3.000 Volt Gleichstrom und auf einigen Strecken mit 25.000 Volt Wechselstrom; die SBB nutzt 15.000 Volt bei 16,7 Hertz.',
  'Das SBB-Netz ist vollständig elektrifiziert und bezieht 90 Prozent seines Bahnstroms aus Wasserkraft; in Belgien gibt es noch nicht elektrifizierte Strecken.',
  '2021 legte die Schweizer Bevölkerung pro Kopf 2.464 Bahnkilometer zurück, die belgische 928 – in der Schweiz also gut zweieinhalbmal so viele.',
  'Pünktlich heisst nicht überall dasselbe: In Belgien gelten weniger als sechs Minuten Verspätung als pünktlich, bei der SBB weniger als drei.',
  'Die Schweiz führte ihren landesweiten Taktfahrplan 1982 ein, Belgien folgte 1984 mit dem IC-IR-Plan.',
  'Belgien baute Strecken für 300 km/h; die Schweiz setzt mit Bahn 2000 auf Knotenfahrzeiten und schlanke Anschlüsse – mehr als 200 km/h braucht sie dafür nicht.',
  'Der 6,53 Kilometer lange Soumagne-Tunnel ist Belgiens längster Bahntunnel; der 57 Kilometer lange Gotthard-Basistunnel ist fast neunmal so lang.',
  'In Belgien sind Zugbetrieb und Infrastruktur auf SNCB-NMBS und Infrabel verteilt; bei der SBB gehören Personenverkehr und Infrastruktur zum selben Konzern.',
  'Zwei mehrsprachige Länder, zwei Buchstabensalate: SNCB-NMBS trägt französische und niederländische Initialen, SBB-CFF-FFS deutsche, französische und italienische.',
  'Die Zürcher S-Bahn startete 1990, die Brüsseler S-Züge 2015 – ein Vierteljahrhundert später.'
];
let belgienFactIndex = -1;
const DAILY_LOGO_ROTATION = [
  { name: 'Traficom', src: '/images/Traficom_logo.svg', alt: 'Traficom Logo' },
  { name: 'Trafikverket', src: '/images/Trafikverket_logo.svg', alt: 'Trafikverket Logo' },
  { name: 'Krösatågen', src: '/images/Krosatagen_logo.png', alt: 'Krösatågen Logo' },
  { name: 'VR Sverige AB', src: '/images/VR_Sverige_logo.svg', alt: 'VR Sverige AB Logo' },
  { name: 'GoAhead Nordic', src: '/images/GoAhead_Nordic_logo.png', alt: 'Go-Ahead Logo' },
  { name: 'Vy Gruppen', src: '/images/Vy_Gruppen_logo.svg', alt: 'Vy Gruppen Logo' },
  { name: 'Jönköpings Länstrafiken', src: '/images/Jonkopings_Lanstrafik_logo.svg', alt: 'Jönköpings Länstrafiken Logo' },
  { name: 'SL', src: '/images/SL_logo.png', alt: 'Storstockholms Lokaltrafik Logo' },
  { name: 'Nordea', src: '/images/Nordea_logo.svg', alt: 'Nordea Logo' },
  { name: 'ICA Gruppen', src: '/images/ICA_Gruppen_logo.svg', alt: 'ICA Gruppen Logo' },
  { name: 'Svenska Spel', src: '/images/Svenska_Spel_logo.png', alt: 'Svenska Spel Logo' },
  { name: 'BILTEMA', src: '/images/BILTEMA_logo.png', alt: 'Biltema Logo' },
  { name: 'Lieblingsplatz', src: '/images/lieblingsplatz.avif', alt: 'Lieblingsplatz Logo' },
  { name: 'Gekås', src: '/images/Gekas_Logo.svg', alt: 'Gekås Logo' },
  { name: 'Scandic', src: '/images/Scandic.svg', alt: 'Scandic Logo' }
];

function readStoredCommenterFace() {
  try {
    const stored = localStorage.getItem(COMMENTER_FACE_STORAGE_KEY);
    return stored === 'right' ? 'right' : 'left';
  } catch {
    return 'left';
  }
}

function persistCommenterFace(face) {
  try {
    localStorage.setItem(COMMENTER_FACE_STORAGE_KEY, face === 'right' ? 'right' : 'left');
  } catch {
    // ignore storage errors (private mode, quota, etc.)
  }
}

function todayRotationKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zurich',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function updateBelgienCountdown() {
  if (!belgienCountdown || !belgienCountdownDays || !belgienCountdownLabel
    || !belgienCountdownDate || !belgienCountdownFact || !belgienCountdownFactText) return;

  const daysUntilStart = calendarDaysUntil(BELGIENREISLI_DATE, BELGIENREISLI_TIME_ZONE);
  const daysUntilEnd = calendarDaysUntil(BELGIENREISLI_END_DATE, BELGIENREISLI_TIME_ZONE);
  const tripIsActive = daysUntilStart !== null && daysUntilEnd !== null
    && daysUntilStart <= 0 && daysUntilEnd >= 0;
  const factModeIsActive = tripIsActive || belgienSpecialOverride === true;
  const specialThemeIsActive = belgienSpecialOverride === true
    || (belgienSpecialOverride !== false && tripIsActive);

  document.body.classList.toggle('belgien-special', specialThemeIsActive);
  themeColor?.setAttribute('content', specialThemeIsActive ? BELGIENREISLI_THEME_COLOR : DEFAULT_THEME_COLOR);

  belgienCountdown.hidden = belgienSpecialOverride !== true
    && (daysUntilStart === null || daysUntilEnd === null || daysUntilEnd < 0);
  if (belgienCountdown.hidden) return;

  belgienCountdown.disabled = !factModeIsActive;
  belgienCountdown.dataset.mode = factModeIsActive ? 'trip' : 'countdown';
  belgienCountdownLabel.hidden = factModeIsActive;
  belgienCountdownDate.hidden = factModeIsActive;
  belgienCountdownFact.hidden = !factModeIsActive;

  if (factModeIsActive) {
    belgienCountdown.setAttribute('aria-label', 'Belgischer Bahnfakt. Klicken für den nächsten Fakt.');
    if (belgienFactIndex < 0) showNextBelgienFact();
  } else {
    belgienCountdown.setAttribute('aria-label', `${daysUntilStart} Tage bis zum Belgienreisli`);
    belgienCountdownDays.textContent = daysUntilStart;
  }
}

function showNextBelgienFact() {
  if (!belgienCountdownFactText || !BELGIENREISLI_FACTS.length) return;
  belgienFactIndex = belgienFactIndex < 0
    ? Math.floor(Math.random() * BELGIENREISLI_FACTS.length)
    : (belgienFactIndex + 1) % BELGIENREISLI_FACTS.length;
  belgienCountdownFactText.textContent = BELGIENREISLI_FACTS[belgienFactIndex];
  belgienCountdownFactText.classList.remove('is-changing');
  void belgienCountdownFactText.offsetWidth;
  belgienCountdownFactText.classList.add('is-changing');
}

function pickDailyLogo() {
  const key = todayRotationKey();
  const numericKey = Number(key.replaceAll('-', ''));
  const index = Number.isFinite(numericKey) ? numericKey % DAILY_LOGO_ROTATION.length : 0;
  return DAILY_LOGO_ROTATION[index];
}

function renderDailyLogo() {
  if (!floatingBadge || !floatingBadgeLogo || !DAILY_LOGO_ROTATION.length) return;
  const logo = pickDailyLogo();
  floatingBadge.setAttribute('aria-label', `Präsentiert von ${logo.name}`);
  floatingBadgeLogo.src = logo.src;
  floatingBadgeLogo.alt = logo.alt;
}

function applyCommenterFaceSelection(face) {
  const normalized = face === 'right' ? 'right' : 'left';
  commentFaceValue.value = normalized;
  faceSelectionLabel.textContent = normalized === 'left' ? 'Ausgewählt: Bünzli' : 'Ausgewählt: Schlufi';
  faceImagePicker.querySelectorAll('.face-hotspot').forEach((button) => {
    button.dataset.selected = button.dataset.face === normalized ? 'true' : 'false';
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Service worker registration failed', error);
    });
  });
}

renderDailyLogo();
updateBelgienCountdown();
window.setInterval(updateBelgienCountdown, 60_000);

belgienCountdown?.addEventListener('click', () => {
  if (belgienCountdown.dataset.mode === 'trip') showNextBelgienFact();
});

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function normalizeDisplayText(value = '', maxLength) {
  const decoder = document.createElement('textarea');
  decoder.innerHTML = String(value);
  const decoded = decoder.value;
  const template = document.createElement('template');
  template.innerHTML = decoded;
  const cleaned = (template.content.textContent || decoded).replace(/\s+/g, ' ').trim();
  return typeof maxLength === 'number' ? cleaned.slice(0, maxLength) : cleaned;
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

function commentId(comment) {
  return hashString(`${comment.created_at || ''}|${comment.commenter_face || ''}|${comment.comment_text || ''}`);
}

function renderChapterCommentFaces(briefingId, chapterKey) {
  const comments = commentsByBriefing[briefingId] || [];
  const filtered = comments.filter((comment) => comment.chapter_key === chapterKey);
  if (!filtered.length) return '';
  return `
    <aside class="chapter-comment-faces" aria-label="Kommentare zu diesem Abschnitt">
      ${filtered.map((comment) => {
        return `
        <button type="button" class="chapter-comment-face"
          aria-label="Kommentar von ${escapeHtml(commentFaceLabel(comment.commenter_face))} anzeigen"
          data-comment-id="${commentId(comment)}">
          <img src="${commentFaceImage(comment.commenter_face)}" alt="" width="56" height="56" loading="lazy">
        </button>`;
      }).join('')}
    </aside>
  `;
}

function renderReadCommentsList(comments, activeCommentId) {
  return comments.map((comment) => {
    const commenter = commentFaceLabel(comment.commenter_face);
    const isActive = commentId(comment) === activeCommentId;
    return `
      <article class="read-comment-item${isActive ? ' active' : ''}">
        <img src="${commentFaceImage(comment.commenter_face)}" alt="${escapeHtml(commenter)}" width="40" height="40" loading="lazy">
        <div class="read-comment-content">
          <p class="read-comment-item-meta">${escapeHtml(commenter)} · ${escapeHtml(formatDateTime(comment.created_at))}</p>
          <p class="read-comment-item-text">${escapeHtml(comment.comment_text)}</p>
        </div>
      </article>
    `;
  }).join('');
}

function openReadCommentDialog(chapterElement, activeCommentId) {
  const briefingId = Number(chapterElement.dataset.briefingId);
  const chapterKey = chapterElement.dataset.chapterKey || '';
  const chapterTitle = chapterElement.dataset.chapterTitle || '';
  const comments = (commentsByBriefing[briefingId] || []).filter((comment) => comment.chapter_key === chapterKey);
  if (!comments.length) return;

  readCommentMeta.textContent = `Abschnitt: ${chapterTitle}`;
  readCommentBody.innerHTML = renderReadCommentsList(comments, activeCommentId);
  readCommentDialog.showModal();
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    cache: 'no-store',
    ...options
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

function renderBriefings(briefings) {
  if (!briefings.length) {
    briefingList.innerHTML = '<p>Noch keine Briefings vorhanden.</p>';
    return;
  }

  const latestBriefingId = briefings[0]?.id;
  briefingList.innerHTML = briefings.map((briefing) => {
    const isLatest = briefing.id === latestBriefingId;
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

    const briefingTypeClass = briefing.briefing_type === 'evening' ? ' briefing-card-evening' : '';
    return `
      <article class="briefing-card${briefingTypeClass}">
        <details class="briefing-details"${isLatest ? ' open data-lock-open="true"' : ''}>
          <summary class="briefing-summary">
            <p class="meta">${escapeHtml(formatDateTime(briefing.created_at))}</p>
            <h3>${escapeHtml(briefingTitle(briefing.title))}</h3>
            ${isLatest ? '' : '<span class="briefing-toggle-label">Briefing öffnen</span>'}
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
  return formatLongDate(value);
}

function renderArticles(articles) {
  if (!articles.length) {
    articleList.innerHTML = '<p>Noch keine passenden Meldungen gefunden.</p>';
    return;
  }

  const grouped = new Map();
  for (const article of articles) {
    const date = article.published_at || article.created_at;
    const groupKey = localDateKey(date);
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
          const title = normalizeDisplayText(article.title);
          const excerpt = normalizeDisplayText(article.excerpt, 240);
          return `
            <article class="article-card">
              <a href="${escapeHtml(article.url)}" target="_blank" rel="noreferrer">${escapeHtml(title)}</a>
              <div class="tags">${tags.map((tag) => `<span class=\"tag\">${escapeHtml(tag)}</span>`).join('')}</div>
              <p>${escapeHtml(excerpt)}</p>
              <small>${escapeHtml(article.source_name)}${date ? ` · ${escapeHtml(formatDateTime(date))}` : ''}</small>
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
  storyStatus.textContent = 'Meldung wird gespeichert...';

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
    document.querySelector('.articles').scrollIntoView({ behavior: 'smooth' });
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

function renderExistingCommentsForChapter(briefingId, chapterKey) {
  const comments = (commentsByBriefing[briefingId] || []).filter((comment) => comment.chapter_key === chapterKey);
  if (!comments.length) {
    existingCommentsSection.hidden = true;
    existingCommentsBody.innerHTML = '';
    return;
  }
  existingCommentsSection.hidden = false;
  existingCommentsBody.innerHTML = renderReadCommentsList(comments, '');
}

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
  applyCommenterFaceSelection(readStoredCommenterFace());
  renderExistingCommentsForChapter(selectedCommentTarget.briefingId, selectedCommentTarget.chapterKey);
  commentDialog.showModal();
}

briefingList.addEventListener('click', (event) => {
  const faceButton = event.target.closest('.chapter-comment-face');
  if (faceButton) {
    event.preventDefault();
    event.stopPropagation();
    const chapterElement = faceButton.closest('.briefing-chapter');
    if (!chapterElement) return;
    openReadCommentDialog(chapterElement, faceButton.dataset.commentId || '');
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
  applyCommenterFaceSelection(face);
  persistCommenterFace(face);
});

load().catch((error) => {
  briefingList.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
});

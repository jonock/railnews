import { formatDateTime } from '../dateTime.js';

const fordonMain = document.querySelector('#fordonMain');
const categoryTabs = [...document.querySelectorAll('.fordon-tab')];
const operatorChipsHost = document.querySelector('#operatorChips');
const listCount = document.querySelector('#listCount');
const vehicleList = document.querySelector('#vehicleList');
const detailPlaceholder = document.querySelector('#detailPlaceholder');
const vehicleDetail = document.querySelector('#vehicleDetail');
const detailCategory = document.querySelector('#detailCategory');
const detailTitleDe = document.querySelector('#detailTitleDe');
const detailTitleSv = document.querySelector('#detailTitleSv');
const detailDesignation = document.querySelector('#detailDesignation');
const detailStatus = document.querySelector('#detailStatus');
const detailSpecs = document.querySelector('#detailSpecs');
const detailSummaryDe = document.querySelector('#detailSummaryDe');
const detailSummarySv = document.querySelector('#detailSummarySv');
const relatedArticlesSection = document.querySelector('#relatedArticlesSection');
const articlesStatus = document.querySelector('#articlesStatus');
const relatedArticles = document.querySelector('#relatedArticles');

const STATUS_LABELS = {
  active: { de: 'Im Einsatz', sv: 'I trafik' },
  refurbishment: { de: 'Modernisierung', sv: 'Renovering' },
  on_order: { de: 'Bestellt', sv: 'Beställd' },
  legacy: { de: 'Auslauf / Legacy', sv: 'Utfasning' },
  testing: { de: 'Erprobung', sv: 'Provkörning' }
};

const OPERATOR_ALIASES = {
  'Norrtåg / Transitio': ['Norrtåg', 'Transitio'],
  Regional: ['Regional', 'Västtrafik', 'Skånetrafiken']
};

let catalog = null;
let activeCategory = 'triebzuege';
let activeOperator = null;
let selectedSlug = null;
let detailRequestId = 0;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function designationFromName(name) {
  const match = name.match(/\b([A-ZÅÄÖ][A-Za-zÅÄÖåäö0-9./\-–]+(?:\s*[/+]\s*[A-Za-z0-9.\-–]+)?)\b/);
  if (!match) return name.split(' ')[0].slice(0, 12);
  return match[1].replace(/\s*\(.*/, '');
}

function operatorMatches(vehicleOperator, filterOperator) {
  if (!filterOperator) return true;
  if (vehicleOperator === filterOperator) return true;
  const aliases = OPERATOR_ALIASES[filterOperator];
  if (!aliases) return vehicleOperator === filterOperator;
  return aliases.some((alias) => vehicleOperator.includes(alias));
}

function filteredVehicles() {
  return catalog.vehicles.filter((vehicle) => {
    if (vehicle.category !== activeCategory) return false;
    return operatorMatches(vehicle.operator, activeOperator);
  });
}

function renderOperatorChips() {
  operatorChipsHost.innerHTML = `
    <button type="button" class="fordon-chip${activeOperator ? '' : ' is-active'}" data-operator="">Alle</button>
    ${catalog.operators.map((operator) => `
      <button type="button" class="fordon-chip${activeOperator === operator ? ' is-active' : ''}" data-operator="${escapeHtml(operator)}">${escapeHtml(operator)}</button>
    `).join('')}
  `;

  operatorChipsHost.querySelectorAll('.fordon-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      activeOperator = chip.dataset.operator || null;
      renderOperatorChips();
      renderVehicleList();
    });
  });
}

function renderVehicleList() {
  const items = filteredVehicles();
  listCount.textContent = `${items.length} Einträge`;

  if (!items.length) {
    vehicleList.innerHTML = '<p class="fordon-list-count">Keine Fahrzeuge für diesen Filter.</p>';
    return;
  }

  vehicleList.innerHTML = items.map((vehicle) => {
    const designation = designationFromName(vehicle.name_de);
    return `
      <button
        type="button"
        class="fordon-list-item${vehicle.slug === selectedSlug ? ' is-selected' : ''}"
        data-slug="${escapeHtml(vehicle.slug)}"
      >
        <span class="fordon-list-item-top">
          <span class="fordon-list-designation">${escapeHtml(designation)}</span>
          <span class="fordon-list-operator">${escapeHtml(vehicle.operator)}</span>
          <span class="fordon-status-dot" data-status="${escapeHtml(vehicle.status)}" title="${escapeHtml(STATUS_LABELS[vehicle.status]?.de || vehicle.status)}"></span>
        </span>
        <span class="fordon-list-name">${escapeHtml(vehicle.name_de)}</span>
      </button>
    `;
  }).join('');

  vehicleList.querySelectorAll('.fordon-list-item').forEach((button) => {
    button.addEventListener('click', () => selectVehicle(button.dataset.slug, true));
  });

  if (!items.some((item) => item.slug === selectedSlug)) {
    selectVehicle(items[0].slug, false);
  }
}

function renderSpecs(vehicle) {
  const specs = [
    ['Betreiber', vehicle.operator],
    ['Hersteller', vehicle.manufacturer],
    ['Bestand', vehicle.count],
    ['Höchstgeschwindigkeit', vehicle.max_speed_kmh ? `${vehicle.max_speed_kmh} km/h` : '—'],
    ['Formation', vehicle.formation],
    ['Strecken', vehicle.routes],
    ['Status', STATUS_LABELS[vehicle.status]?.de || vehicle.status]
  ];

  detailSpecs.innerHTML = specs.map(([label, value]) => `
    <div>
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value)}</dd>
    </div>
  `).join('');
}

function renderRelatedArticles(articles) {
  if (!articles.length) {
    relatedArticlesSection.hidden = true;
    return;
  }

  relatedArticlesSection.hidden = false;
  relatedArticles.innerHTML = articles.map((article) => {
    const tags = JSON.parse(article.matched_topics || '[]');
    const date = article.published_at || article.created_at;
    return `
      <article class="article-card">
        <a href="${escapeHtml(article.url)}" target="_blank" rel="noreferrer">${escapeHtml(article.title)}</a>
        <div class="tags">${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>
        <p>${escapeHtml((article.excerpt || '').slice(0, 240))}</p>
        <small>${escapeHtml(article.source_name)}${date ? ` · ${escapeHtml(formatDateTime(date))}` : ''}</small>
      </article>
    `;
  }).join('');
}

async function selectVehicle(slug, updateHash) {
  selectedSlug = slug;
  renderVehicleList();

  if (updateHash) {
    history.replaceState(null, '', `#${slug}`);
  }

  const requestId = ++detailRequestId;
  detailPlaceholder.hidden = true;
  vehicleDetail.hidden = false;
  relatedArticlesSection.hidden = true;
  articlesStatus.textContent = 'Lade Meldungen…';

  try {
    const [detailRes, articlesRes] = await Promise.all([
      fetch(`/api/fordon/${encodeURIComponent(slug)}?t=${Date.now()}`, { cache: 'no-store' }),
      fetch(`/api/fordon/${encodeURIComponent(slug)}/articles?limit=8&t=${Date.now()}`, { cache: 'no-store' })
    ]);

    if (requestId !== detailRequestId) return;

    if (!detailRes.ok) throw new Error('Fahrzeug nicht gefunden');
    const { vehicle } = await detailRes.json();
    const articlesPayload = articlesRes.ok ? await articlesRes.json() : { articles: [] };

    const categoryLabel = catalog.categories[vehicle.category];
    const statusLabel = STATUS_LABELS[vehicle.status] || { de: vehicle.status, sv: vehicle.status };
    const designation = designationFromName(vehicle.name_de);

    detailCategory.textContent = categoryLabel ? `${categoryLabel.de} · ${categoryLabel.sv}` : vehicle.category;
    detailTitleDe.textContent = vehicle.name_de;
    detailTitleSv.textContent = vehicle.name_sv;
    detailDesignation.textContent = designation;
    detailStatus.innerHTML = `<span class="fordon-status-dot" data-status="${escapeHtml(vehicle.status)}"></span> ${escapeHtml(statusLabel.de)} <span lang="sv">(${escapeHtml(statusLabel.sv)})</span>`;
    detailSummaryDe.textContent = vehicle.summary_de;
    detailSummarySv.textContent = vehicle.summary_sv;
    renderSpecs(vehicle);

    vehicleDetail.style.animation = 'none';
    void vehicleDetail.offsetHeight;
    vehicleDetail.style.animation = '';

    const articleCount = articlesPayload.articles?.length || 0;
    articlesStatus.textContent = articleCount
      ? `${articleCount} Meldung${articleCount === 1 ? '' : 'en'} aus der Quellenlage`
      : 'Keine passenden Meldungen gefunden.';
    renderRelatedArticles(articlesPayload.articles || []);
  } catch (error) {
    if (requestId !== detailRequestId) return;
    detailPlaceholder.hidden = false;
    vehicleDetail.hidden = true;
    detailPlaceholder.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
}

function setCategory(category) {
  activeCategory = category;
  categoryTabs.forEach((tab) => {
    const isActive = tab.dataset.category === category;
    tab.classList.toggle('is-active', isActive);
    tab.setAttribute('aria-selected', String(isActive));
  });
  renderVehicleList();
}

function slugFromHash() {
  const hash = location.hash.replace(/^#/, '').trim();
  return hash || null;
}

async function init() {
  try {
    const response = await fetch(`/api/fordon/catalog?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Katalog konnte nicht geladen werden.');
    catalog = await response.json();

    categoryTabs.forEach((tab) => {
      tab.disabled = false;
      tab.addEventListener('click', () => setCategory(tab.dataset.category));
    });

    renderOperatorChips();

    const hashSlug = slugFromHash();
    const defaultSlug = hashSlug
      || catalog.vehicles.find((v) => v.slug === 'x2000')?.slug
      || catalog.vehicles.find((v) => v.category === 'triebzuege')?.slug
      || catalog.vehicles[0]?.slug;

    if (hashSlug) {
      const vehicle = catalog.vehicles.find((v) => v.slug === hashSlug);
      if (vehicle) activeCategory = vehicle.category;
      setCategory(activeCategory);
    } else {
      setCategory(activeCategory);
    }

    if (defaultSlug) await selectVehicle(defaultSlug, Boolean(hashSlug));
    fordonMain.removeAttribute('aria-busy');
  } catch (error) {
    fordonMain.innerHTML = `<p class="fordon-detail-placeholder">${escapeHtml(error.message)}</p>`;
  }
}

window.addEventListener('hashchange', () => {
  const slug = slugFromHash();
  if (!slug || !catalog || slug === selectedSlug) return;
  const vehicle = catalog.vehicles.find((v) => v.slug === slug);
  if (vehicle && vehicle.category !== activeCategory) {
    setCategory(vehicle.category);
  }
  selectVehicle(slug, false);
});

init();

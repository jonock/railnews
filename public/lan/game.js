const STORAGE_KEY = 'railnews-lan-quiz-v2';
const RECENT_AVOID = 3;

const mapHost = document.getElementById('mapHost');
const mapCard = document.getElementById('mapCard');
const scoreLabel = document.getElementById('scoreLabel');
const promptHeading = document.getElementById('promptHeading');
const locateHint = document.getElementById('locateHint');
const easyAnswers = document.getElementById('easyAnswers');
const hardAnswers = document.getElementById('hardAnswers');
const choiceList = document.getElementById('choiceList');
const answerInput = document.getElementById('answerInput');
const feedback = document.getElementById('feedback');
const nextBtn = document.getElementById('nextBtn');
const resetBtn = document.getElementById('resetBtn');
const diffButtons = document.querySelectorAll('[data-difficulty]');
const directionButtons = document.querySelectorAll('[data-direction]');

let counties = [];
let mapPaths = new Map();
let direction = 'name';
let difficulty = 'easy';
let currentCounty = null;
let answered = false;
let recentIds = [];
let locateOptionIds = new Set();
let stats = loadStats();

function loadStats() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem('railnews-lan-quiz-v1');
    }
    if (!raw) return defaultStats();

    const parsed = JSON.parse(raw);
    if (parsed.name && parsed.locate) {
      return {
        name: normalizeModeStats(parsed.name),
        locate: normalizeModeStats(parsed.locate),
        lastPlayed: parsed.lastPlayed || null
      };
    }

    if (parsed.easy || parsed.hard) {
      return {
        name: normalizeModeStats(parsed),
        locate: defaultModeStats(),
        lastPlayed: parsed.lastPlayed || null
      };
    }

    return defaultStats();
  } catch {
    return defaultStats();
  }
}

function defaultModeStats() {
  return {
    easy: { correct: 0, total: 0 },
    hard: { correct: 0, total: 0 }
  };
}

function normalizeModeStats(modeStats) {
  return {
    easy: {
      correct: Number(modeStats?.easy?.correct) || 0,
      total: Number(modeStats?.easy?.total) || 0
    },
    hard: {
      correct: Number(modeStats?.hard?.correct) || 0,
      total: Number(modeStats?.hard?.total) || 0
    }
  };
}

function defaultStats() {
  return {
    name: defaultModeStats(),
    locate: defaultModeStats(),
    lastPlayed: null
  };
}

function saveStats() {
  stats.lastPlayed = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
}

function currentStats() {
  return stats[direction][difficulty];
}

function normalizeAnswer(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/\s+/g, ' ')
    .replace(/\s*lan\s*$/i, '')
    .replace(/\s*län\s*$/i, '')
    .trim();
}

function matchesCounty(input, county) {
  const normalized = normalizeAnswer(input);
  if (!normalized) return false;

  const candidates = new Set([
    normalizeAnswer(county.name),
    normalizeAnswer(county.shortName),
    normalizeAnswer(county.slug.replace(/-/g, ' ')),
    ...county.aliases.map(normalizeAnswer)
  ]);

  return candidates.has(normalized);
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pickCounty() {
  const pool = counties.filter((county) => !recentIds.includes(county.id));
  const source = pool.length ? pool : counties;
  return source[Math.floor(Math.random() * source.length)];
}

function updateScoreLabel() {
  const modeStats = currentStats();
  scoreLabel.textContent = `Punkte: ${modeStats.correct} / ${modeStats.total}`;
}

function setDirection(mode) {
  direction = mode;
  directionButtons.forEach((button) => {
    const active = button.dataset.direction === mode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  mapCard.classList.toggle('is-locate', mode === 'locate');
  updateAnswerVisibility();
  updateScoreLabel();
}

function setDifficulty(mode) {
  difficulty = mode;
  diffButtons.forEach((button) => {
    const active = button.dataset.difficulty === mode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  updateAnswerVisibility();
  updateScoreLabel();
}

function updateAnswerVisibility() {
  if (direction === 'name') {
    easyAnswers.hidden = difficulty !== 'easy';
    hardAnswers.hidden = difficulty !== 'hard';
    locateHint.hidden = true;
  } else {
    easyAnswers.hidden = true;
    hardAnswers.hidden = true;
    locateHint.hidden = difficulty !== 'easy';
  }
}

function clearMapState() {
  mapPaths.forEach((path) => {
    path.classList.remove(
      'is-target',
      'is-dimmed',
      'is-reveal',
      'is-clickable',
      'is-disabled',
      'is-option',
      'is-wrong-pick'
    );
  });
  locateOptionIds = new Set();
}

function highlightCounty(countyId, { reveal = false } = {}) {
  clearMapState();
  mapPaths.forEach((path, id) => {
    if (id === countyId) {
      path.classList.add(reveal ? 'is-reveal' : 'is-target');
    } else {
      path.classList.add('is-dimmed');
    }
  });
}

function setupLocateMap(county) {
  clearMapState();

  if (difficulty === 'easy') {
    const distractors = shuffle(counties.filter((item) => item.id !== county.id)).slice(0, 2);
    locateOptionIds = new Set([county.id, ...distractors.map((item) => item.id)]);

    mapPaths.forEach((path, id) => {
      if (locateOptionIds.has(id)) {
        path.classList.add('is-clickable', 'is-option');
      } else {
        path.classList.add('is-dimmed', 'is-disabled');
      }
    });
    return;
  }

  mapPaths.forEach((path) => {
    path.classList.add('is-clickable');
  });
}

function resetQuestionUi() {
  answered = false;
  feedback.hidden = true;
  feedback.textContent = '';
  feedback.className = 'lan-feedback';
  mapCard.classList.remove('is-correct', 'is-wrong');
  nextBtn.hidden = true;
  answerInput.value = '';
  answerInput.disabled = false;
  choiceList.querySelectorAll('button').forEach((button) => {
    button.disabled = false;
    button.classList.remove('is-correct-pick', 'is-wrong-pick');
  });
  clearMapState();
}

function buildChoices(correctCounty) {
  const distractors = shuffle(counties.filter((county) => county.id !== correctCounty.id)).slice(0, 2);
  const options = shuffle([correctCounty, ...distractors]);

  choiceList.replaceChildren();
  options.forEach((county) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'lan-choice';
    button.textContent = county.shortName;
    button.addEventListener('click', () => submitAnswer(county.id));
    choiceList.append(button);
  });
}

function showFeedback(correct, county, { clickedId = null } = {}) {
  feedback.hidden = false;
  if (correct) {
    feedback.className = 'lan-feedback is-correct';
    feedback.textContent = 'Richtig!';
    mapCard.classList.add('is-correct');
    if (direction === 'locate') {
      highlightCounty(county.id);
    }
  } else {
    feedback.className = 'lan-feedback is-wrong';
    feedback.textContent = `Leider falsch — richtig wäre ${county.name}.`;
    mapCard.classList.add('is-wrong');

    if (direction === 'locate') {
      clearMapState();
      mapPaths.forEach((path, id) => {
        if (id === county.id) {
          path.classList.add('is-reveal');
        } else if (id === clickedId) {
          path.classList.add('is-wrong-pick');
        } else {
          path.classList.add('is-dimmed');
        }
      });
    } else {
      highlightCounty(county.id, { reveal: true });
    }
  }
}

function lockNameInputs(selectedId, correct) {
  if (difficulty === 'easy') {
    choiceList.querySelectorAll('button').forEach((button) => {
      const county = counties.find((item) => item.shortName === button.textContent);
      button.disabled = true;
      if (county?.id === currentCounty.id) button.classList.add('is-correct-pick');
      if (county?.id === selectedId && !correct) button.classList.add('is-wrong-pick');
    });
  } else {
    answerInput.disabled = true;
  }
}

function submitAnswer(selectedIdOrText) {
  if (answered || !currentCounty) return;

  let correct = false;
  let clickedId = null;

  if (direction === 'locate') {
    clickedId = selectedIdOrText;
    correct = selectedIdOrText === currentCounty.id;
  } else if (difficulty === 'easy') {
    correct = selectedIdOrText === currentCounty.id;
  } else {
    correct = matchesCounty(selectedIdOrText, currentCounty);
  }

  answered = true;
  const modeStats = currentStats();
  modeStats.total += 1;
  if (correct) modeStats.correct += 1;
  saveStats();
  updateScoreLabel();

  if (direction === 'name') {
    lockNameInputs(selectedIdOrText, correct);
    if (correct) highlightCounty(currentCounty.id);
  } else {
    mapPaths.forEach((path) => path.classList.remove('is-clickable'));
  }

  showFeedback(correct, currentCounty, { clickedId });
  nextBtn.hidden = false;
}

function updatePrompt() {
  if (direction === 'locate') {
    promptHeading.innerHTML = `Wo liegt <strong>${currentCounty.shortName}</strong>?`;
    return;
  }

  promptHeading.textContent = 'Welches Län ist markiert?';
}

function resetGame() {
  stats = defaultStats();
  saveStats();
  recentIds = [];
  updateScoreLabel();
  nextQuestion();
}

function nextQuestion() {
  currentCounty = pickCounty();
  recentIds = [currentCounty.id, ...recentIds.filter((id) => id !== currentCounty.id)].slice(0, RECENT_AVOID);

  resetQuestionUi();
  updateAnswerVisibility();
  updatePrompt();

  if (direction === 'name') {
    highlightCounty(currentCounty.id);
    buildChoices(currentCounty);
    if (difficulty === 'hard') answerInput.focus();
  } else {
    setupLocateMap(currentCounty);
  }
}

function handleMapClick(event) {
  if (direction !== 'locate' || answered) return;

  const path = event.target.closest('.lan-path[data-lan]');
  if (!path || path.classList.contains('is-disabled')) return;

  submitAnswer(path.dataset.lan);
}

async function loadMap() {
  const response = await fetch('/lan/map.svg');
  if (!response.ok) throw new Error('Karte konnte nicht geladen werden.');
  const svgText = await response.text();
  mapHost.innerHTML = svgText;

  const svg = mapHost.querySelector('svg');
  if (svg) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Karte der schwedischen Län');
  }

  mapHost.querySelectorAll('.lan-path[data-lan]').forEach((path) => {
    mapPaths.set(path.dataset.lan, path);
  });

  mapHost.addEventListener('click', handleMapClick);
}

async function init() {
  const response = await fetch('/lan/counties.json');
  if (!response.ok) throw new Error('Länsdaten konnten nicht geladen werden.');
  counties = await response.json();

  await loadMap();

  directionButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.direction === direction) return;
      setDirection(button.dataset.direction);
      nextQuestion();
    });
  });

  diffButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (button.dataset.difficulty === difficulty) return;
      setDifficulty(button.dataset.difficulty);
      nextQuestion();
    });
  });

  hardAnswers.addEventListener('submit', (event) => {
    event.preventDefault();
    submitAnswer(answerInput.value);
  });

  nextBtn.addEventListener('click', nextQuestion);
  resetBtn.addEventListener('click', resetGame);

  setDirection('name');
  setDifficulty('easy');
  updateScoreLabel();
  nextQuestion();
}

init().catch((error) => {
  feedback.hidden = false;
  feedback.className = 'lan-feedback is-wrong';
  feedback.textContent = error.message || 'Das Quiz konnte nicht gestartet werden.';
});

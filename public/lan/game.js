import { trackAnswer, trackQuizStarted, trackRoundComplete } from './analytics.js';

const STORAGE_KEY = 'railnews-lan-quiz-v2';
const CORRECT_ANSWER_DELAY_MS = 2000;

const mapHost = document.getElementById('mapHost');
const mapCard = document.getElementById('mapCard');
const quizPanel = document.getElementById('quizPanel');
const scoreLabel = document.getElementById('scoreLabel');
const promptHeading = document.getElementById('promptHeading');
const roundCompleteHeading = document.getElementById('roundCompleteHeading');
const locateHint = document.getElementById('locateHint');
const easyAnswers = document.getElementById('easyAnswers');
const hardAnswers = document.getElementById('hardAnswers');
const choiceList = document.getElementById('choiceList');
const answerInput = document.getElementById('answerInput');
const feedback = document.getElementById('feedback');
const loadStatus = document.getElementById('loadStatus');
const nextBtn = document.getElementById('nextBtn');
const resetBtn = document.getElementById('resetBtn');
const nextRoundBtn = document.getElementById('nextRoundBtn');
const roundCompleteBlock = document.getElementById('roundCompleteBlock');
const roundCompleteFeedback = document.getElementById('roundCompleteFeedback');
const roundCompleteHint = document.getElementById('roundCompleteHint');
const modeResetPrompt = document.getElementById('modeResetPrompt');
const confirmModeResetBtn = document.getElementById('confirmModeReset');
const cancelModeResetBtn = document.getElementById('cancelModeReset');
const diffButtons = document.querySelectorAll('[data-difficulty]');
const directionButtons = document.querySelectorAll('[data-direction]');

let counties = [];
let mapPaths = new Map();
let direction = 'name';
let difficulty = 'easy';
let currentCounty = null;
let answered = false;
let playedIds = [];
let roundCorrect = 0;
let roundComplete = false;
let pendingModeReset = null;
let isReady = false;
let isLoading = false;
let stats = loadStats();
let mapPointerStart = null;
let nextQuestionTimer = null;

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
        lastPlayed: parsed.lastPlayed || null,
      };
    }

    if (parsed.easy || parsed.hard) {
      return {
        name: normalizeModeStats(parsed),
        locate: defaultModeStats(),
        lastPlayed: parsed.lastPlayed || null,
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
    hard: { correct: 0, total: 0 },
  };
}

function normalizeModeStats(modeStats) {
  return {
    easy: {
      correct: Number(modeStats?.easy?.correct) || 0,
      total: Number(modeStats?.easy?.total) || 0,
    },
    hard: {
      correct: Number(modeStats?.hard?.correct) || 0,
      total: Number(modeStats?.hard?.total) || 0,
    },
  };
}

function defaultStats() {
  return {
    name: defaultModeStats(),
    locate: defaultModeStats(),
    lastPlayed: null,
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
    ...county.aliases.map(normalizeAnswer),
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

function getRoundCompleteMessage(correct) {
  if (correct >= 21) {
    return { tier: 'perfect', text: null };
  }
  if (correct <= 10) {
    return {
      tier: 'start',
      text: 'Ein guter Start! Vielleicht hilft dir eine Zimtschnecke um noch etwas besser zu werden.',
    };
  }
  return {
    tier: 'good',
    text: 'Du kennst Schweden schon richtig gut, wann startest du dein nächstes Schwedenreisli?',
  };
}

function updateScoreLabel() {
  const modeStats = currentStats();
  const progress = roundComplete
    ? counties.length
    : playedIds.length + (currentCounty ? 1 : 0);
  const total = counties.length || 21;
  scoreLabel.textContent = `Frage ${progress}/${total} · Punkte: ${modeStats.correct} / ${modeStats.total}`;
}

function setControlsDisabled(disabled) {
  resetBtn.disabled = disabled;
  directionButtons.forEach((button) => {
    button.disabled = disabled;
  });
  diffButtons.forEach((button) => {
    button.disabled = disabled;
  });
}

function setDirectionUi(mode) {
  directionButtons.forEach((button) => {
    const active = button.dataset.direction === mode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  mapCard.classList.toggle('is-locate', mode === 'locate');
}

function setDifficultyUi(mode) {
  diffButtons.forEach((button) => {
    const active = button.dataset.difficulty === mode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

function updateAnswerVisibility() {
  if (roundComplete) {
    easyAnswers.hidden = true;
    hardAnswers.hidden = true;
    locateHint.hidden = true;
    roundCompleteBlock.hidden = false;
    return;
  }

  roundCompleteBlock.hidden = true;

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

function updatePrompt() {
  if (roundComplete) {
    promptHeading.hidden = true;
    roundCompleteHeading.hidden = false;
    locateHint.hidden = true;
    return;
  }

  roundCompleteHeading.hidden = true;
  promptHeading.hidden = false;

  if (direction === 'locate' && currentCounty) {
    promptHeading.innerHTML = `Wo liegt <strong>${currentCounty.shortName}</strong>?`;
    return;
  }

  promptHeading.textContent = 'Welches Län ist markiert?';
}

function updateRoundCompleteUi() {
  if (!roundComplete) {
    roundCompleteFeedback.hidden = true;
    roundCompleteHint.hidden = false;
    return;
  }

  const message = getRoundCompleteMessage(roundCorrect);
  roundCompleteFeedback.hidden = false;
  roundCompleteFeedback.className = 'lan-feedback';
  roundCompleteFeedback.classList.add(message.tier === 'perfect' ? 'is-perfect' : 'is-correct');

  if (message.tier === 'perfect') {
    roundCompleteFeedback.innerHTML = `
      <p class="lan-perfect-lead">Stort grattis, du är fantastisk!</p>
      <p class="lan-perfect-copy">
        Falls du (ohne zu tricksen) alles richtig herausgefunden hast, schicke ein Mail an
        <a href="mailto:jonathan@jonock.ch" class="lan-mail-link">jonathan@jonock.ch</a>
        mit deiner Adresse und wir schicken dir eine Postkarte vom Schwedenreisli.
      </p>
    `;
  } else {
    roundCompleteFeedback.textContent = message.text;
  }

  roundCompleteHint.hidden = false;
}

function showModeResetPrompt(pending) {
  pendingModeReset = pending;
  modeResetPrompt.hidden = false;
}

function hideModeResetPrompt() {
  pendingModeReset = null;
  modeResetPrompt.hidden = true;
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
      'is-wrong-pick',
      'is-played',
    );
  });
}

function applyPlayedMarkers() {
  const currentId = currentCounty?.id;
  mapPaths.forEach((path, id) => {
    if (playedIds.includes(id) && id !== currentId) {
      path.classList.add('is-played');
    }
  });
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
  applyPlayedMarkers();
}

function setupLocateMap(county) {
  clearMapState();

  if (difficulty === 'easy') {
    const distractors = shuffle(counties.filter((item) => item.id !== county.id)).slice(0, 2);
    const optionIds = new Set([county.id, ...distractors.map((item) => item.id)]);

    mapPaths.forEach((path, id) => {
      if (optionIds.has(id)) {
        path.classList.add('is-clickable', 'is-option');
      } else {
        path.classList.add('is-dimmed', 'is-disabled');
      }
    });
    applyPlayedMarkers();
    return;
  }

  mapPaths.forEach((path) => {
    path.classList.add('is-clickable');
  });
  applyPlayedMarkers();
}

function clearNextQuestionTimer() {
  if (nextQuestionTimer !== null) {
    clearTimeout(nextQuestionTimer);
    nextQuestionTimer = null;
  }
}

function scheduleNextQuestion() {
  clearNextQuestionTimer();
  nextQuestionTimer = setTimeout(() => {
    nextQuestionTimer = null;
    nextQuestion();
  }, CORRECT_ANSWER_DELAY_MS);
}

function resetQuestionUi() {
  clearNextQuestionTimer();
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

function pickCounty() {
  if (!counties.length) return undefined;

  const remaining = counties.filter((county) => !playedIds.includes(county.id));
  if (!remaining.length) return undefined;

  return remaining[Math.floor(Math.random() * remaining.length)];
}

function markAllCountiesPlayed() {
  mapPaths.forEach((path) => path.classList.add('is-played'));
}

function showFeedback(correct, county, clickedId = null) {
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
    const wrongText = direction === 'locate' && clickedId
      ? (() => {
          const clicked = counties.find((item) => item.id === clickedId);
          return clicked
            ? `Du hast ${clicked.shortName} markiert — gemeint war ${county.shortName}.`
            : `Leider falsch — gemeint war ${county.shortName}.`;
        })()
      : `Leider falsch — richtig wäre ${county.name}.`;

    feedback.textContent = wrongText;
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
      applyPlayedMarkers();
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
  if (answered || !currentCounty || roundComplete || !isReady) return;

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
  if (correct) {
    modeStats.correct += 1;
    roundCorrect += 1;
  }
  saveStats();
  trackAnswer(correct, direction, difficulty);
  updateScoreLabel();

  if (direction === 'name') {
    lockNameInputs(selectedIdOrText, correct);
    if (correct) highlightCounty(currentCounty.id);
  } else {
    mapPaths.forEach((path) => path.classList.remove('is-clickable'));
  }

  showFeedback(correct, currentCounty, clickedId);

  if (correct) {
    nextBtn.hidden = true;
    scheduleNextQuestion();
  } else {
    nextBtn.hidden = false;
  }
}

function handleRoundComplete() {
  trackRoundComplete(roundCorrect, direction, difficulty);
  roundComplete = true;
  clearNextQuestionTimer();
  currentCounty = null;
  answered = false;
  feedback.hidden = true;
  nextBtn.hidden = true;
  choiceList.replaceChildren();
  answerInput.value = '';
  answerInput.disabled = true;
  clearMapState();
  markAllCountiesPlayed();
  updatePrompt();
  updateAnswerVisibility();
  updateRoundCompleteUi();
  updateScoreLabel();
}

function startNewRound() {
  if (!isReady) return;
  roundComplete = false;
  playedIds = [];
  roundCorrect = 0;
  nextQuestion();
}

function nextQuestion() {
  const previousId = currentCounty?.id;
  if (previousId && !playedIds.includes(previousId)) {
    playedIds = [...playedIds, previousId];
  }

  const county = pickCounty();
  if (!county) {
    handleRoundComplete();
    return;
  }

  roundComplete = false;
  currentCounty = county;
  resetQuestionUi();
  updateAnswerVisibility();
  updatePrompt();
  updateRoundCompleteUi();

  if (direction === 'name') {
    highlightCounty(county.id);
    buildChoices(county);
    if (difficulty === 'hard') answerInput.focus();
  } else {
    setupLocateMap(county);
  }

  updateScoreLabel();
}

function resetSessionState() {
  stats = defaultStats();
  saveStats();
  playedIds = [];
  roundCorrect = 0;
  roundComplete = false;
}

function requestDirectionChange(mode) {
  if (!isReady) return;
  if (direction === mode) return;
  showModeResetPrompt({ kind: 'direction', value: mode });
}

function requestDifficultyChange(mode) {
  if (!isReady) return;
  if (difficulty === mode) return;
  showModeResetPrompt({ kind: 'difficulty', value: mode });
}

function confirmModeReset() {
  if (!pendingModeReset || !isReady) return;

  const pending = pendingModeReset;
  hideModeResetPrompt();

  if (pending.kind === 'direction') {
    direction = pending.value;
    setDirectionUi(direction);
  } else {
    difficulty = pending.value;
    setDifficultyUi(difficulty);
  }

  resetSessionState();
  nextQuestion();
}

function cancelModeReset() {
  hideModeResetPrompt();
}

function resetGame() {
  if (!isReady) return;
  hideModeResetPrompt();
  resetSessionState();
  nextQuestion();
}

function handleMapPointerDown(event) {
  mapPointerStart = { x: event.clientX, y: event.clientY };
}

function clearMapPointer() {
  mapPointerStart = null;
}

function handleMapPointer(event) {
  if (!isReady || roundComplete || direction !== 'locate' || answered) return;
  if (event.pointerType === 'mouse' && event.button !== 0) return;
  if (!mapPointerStart) return;

  const dx = event.clientX - mapPointerStart.x;
  const dy = event.clientY - mapPointerStart.y;
  mapPointerStart = null;
  if (Math.hypot(dx, dy) > 12) return;

  const path = event.target.closest('.lan-path[data-lan]');
  if (!path || path.classList.contains('is-disabled') || !path.dataset.lan) return;

  submitAnswer(path.dataset.lan);
}

function cropMapViewBox(svg) {
  const elements = svg.querySelectorAll('.lan-path, .lan-border');
  if (!elements.length) return;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  elements.forEach((element) => {
    const { x, y, width, height } = element.getBBox();
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  });

  const pad = 4;
  svg.setAttribute(
    'viewBox',
    `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`,
  );
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.removeAttribute('width');
  svg.removeAttribute('height');
}

async function loadMap() {
  const response = await fetch('/lan/map.svg');
  if (!response.ok) throw new Error('Karte konnte nicht geladen werden.');
  mapHost.innerHTML = await response.text();

  const svg = mapHost.querySelector('svg');
  if (svg) {
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Karte der schwedischen Län');
    cropMapViewBox(svg);
  }

  mapPaths = new Map();
  mapHost.querySelectorAll('.lan-path[data-lan]').forEach((path) => {
    mapPaths.set(path.dataset.lan, path);
  });

  mapHost.addEventListener('pointerdown', handleMapPointerDown);
  mapHost.addEventListener('pointerup', handleMapPointer);
  mapHost.addEventListener('pointercancel', clearMapPointer);
}

function showLoadError(message) {
  loadStatus.hidden = false;
  loadStatus.className = 'lan-feedback is-wrong';
  loadStatus.textContent = message;
  quizPanel.setAttribute('aria-busy', 'false');
}

async function init() {
  if (isLoading) return;

  try {
    isLoading = true;
    isReady = false;
    setControlsDisabled(true);
    loadStatus.hidden = false;
    loadStatus.className = 'lan-loading';
    loadStatus.textContent = 'Quiz wird geladen…';

    const response = await fetch('/lan/counties.json');
    if (!response.ok) throw new Error('Länsdaten konnten nicht geladen werden.');
    counties = await response.json();

    await loadMap();

    directionButtons.forEach((button) => {
      button.addEventListener('click', () => {
        requestDirectionChange(button.dataset.direction);
      });
    });

    diffButtons.forEach((button) => {
      button.addEventListener('click', () => {
        requestDifficultyChange(button.dataset.difficulty);
      });
    });

    hardAnswers.addEventListener('submit', (event) => {
      event.preventDefault();
      submitAnswer(answerInput.value);
    });

    nextBtn.addEventListener('click', nextQuestion);
    nextRoundBtn.addEventListener('click', startNewRound);
    resetBtn.addEventListener('click', resetGame);
    confirmModeResetBtn.addEventListener('click', confirmModeReset);
    cancelModeResetBtn.addEventListener('click', cancelModeReset);

    setDirectionUi('name');
    setDifficultyUi('easy');
    updateScoreLabel();
    nextQuestion();

    isReady = counties.length > 0 && currentCounty !== null;
    if (isReady) {
      trackQuizStarted(direction, difficulty);
      loadStatus.hidden = true;
      setControlsDisabled(false);
      quizPanel.setAttribute('aria-busy', 'false');
    } else {
      showLoadError('Das Quiz konnte nicht gestartet werden.');
    }
  } catch (error) {
    isReady = false;
    showLoadError(error.message || 'Das Quiz konnte nicht gestartet werden.');
  } finally {
    isLoading = false;
  }
}

init();

const MATOMO_HOST = 'https://analytics.jonock.ch';
const MATOMO_SITE_ID = 1;

function modeLabel(direction, difficulty) {
  const dir = direction === 'name' ? 'Benennen' : 'Finden';
  const diff = difficulty === 'easy' ? 'Leicht' : 'Schwer';
  return `${dir} · ${diff}`;
}

function ensureMatomo() {
  if (window._matomoInitialized) return;
  window._matomoInitialized = true;

  window._paq = window._paq || [];
  window._paq.push(['disableCookies']);
  window._paq.push(['trackPageView']);
  window._paq.push(['enableLinkTracking']);
  window._paq.push(['setTrackerUrl', `${MATOMO_HOST}/matomo.php`]);
  window._paq.push(['setSiteId', MATOMO_SITE_ID]);

  const script = document.createElement('script');
  script.async = true;
  script.src = `${MATOMO_HOST}/matomo.js`;
  document.head.append(script);
}

function trackEvent(action, name, value) {
  ensureMatomo();
  if (value === undefined) {
    window._paq.push(['trackEvent', 'Lan-Quiz', action, name]);
  } else {
    window._paq.push(['trackEvent', 'Lan-Quiz', action, name, value]);
  }
}

export function trackQuizStarted(direction, difficulty) {
  trackEvent('Quiz gestartet', modeLabel(direction, difficulty));
}

export function trackAnswer(correct, direction, difficulty) {
  trackEvent(
    correct ? 'Antwort richtig' : 'Antwort falsch',
    modeLabel(direction, difficulty),
    correct ? 1 : 0,
  );
}

export function trackRoundComplete(roundCorrect, direction, difficulty) {
  trackEvent('Runde abgeschlossen', modeLabel(direction, difficulty), roundCorrect);
}

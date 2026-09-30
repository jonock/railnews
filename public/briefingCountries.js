const BRIEFING_COUNTRIES = [
  {
    code: 'se',
    name: 'Schweden',
    flag: '🇸🇪',
    terms: [
      'schweden', 'schwedisch', 'schwedische', 'schwedischen', 'schwedischer', 'schwedisches',
      'sweden', 'swedish', 'sverige', 'svensk', 'svenska', 'trafikverket', 'sj',
      'stockholm', 'goteborg', 'gothenburg', 'malmo', 'kiruna', 'malmbanan', 'ostlanken', 'jarnvagar'
    ]
  },
  {
    code: 'no',
    name: 'Norwegen',
    flag: '🇳🇴',
    terms: [
      'norwegen', 'norwegisch', 'norwegische', 'norwegischen', 'norwegischer', 'norwegisches',
      'norway', 'norwegian', 'norge', 'norsk', 'norske', 'bane nor',
      'oslo', 'bergen', 'trondheim', 'nordlandsbanen'
    ]
  },
  {
    code: 'dk',
    name: 'Dänemark',
    flag: '🇩🇰',
    terms: [
      'danemark', 'danisch', 'danische', 'danischen', 'danischer', 'danisches',
      'denmark', 'danish', 'danmark', 'dansk', 'danske', 'banedanmark', 'dsb',
      'kobenhavn', 'copenhagen', 'kopenhagen', 'aarhus'
    ]
  },
  {
    code: 'fi',
    name: 'Finnland',
    flag: '🇫🇮',
    terms: [
      'finnland', 'finnisch', 'finnische', 'finnischen', 'finnischer', 'finnisches',
      'finland', 'finnish', 'suomi', 'vaylavirasto', 'traficom', 'vr',
      'helsinki', 'tampere', 'turku'
    ]
  }
];

function normalizeCountryText(value = '') {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
    .toLowerCase();
}

function containsCountryTerm(text, term) {
  const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapedTerm}(?=$|[^\\p{L}\\p{N}])`, 'u').test(text);
}

export function briefingCountryDetails(summary = '') {
  const text = normalizeCountryText(summary);
  return BRIEFING_COUNTRIES
    .filter(({ terms }) => terms.some((term) => containsCountryTerm(text, term)))
    .map(({ code, name, flag }) => ({ code, name, flag }));
}

export function briefingCountryFlags(summary = '') {
  return briefingCountryDetails(summary).map(({ flag }) => flag).join(' ');
}

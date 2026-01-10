// Centralized severity/risk terminology helpers

export const SEVERITY_LABELS = [
  'risikofylt',
  'høy oppmerksomhet',
  'moderat',
  'lav',
];

const normalize = (str) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .replace(/æ/g, 'ae');
};

export const severityKey = (label) => normalize(label);

export const severityClass = (label) => `sev-${severityKey(label)}`;
export const riskClass = (label) => `risk-${severityKey(label)}`;

export const severityCompare = (a, b) => {
  const order = {
    'risikofylt': 0,
    'høy oppmerksomhet': 1,
    'moderat': 2,
    'lav': 3,
  };
  return (order[a] ?? 4) - (order[b] ?? 4);
};

export const severityColors = (label) => {
  switch (label) {
    case 'risikofylt':
      return { fg: 'var(--accent-red)', bg: 'rgba(231, 76, 60, 0.2)' };
    case 'høy oppmerksomhet':
      return { fg: 'var(--accent-orange)', bg: 'rgba(255, 107, 53, 0.2)' };
    case 'moderat':
      return { fg: 'var(--accent-gold)', bg: 'rgba(212, 165, 116, 0.2)' };
    default:
      return { fg: 'var(--accent-green)', bg: 'rgba(39, 174, 96, 0.2)' };
  }
};

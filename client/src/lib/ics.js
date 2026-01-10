// Minimal ICS generator for quarantine tasks

const formatDate = (date) => {
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, '0');
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  return `${y}${m}${day}`;
};

export function generateICSFromQuarantine(tasks = [], vesselName = '') {
  const quarantines = tasks.filter(t => (t.type || '').toLowerCase() === 'karantene');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AquaShield//Quarantine Calendar//NO',
    'CALSCALE:GREGORIAN',
  ];

  quarantines.forEach((t) => {
    const start = new Date(t.dueDate);
    // t.duration is number of days quarantine lasts; event runs [dueDate - duration, dueDate]
    const dtEnd = formatDate(start);
    const dtStart = formatDate(new Date(start.getFullYear(), start.getMonth(), start.getDate() - (t.duration || 0)));
    const uid = `${t.id}@aquashield`; 
    const summary = `Karantene: ${t.name || 'Planlagt karantene'}`;
    const description = `Fartøy: ${vesselName}`;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${formatDate(new Date())}T000000Z`);
    lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
    lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
    lines.push(`SUMMARY:${summary}`);
    lines.push(`DESCRIPTION:${description}`);
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

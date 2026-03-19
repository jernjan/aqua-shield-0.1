export async function loadProfile() {
    const response = await fetch('./data/profile.json', { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Kunne ikke laste profile.json (${response.status})`);
    }
    return response.json();
}

export function mapById(items) {
    const index = new Map();
    for (const item of items || []) {
        if (item && item.id) {
            index.set(item.id, item);
        }
    }
    return index;
}

export function isoToLocal(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('nb-NO', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
    });
}

export function createCell(text) {
    const td = document.createElement('td');
    td.textContent = text ?? '-';
    return td;
}

export function toIcsDate(isoString) {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return null;

    const pad = (n) => String(n).padStart(2, '0');
    const y = date.getUTCFullYear();
    const m = pad(date.getUTCMonth() + 1);
    const d = pad(date.getUTCDate());
    const hh = pad(date.getUTCHours());
    const mm = pad(date.getUTCMinutes());
    const ss = pad(date.getUTCSeconds());

    return `${y}${m}${d}T${hh}${mm}${ss}Z`;
}

export function downloadTextFile(filename, content, mime = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
}

const FEEDBACK_STORE_KEY = 'pilotLiteFeedbackV1';

function loadFeedback() {
    try {
        const raw = localStorage.getItem(FEEDBACK_STORE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}

function saveFeedback(entries) {
    try {
        localStorage.setItem(FEEDBACK_STORE_KEY, JSON.stringify(entries));
    } catch (_) {
        // ignore storage quota issues
    }
}

function formatTs(isoValue) {
    const date = new Date(isoValue);
    if (Number.isNaN(date.getTime())) return isoValue || '-';
    try {
        return new Intl.DateTimeFormat('nb-NO', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).format(date);
    } catch (_) {
        return date.toLocaleString();
    }
}

function normalizeText(value) {
    return String(value || '').toLowerCase();
}

function getFiltered(entries) {
    const category = String(document.getElementById('feedbackCategoryFilter')?.value || 'all');
    const severity = String(document.getElementById('feedbackSeverityFilter')?.value || 'all');
    const search = normalizeText(document.getElementById('feedbackSearchInput')?.value || '');

    return entries.filter((item) => {
        if (category !== 'all' && String(item.category || '') !== category) return false;
        if (severity !== 'all' && String(item.severity || '') !== severity) return false;
        if (!search) return true;

        const haystack = normalizeText([
            item.message,
            item.page,
            item.url,
            item.testerName,
            item.category,
            item.severity
        ].join(' | '));

        return haystack.includes(search);
    });
}

function renderMeta(filtered, allEntries) {
    const meta = document.getElementById('feedbackInboxMeta');
    if (!meta) return;

    const bySeverity = {
        høy: filtered.filter((item) => item.severity === 'høy').length,
        medium: filtered.filter((item) => item.severity === 'medium').length,
        lav: filtered.filter((item) => item.severity === 'lav').length
    };

    meta.textContent = `Viser ${filtered.length} av ${allEntries.length} feedback · Høy: ${bySeverity.høy} · Medium: ${bySeverity.medium} · Lav: ${bySeverity.lav}`;
}

function renderList(entries) {
    const list = document.getElementById('feedbackInboxList');
    if (!list) return;

    if (entries.length === 0) {
        list.innerHTML = '<div class="empty">Ingen feedback funnet for valgt filter.</div>';
        return;
    }

    const sorted = [...entries].sort((left, right) => {
        return new Date(right.ts).getTime() - new Date(left.ts).getTime();
    });

    list.innerHTML = sorted.map((item) => {
        const title = `${formatTs(item.ts)} · ${item.category || '-'} · ${item.severity || '-'} · ${item.page || '-'}`;
        const tester = item.testerName ? `Tester: ${item.testerName}` : 'Tester: -';
        const message = String(item.message || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const url = String(item.url || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `
            <article class="feedback-item">
                <div class="feedback-item-title">${title}</div>
                <div class="feedback-item-meta">${tester}</div>
                <div class="feedback-item-body">${message}</div>
                <div class="feedback-item-url">${url}</div>
            </article>
        `;
    }).join('');
}

function toReport(entries) {
    if (entries.length === 0) return 'Ingen feedback registrert.';

    return entries
        .sort((left, right) => new Date(right.ts).getTime() - new Date(left.ts).getTime())
        .map((item, index) => {
            return [
                `${index + 1}) ${formatTs(item.ts)} | ${item.category || '-'} | ${item.severity || '-'} | ${item.page || '-'}`,
                `   Tester: ${item.testerName || '-'}`,
                `   Kommentar: ${item.message || '-'}`,
                `   URL: ${item.url || '-'}`
            ].join('\n');
        })
        .join('\n\n');
}

async function copyReport(entries) {
    const report = toReport(entries);
    const meta = document.getElementById('feedbackInboxMeta');
    try {
        await navigator.clipboard.writeText(report);
        if (meta) meta.textContent = `Rapport kopiert (${entries.length} punkter).`;
    } catch (_) {
        if (meta) meta.textContent = 'Klarte ikke kopiere automatisk. Bruk eksport i stedet.';
    }
}

function exportJson(entries) {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.href = url;
    link.download = `pilot-feedback-inbox-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function downloadBlob(content, type, fileName) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function escapeCsv(value) {
    const text = String(value ?? '');
    if (/[",\n;]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
}

function exportCsv(entries) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const header = ['tid', 'kategori', 'alvorlighet', 'side', 'tester', 'kommentar', 'url'];
    const lines = [header.join(';')];
    entries.forEach((item) => {
        lines.push([
            item.ts || '',
            item.category || '',
            item.severity || '',
            item.page || '',
            item.testerName || '',
            item.message || '',
            item.url || ''
        ].map(escapeCsv).join(';'));
    });
    downloadBlob(lines.join('\n'), 'text/csv;charset=utf-8', `pilot-feedback-inbox-${stamp}.csv`);
}

function exportTxtReport(entries) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const report = toReport(entries);
    downloadBlob(report, 'text/plain;charset=utf-8', `pilot-feedback-report-${stamp}.txt`);
}

function clearAllFeedback() {
    const confirmed = window.confirm('Slette all lagret feedback i denne nettleseren?');
    if (!confirmed) return false;
    localStorage.removeItem(FEEDBACK_STORE_KEY);
    return true;
}

function getFeedbackIdentity(item) {
    if (item?.id) return `id:${String(item.id)}`;
    return [
        String(item?.ts || ''),
        String(item?.page || ''),
        String(item?.message || ''),
        String(item?.testerName || ''),
        String(item?.severity || ''),
        String(item?.category || '')
    ].join('|');
}

function normalizeImportedEntry(item) {
    const message = String(item?.message || '').trim();
    if (!message) return null;
    return {
        id: String(item?.id || `fb-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`),
        ts: String(item?.ts || new Date().toISOString()),
        page: String(item?.page || '-'),
        url: String(item?.url || ''),
        category: String(item?.category || 'forbedring'),
        severity: String(item?.severity || 'medium'),
        testerName: String(item?.testerName || '').trim(),
        message,
        userAgent: String(item?.userAgent || '')
    };
}

async function importFromFile(file) {
    const meta = document.getElementById('feedbackInboxMeta');
    if (!file) return;

    try {
        const rawText = await file.text();
        const parsed = JSON.parse(rawText);
        if (!Array.isArray(parsed)) {
            if (meta) meta.textContent = 'Import feilet: JSON må være en liste med feedback-elementer.';
            return;
        }

        const current = loadFeedback();
        const identitySet = new Set(current.map((item) => getFeedbackIdentity(item)));
        const normalized = parsed
            .map((item) => normalizeImportedEntry(item))
            .filter(Boolean);

        let added = 0;
        for (const item of normalized) {
            const identity = getFeedbackIdentity(item);
            if (identitySet.has(identity)) continue;
            current.push(item);
            identitySet.add(identity);
            added += 1;
        }

        saveFeedback(current);
        render();
        if (meta) meta.textContent = `Import fullført fra ${file.name}: ${added} nye punkter lagt til.`;
    } catch (error) {
        if (meta) meta.textContent = `Import feilet: ${error?.message || 'Ukjent feil'}`;
    }
}

function render() {
    const allEntries = loadFeedback();
    const filtered = getFiltered(allEntries);
    renderMeta(filtered, allEntries);
    renderList(filtered);
    return filtered;
}

function init() {
    const rerender = () => { render(); };

    document.getElementById('feedbackCategoryFilter')?.addEventListener('change', rerender);
    document.getElementById('feedbackSeverityFilter')?.addEventListener('change', rerender);
    document.getElementById('feedbackSearchInput')?.addEventListener('input', rerender);
    document.getElementById('refreshFeedbackBtn')?.addEventListener('click', rerender);

    const importBtn = document.getElementById('importFeedbackJsonBtn');
    const importInput = document.getElementById('importFeedbackFileInput');
    if (importBtn && importInput) {
        importBtn.addEventListener('click', () => {
            importInput.value = '';
            importInput.click();
        });
        importInput.addEventListener('change', async (event) => {
            const file = event?.target?.files?.[0];
            await importFromFile(file);
            importInput.value = '';
        });
    }

    document.getElementById('copyFeedbackReportBtn')?.addEventListener('click', async () => {
        const filtered = render();
        await copyReport(filtered);
    });

    document.getElementById('exportFeedbackJsonBtn')?.addEventListener('click', () => {
        const filtered = render();
        exportJson(filtered);
    });

    document.getElementById('exportFeedbackCsvBtn')?.addEventListener('click', () => {
        const filtered = render();
        exportCsv(filtered);
    });

    document.getElementById('exportFeedbackTxtBtn')?.addEventListener('click', () => {
        const filtered = render();
        exportTxtReport(filtered);
    });

    document.getElementById('clearFeedbackBtn')?.addEventListener('click', () => {
        if (clearAllFeedback()) render();
    });

    render();
}

init();

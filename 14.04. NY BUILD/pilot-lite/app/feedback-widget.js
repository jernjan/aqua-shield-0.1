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
        // ignore quota issues
    }
}

function toReadableTs(isoValue) {
    const date = new Date(isoValue);
    if (Number.isNaN(date.getTime())) return isoValue;
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

function asClipboardText(entry) {
    return [
        `Tid: ${toReadableTs(entry.ts)}`,
        `Side: ${entry.page}`,
        `Kategori: ${entry.category}`,
        `Alvorlighet: ${entry.severity}`,
        `Tester: ${entry.testerName || '-'}`,
        `Kommentar: ${entry.message}`,
        `URL: ${entry.url}`
    ].join('\n');
}

function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .pilot-feedback-fab {
            position: fixed;
            right: 14px;
            bottom: 14px;
            z-index: 2600;
            border: 1px solid #334155;
            border-radius: 999px;
            background: #0f172a;
            color: #e2e8f0;
            font-size: 12px;
            font-weight: 700;
            padding: 8px 12px;
            cursor: pointer;
        }

        .pilot-feedback-fab:hover {
            border-color: #475569;
            background: #111827;
        }

        .pilot-feedback-overlay {
            position: fixed;
            inset: 0;
            z-index: 2690;
            background: rgba(15, 23, 42, 0.38);
            display: none;
            align-items: center;
            justify-content: center;
            padding: 14px;
        }

        .pilot-feedback-overlay.open {
            display: flex;
        }

        .pilot-feedback-card {
            width: min(660px, 96vw);
            max-height: 90vh;
            overflow: auto;
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            background: #fff;
            box-shadow: 0 10px 34px rgba(15, 23, 42, 0.25);
            padding: 12px;
            color: #0f172a;
            font-family: "Segoe UI", Arial, sans-serif;
        }

        .pilot-feedback-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            margin-bottom: 10px;
        }

        .pilot-feedback-head h2 {
            margin: 0;
            font-size: 16px;
        }

        .pilot-feedback-close {
            border: 1px solid #cbd5e1;
            background: #fff;
            border-radius: 8px;
            padding: 4px 8px;
            cursor: pointer;
        }

        .pilot-feedback-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 8px;
            margin-bottom: 8px;
        }

        .pilot-feedback-field {
            display: flex;
            flex-direction: column;
            gap: 4px;
            font-size: 12px;
        }

        .pilot-feedback-field input,
        .pilot-feedback-field select,
        .pilot-feedback-field textarea {
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 7px 8px;
            font: inherit;
        }

        .pilot-feedback-field textarea {
            min-height: 86px;
            resize: vertical;
        }

        .pilot-feedback-actions {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-top: 8px;
        }

        .pilot-feedback-actions button {
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            background: #fff;
            padding: 6px 10px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
        }

        .pilot-feedback-actions .primary {
            border-color: #1d4ed8;
            background: #2563eb;
            color: #fff;
        }

        .pilot-feedback-meta {
            margin-top: 8px;
            color: #64748b;
            font-size: 12px;
        }

        .pilot-feedback-list {
            margin-top: 10px;
            border-top: 1px solid #e2e8f0;
            padding-top: 8px;
            display: grid;
            gap: 6px;
        }

        .pilot-feedback-item {
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 6px 8px;
            background: #f8fafc;
        }

        .pilot-feedback-item-title {
            font-size: 12px;
            font-weight: 700;
            margin-bottom: 2px;
        }

        .pilot-feedback-item-text {
            font-size: 12px;
            color: #334155;
            white-space: pre-wrap;
            line-height: 1.35;
        }
    `;
    document.head.appendChild(style);
}

function downloadJson(entries) {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.href = url;
    link.download = `pilot-feedback-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function createWidget() {
    injectStyles();

    const fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'pilot-feedback-fab';
    fab.textContent = 'Gi feedback';

    const overlay = document.createElement('div');
    overlay.className = 'pilot-feedback-overlay';
    overlay.innerHTML = `
        <div class="pilot-feedback-card" role="dialog" aria-modal="true" aria-label="Testfeedback">
            <div class="pilot-feedback-head">
                <h2>Testfeedback</h2>
                <button type="button" class="pilot-feedback-close">Lukk</button>
            </div>
            <div class="pilot-feedback-grid">
                <label class="pilot-feedback-field">
                    <span>Kategori</span>
                    <select id="pilotFeedbackCategory">
                        <option value="feil">Feil</option>
                        <option value="forbedring">Forbedring</option>
                        <option value="uklarhet">Uklart i UI</option>
                        <option value="ytelse">Treghet</option>
                    </select>
                </label>
                <label class="pilot-feedback-field">
                    <span>Alvorlighet</span>
                    <select id="pilotFeedbackSeverity">
                        <option value="lav">Lav</option>
                        <option value="medium" selected>Medium</option>
                        <option value="høy">Høy</option>
                    </select>
                </label>
                <label class="pilot-feedback-field">
                    <span>Tester (valgfritt)</span>
                    <input id="pilotFeedbackTester" type="text" placeholder="Navn" />
                </label>
            </div>
            <label class="pilot-feedback-field">
                <span>Kommentar</span>
                <textarea id="pilotFeedbackMessage" placeholder="Hva gjorde du, og hva forventet du?" required></textarea>
            </label>
            <div class="pilot-feedback-actions">
                <button type="button" class="primary" id="pilotFeedbackSaveBtn">Lagre feedback</button>
                <button type="button" id="pilotFeedbackCopyBtn">Kopier siste</button>
                <button type="button" id="pilotFeedbackExportBtn">Eksporter JSON</button>
                <button type="button" id="pilotFeedbackOpenInboxBtn">Åpne Inbox</button>
            </div>
            <p class="pilot-feedback-meta" id="pilotFeedbackMeta">Lagrer lokalt i nettleseren. Bruk «Kopier siste» eller «Eksporter JSON» for å dele.</p>
            <div class="pilot-feedback-list" id="pilotFeedbackList"></div>
        </div>
    `;

    document.body.appendChild(fab);
    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector('.pilot-feedback-close');
    const categoryInput = overlay.querySelector('#pilotFeedbackCategory');
    const severityInput = overlay.querySelector('#pilotFeedbackSeverity');
    const testerInput = overlay.querySelector('#pilotFeedbackTester');
    const messageInput = overlay.querySelector('#pilotFeedbackMessage');
    const metaNode = overlay.querySelector('#pilotFeedbackMeta');
    const listNode = overlay.querySelector('#pilotFeedbackList');

    function setMeta(text) {
        metaNode.textContent = text;
    }

    function renderList() {
        const entries = loadFeedback().slice(-5).reverse();
        if (entries.length === 0) {
            listNode.innerHTML = '<div class="pilot-feedback-item"><div class="pilot-feedback-item-title">Ingen lagret feedback ennå</div></div>';
            return;
        }
        listNode.innerHTML = entries.map((item) => `
            <div class="pilot-feedback-item">
                <div class="pilot-feedback-item-title">${toReadableTs(item.ts)} · ${item.category} · ${item.severity}</div>
                <div class="pilot-feedback-item-text">${item.message}</div>
            </div>
        `).join('');
    }

    function openModal() {
        overlay.classList.add('open');
        renderList();
        setMeta('Lagrer lokalt i nettleseren. Bruk «Kopier siste» eller «Eksporter JSON» for å dele.');
        setTimeout(() => {
            messageInput.focus();
        }, 0);
    }

    function closeModal() {
        overlay.classList.remove('open');
    }

    async function copyLastEntry() {
        const entries = loadFeedback();
        const last = entries[entries.length - 1];
        if (!last) {
            setMeta('Ingen feedback å kopiere ennå.');
            return;
        }
        try {
            await navigator.clipboard.writeText(asClipboardText(last));
            setMeta('Siste feedback kopiert til utklippstavle.');
        } catch (_) {
            setMeta('Klarte ikke kopiere automatisk. Prøv eksport.');
        }
    }

    function saveEntry() {
        const message = String(messageInput.value || '').trim();
        if (!message) {
            setMeta('Skriv en kort kommentar før lagring.');
            messageInput.focus();
            return;
        }

        const entry = {
            id: `fb-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            ts: new Date().toISOString(),
            page: document.title || window.location.pathname,
            url: window.location.href,
            category: String(categoryInput.value || 'forbedring'),
            severity: String(severityInput.value || 'medium'),
            testerName: String(testerInput.value || '').trim(),
            message,
            userAgent: navigator.userAgent
        };

        const entries = loadFeedback();
        entries.push(entry);
        saveFeedback(entries);
        renderList();
        messageInput.value = '';
        setMeta(`Feedback lagret (${entries.length} totalt).`);
    }

    fab.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) closeModal();
    });

    overlay.querySelector('#pilotFeedbackSaveBtn')?.addEventListener('click', saveEntry);
    overlay.querySelector('#pilotFeedbackCopyBtn')?.addEventListener('click', () => {
        copyLastEntry();
    });
    overlay.querySelector('#pilotFeedbackExportBtn')?.addEventListener('click', () => {
        const entries = loadFeedback();
        if (entries.length === 0) {
            setMeta('Ingen feedback å eksportere ennå.');
            return;
        }
        downloadJson(entries);
        setMeta(`Eksportert ${entries.length} feedback-punkt til fil.`);
    });
    overlay.querySelector('#pilotFeedbackOpenInboxBtn')?.addEventListener('click', () => {
        window.location.href = './feedback-inbox.html';
    });
}

createWidget();

// ========== STATE ==========
let allCandidates = [];
let editingOriginalName = null;

// ========== TOAST ==========
function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ========== MODALS ==========
function openModal(id) {
    document.getElementById(id).classList.add('active');
}
function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}
// Close on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.classList.remove('active');
    });
});

// Password modal — returns a Promise that resolves with password or null
function askPassword(title = 'Підтвердження', desc = 'Введіть пароль адміністратора') {
    return new Promise(resolve => {
        document.getElementById('modal-password-title').textContent = title;
        document.getElementById('modal-password-desc').textContent = desc;
        const input = document.getElementById('modal-password-input');
        input.value = '';
        openModal('modal-password');
        setTimeout(() => input.focus(), 200);

        const confirmBtn = document.getElementById('modal-password-confirm');
        const newBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newBtn, confirmBtn);

        const doConfirm = () => {
            const val = document.getElementById('modal-password-input').value;
            closeModal('modal-password');
            resolve(val || null);
        };
        newBtn.addEventListener('click', doConfirm);
        document.getElementById('modal-password-input').onkeydown = e => {
            if (e.key === 'Enter') doConfirm();
        };
        // Cancel -> resolve null
        const cancelBtn = document.querySelector('#modal-password .modal-btn-cancel');
        const newCancel = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
        newCancel.onclick = () => { closeModal('modal-password'); resolve(null); };
    });
}

// ========== VALIDATION ==========
const UA_ONLY = /^[А-ЯҐЄІЇа-яґєії\s'\-]+$/;
const DATE_REGEX = /^(\d{2})\.(\d{2})\.(\d{4})$/;

function validateName(v) {
    if (!v.trim()) return "Поле обов'язкове";
    if (/\d/.test(v)) return 'ПІБ не повинно містити цифри';
    if (!UA_ONLY.test(v)) return 'Лише українські літери';
    if (v.trim().split(/\s+/).length < 2) return 'Введіть прізвище та ім\'я';
    return null;
}
function validateDate(v) {
    if (!v.trim()) return "Поле обов'язкове";
    if (!DATE_REGEX.test(v)) return 'Формат: ДД.ММ.РРРР';
    const [, d, m, y] = v.match(DATE_REGEX);
    const day = +d, month = +m, year = +y;
    if (month < 1 || month > 12) return 'Місяць: 01–12';
    if (day < 1 || day > 31) return 'День: 01–31';
    const date = new Date(year, month - 1, day);
    if (date.getDate() !== day || date.getMonth() + 1 !== month) return 'Неіснуюча дата';
    const curYear = new Date().getFullYear();
    if (year < 1900 || year > curYear - 18) return `Рік: 1900–${curYear - 18}`;
    return null;
}
function validatePlace(v) {
    if (!v.trim()) return "Поле обов'язкове";
    if (/\d/.test(v)) return 'Не повинно містити цифри';
    if (!UA_ONLY.test(v)) return 'Лише українські літери';
    return null;
}

function setError(fieldId, msg) {
    const input = document.getElementById(fieldId);
    const errEl = document.getElementById(fieldId + '-error');
    if (!input || !errEl) return;
    if (msg) { input.classList.add('error'); errEl.textContent = msg; }
    else { input.classList.remove('error'); errEl.textContent = ''; }
}

function capitalizeUkr(str) {
    return str.replace(/(?:^|[\s\-])([а-яґєіїa-z])/g, m => m.toUpperCase());
}

function blockNonUkr(input) {
    input.addEventListener('keypress', e => {
        if (e.key.length === 1 && !/[А-ЯҐЄІЇа-яґєії\s'\-]/.test(e.key)) e.preventDefault();
    });
    input.addEventListener('paste', e => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text');
        document.execCommand('insertText', false, text.replace(/[^А-ЯҐЄІЇа-яґєії\s'\-]/g, ''));
    });
}

function formatDateInput(input) {
    input.addEventListener('input', function () {
        let val = this.value.replace(/[^\d]/g, '');
        if (val.length > 2) val = val.slice(0, 2) + '.' + val.slice(2);
        if (val.length > 5) val = val.slice(0, 5) + '.' + val.slice(5);
        if (val.length > 10) val = val.slice(0, 10);
        this.value = val;
    });
}

// ========== FETCH & RENDER ==========
async function fetchCandidates() {
    const grid = document.getElementById('candidates-grid');
    try {
        const res = await fetch('/api/candidates');
        allCandidates = await res.json();

        const statCount = document.getElementById('stat-count');
        if (statCount) animateNumber(statCount, allCandidates.length);

        renderCandidates();
        renderChart();
        renderVotingList();
    } catch (e) {
        grid.innerHTML = `<div class="empty-state"><div class="big-icon">⚠️</div><p>Помилка підключення до сервера</p></div>`;
    }
}

function renderCandidates() {
    const grid = document.getElementById('candidates-grid');
    grid.innerHTML = '';
    if (allCandidates.length === 0) {
        grid.innerHTML = `<div class="empty-state"><div class="big-icon">🗳️</div><p>Поки немає зареєстрованих кандидатів</p></div>`;
        return;
    }
    allCandidates.forEach((c, i) => {
        const card = document.createElement('div');
        card.className = 'candidate-card';
        card.style.animationDelay = (i * 0.07) + 's';
        const badge = getBadgeInfo(c.popularityIndex);
        card.innerHTML = `
            <div class="card-avatar">${getInitials(c.name)}</div>
            <div class="card-name">${escapeHtml(c.name)}</div>
            <div class="card-meta">
                <div class="card-meta-item"><span>📅</span> ${escapeHtml(c.birthDate)}</div>
                <div class="card-meta-item"><span>📍</span> ${escapeHtml(c.birthPlace)}</div>
            </div>
            <div class="card-badge ${badge.cls}"><span>${badge.icon}</span> ${badge.label} (${c.popularityIndex})</div>
            <div class="card-actions">
                <button class="btn-edit">✏️ Редагувати</button>
                <button class="btn-delete">🗑️ Видалити</button>
            </div>`;
        card.querySelector('.btn-delete').onclick = () => deleteCandidate(c.name);
        card.querySelector('.btn-edit').onclick = () => openEditModal(c);
        grid.appendChild(card);
    });
}

// ========== CHART (pure Canvas, no lib) ==========
function renderChart() {
    const canvas = document.getElementById('myChart');
    const legendEl = document.getElementById('chart-legend');
    if (!canvas) return;

    const categories = [
        { label: 'Підтриманий президентом', idx: 70, color: '#38a169', icon: '⭐' },
        { label: 'Підтриманий опозицією',   idx: 15, color: '#4299e1', icon: '🔵' },
        { label: 'Знімає кандидатуру',       idx: 10, color: '#ed8936', icon: '🔶' },
        { label: 'Інші',                      idx: 5,  color: '#a0aec0', icon: '⚪' },
    ];

    const counts = categories.map(cat => allCandidates.filter(c => c.popularityIndex === cat.idx).length);
    const total = counts.reduce((a, b) => a + b, 0);

    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    if (total === 0) {
        ctx.fillStyle = '#aaa';
        ctx.font = '14px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Немає даних', W / 2, H / 2);
        legendEl.innerHTML = '';
        return;
    }

    const cx = W / 2, cy = H / 2, r = Math.min(W, H) / 2 - 20;
    let startAngle = -Math.PI / 2;

    counts.forEach((count, i) => {
        if (count === 0) return;
        const slice = (count / total) * 2 * Math.PI;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, startAngle, startAngle + slice);
        ctx.closePath();
        ctx.fillStyle = categories[i].color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Label inside slice
        if (count > 0) {
            const midAngle = startAngle + slice / 2;
            const lx = cx + Math.cos(midAngle) * r * 0.65;
            const ly = cy + Math.sin(midAngle) * r * 0.65;
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 16px Playfair Display, serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(count, lx, ly);
        }
        startAngle += slice;
    });

    // Center hole (donut)
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.45, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.fillStyle = '#0a1628';
    ctx.font = 'bold 22px Playfair Display, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(total, cx, cy - 8);
    ctx.font = '11px Montserrat, sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.fillText('всього', cx, cy + 14);

    // Legend
    legendEl.innerHTML = categories.map((cat, i) => {
        const pct = total > 0 ? Math.round(counts[i] / total * 100) : 0;
        return `
        <div class="legend-item">
            <div class="legend-dot" style="background:${cat.color}"></div>
            <div style="flex:1">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <span class="legend-label">${cat.icon} ${cat.label}</span>
                    <span class="legend-count">${counts[i]}</span>
                </div>
                <div class="legend-bar-wrap">
                    <div class="legend-bar" style="width:${pct}%;background:${cat.color}"></div>
                </div>
            </div>
        </div>`;
    }).join('');
}

// ========== VOTING LIST ==========
function renderVotingList() {
    const listEl = document.getElementById('voting-list');
    if (!listEl) return;

    // Sort descending by popularityIndex (queue by priority)
    const sorted = [...allCandidates].sort((a, b) => b.popularityIndex - a.popularityIndex);

    if (sorted.length === 0) {
        listEl.innerHTML = `<div style="padding:40px;text-align:center;color:#999">Немає кандидатів для відображення</div>`;
        return;
    }

    listEl.innerHTML = sorted.map((c, i) => {
        const rank = i + 1;
        const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-other';
        const badge = getBadgeInfo(c.popularityIndex);
        return `
        <div class="voting-row" data-name="${escapeHtml(c.name)}" onclick="selectVotingRow(this.dataset.name)">
            <div class="voting-rank ${rankClass}">${rank}</div>
            <div style="flex:1">
                <div class="voting-name">${escapeHtml(c.name)}</div>
                <div class="voting-meta">📅 ${escapeHtml(c.birthDate)} &nbsp;·&nbsp; 📍 ${escapeHtml(c.birthPlace)}</div>
            </div>
            <div class="card-badge ${badge.cls}" style="margin:0">${badge.icon} ${c.popularityIndex}</div>
            <div class="voting-checkbox"></div>
        </div>`;
    }).join('');

    if (selectedCandidate) {
        document.querySelectorAll('.voting-row').forEach(row => {
            if (row.dataset.name === selectedCandidate) row.classList.add('selected');
        });
    }
}

function printVotingList() {
    window.print();
}

// ========== VOTING LOGIC ==========
let selectedCandidate = null;
let votes = {}; // { name: count }
let hasVoted = false;

function renderVotingCheckboxes(sorted) {
    // Re-render selecting state
    sorted.forEach(c => {
        const rows = document.querySelectorAll('.voting-row');
        rows.forEach(row => {
            if (row.dataset.name === c.name) {
                if (selectedCandidate && selectedCandidate === c.name) {
                    row.classList.add('selected');
                } else {
                    row.classList.remove('selected');
                }
            }
        });
    });
}

function selectVotingRow(name) {
    if (hasVoted) return;
    selectedCandidate = name;
    document.querySelectorAll('.voting-row').forEach(row => {
        row.classList.toggle('selected', row.dataset.name === name);
    });
    const btn = document.getElementById('btn-vote');
    const btnText = document.getElementById('btn-vote-text');
    if (btn) {
        btn.disabled = false;
        if (btnText) btnText.textContent = '🗳️ Проголосувати';
    }
}

function openVoteConfirm() {
    if (!selectedCandidate || hasVoted) return;
    document.getElementById('vote-candidate-name').textContent = selectedCandidate;
    openModal('modal-vote');
}

function confirmVote() {
    if (!selectedCandidate || hasVoted) return;
    closeModal('modal-vote');

    // Save vote
    votes[selectedCandidate] = (votes[selectedCandidate] || 0) + 1;
    hasVoted = true;

    // Hide vote button, show voted badge
    const voteAction = document.getElementById('vote-action');
    if (voteAction) {
        voteAction.innerHTML = '<div class="voted-badge">✅ Ваш голос прийнято! Дякуємо за участь у виборах.</div>';
    }

    // Disable all rows
    document.querySelectorAll('.voting-row').forEach(row => {
        row.style.cursor = 'default';
    });

    // Show results
    showVoteResults();
    showToast('Ваш голос успішно подано! 🎉', 'success');
}

function showVoteResults() {
    const resultsEl = document.getElementById('vote-results');
    const barsEl = document.getElementById('results-bars');
    if (!resultsEl || !barsEl) return;

    resultsEl.style.display = 'block';

    const sorted = [...allCandidates].sort((a, b) => b.popularityIndex - a.popularityIndex);
    const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
    const maxVotes = Math.max(...sorted.map(c => votes[c.name] || 0), 1);
    const winner = sorted.reduce((a, b) => (votes[b.name] || 0) > (votes[a.name] || 0) ? b : a, sorted[0]);

    barsEl.innerHTML = sorted.map(c => {
        const count = votes[c.name] || 0;
        const pct = totalVotes > 0 ? Math.round(count / totalVotes * 100) : 0;
        const barWidth = maxVotes > 0 ? Math.round(count / maxVotes * 100) : 0;
        const isWinner = winner && c.name === winner.name && count > 0;
        return `
        <div class="result-row">
            <div class="result-name">${escapeHtml(c.name.split(' ')[0])}</div>
            <div class="result-bar-wrap">
                <div class="result-bar ${isWinner ? 'winner' : ''}" style="width:0%" data-width="${barWidth}%"></div>
            </div>
            <div class="result-votes">${count} голос${count === 1 ? '' : count < 5 ? 'и' : 'ів'} (${pct}%)</div>
        </div>`;
    }).join('');

    // Animate bars
    setTimeout(() => {
        barsEl.querySelectorAll('.result-bar').forEach(bar => {
            bar.style.width = bar.dataset.width;
        });
    }, 50);
}

// ========== DELETE ==========
async function deleteCandidate(name) {
    const password = await askPassword('Видалення кандидата', `Видалити "${name}"? Введіть пароль:`);
    if (!password) return;
    try {
        const res = await fetch(
            `/api/candidates/${encodeURIComponent(name)}?password=${encodeURIComponent(password)}`,
            { method: 'DELETE' }
        );
        if (res.ok) {
            showToast('Кандидата видалено', 'success');
            fetchCandidates();
        } else {
            showToast('Невірний пароль', 'error');
        }
    } catch {
        showToast('Помилка підключення', 'error');
    }
}

// ========== EDIT ==========
function openEditModal(candidate) {
    editingOriginalName = candidate.name;
    document.getElementById('edit-name').value = candidate.name;
    document.getElementById('edit-birthDate').value = candidate.birthDate;
    document.getElementById('edit-birthPlace').value = candidate.birthPlace;
    document.getElementById('edit-popularityIndex').value = candidate.popularityIndex;
    document.getElementById('edit-password').value = '';
    ['edit-name','edit-birthDate','edit-birthPlace','edit-password'].forEach(id => setError(id,''));
    openModal('modal-edit');

    // Setup validation listeners inside modal
    const nameIn = document.getElementById('edit-name');
    const dateIn = document.getElementById('edit-birthDate');
    const placeIn = document.getElementById('edit-birthPlace');
    blockNonUkr(nameIn);
    blockNonUkr(placeIn);
    formatDateInput(dateIn);
    nameIn.onblur = () => { nameIn.value = capitalizeUkr(nameIn.value); setError('edit-name', validateName(nameIn.value)); };
    placeIn.onblur = () => { placeIn.value = capitalizeUkr(placeIn.value); setError('edit-birthPlace', validatePlace(placeIn.value)); };
    dateIn.onblur = () => setError('edit-birthDate', validateDate(dateIn.value));
}

async function submitEdit() {
    const nameVal  = capitalizeUkr(document.getElementById('edit-name').value.trim());
    const dateVal  = document.getElementById('edit-birthDate').value.trim();
    const placeVal = capitalizeUkr(document.getElementById('edit-birthPlace').value.trim());
    const idx      = parseInt(document.getElementById('edit-popularityIndex').value);
    const password = document.getElementById('edit-password').value;

    const nameErr  = validateName(nameVal);
    const dateErr  = validateDate(dateVal);
    const placeErr = validatePlace(placeVal);
    const passErr  = password ? null : 'Введіть пароль';

    setError('edit-name', nameErr);
    setError('edit-birthDate', dateErr);
    setError('edit-birthPlace', placeErr);
    setError('edit-password', passErr);

    if (nameErr || dateErr || placeErr || passErr) return;

    try {
        // Delete old record, then add new
        const delRes = await fetch(
            `/api/candidates/${encodeURIComponent(editingOriginalName)}?password=${encodeURIComponent(password)}`,
            { method: 'DELETE' }
        );
        if (!delRes.ok) { showToast('Невірний пароль', 'error'); return; }

        const addRes = await fetch(
            `/api/candidates?password=${encodeURIComponent(password)}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: nameVal, birthDate: dateVal, birthPlace: placeVal, popularityIndex: idx })
            }
        );
        if (addRes.ok) {
            closeModal('modal-edit');
            showToast('Дані кандидата оновлено!', 'success');
            fetchCandidates();
        } else {
            showToast('Помилка збереження', 'error');
        }
    } catch {
        showToast('Помилка підключення', 'error');
    }
}

// ========== ADD FORM ==========
document.addEventListener('DOMContentLoaded', function () {
    fetchCandidates();

    const nameInput  = document.getElementById('name');
    const dateInput  = document.getElementById('birthDate');
    const placeInput = document.getElementById('birthPlace');

    if (nameInput)  { blockNonUkr(nameInput);  nameInput.addEventListener('blur', () => { nameInput.value = capitalizeUkr(nameInput.value); setError('name', validateName(nameInput.value)); }); }
    if (placeInput) { blockNonUkr(placeInput); placeInput.addEventListener('blur', () => { placeInput.value = capitalizeUkr(placeInput.value); setError('birthPlace', validatePlace(placeInput.value)); }); }
    if (dateInput)  { formatDateInput(dateInput); dateInput.addEventListener('blur', () => setError('birthDate', validateDate(dateInput.value))); }

    const form = document.getElementById('candidateForm');
    if (!form) return;

    form.onsubmit = async function (e) {
        e.preventDefault();
        const nameVal  = capitalizeUkr(nameInput.value.trim());
        const dateVal  = dateInput.value.trim();
        const placeVal = capitalizeUkr(placeInput.value.trim());
        const idx      = parseInt(document.getElementById('popularityIndex').value);
        const password = document.getElementById('password').value;

        const nameErr  = validateName(nameVal);
        const dateErr  = validateDate(dateVal);
        const placeErr = validatePlace(placeVal);
        const passErr  = password ? null : 'Введіть пароль';

        setError('name', nameErr);
        setError('birthDate', dateErr);
        setError('birthPlace', placeErr);
        setError('password', passErr);

        if (nameErr || dateErr || placeErr || passErr) return;

        const msgEl = document.getElementById('form-msg');
        msgEl.className = 'form-msg';

        try {
            const res = await fetch(
                `/api/candidates?password=${encodeURIComponent(password)}`,
                { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({name:nameVal,birthDate:dateVal,birthPlace:placeVal,popularityIndex:idx}) }
            );
            if (res.ok) {
                msgEl.textContent = '✅ Кандидата успішно додано до реєстру!';
                msgEl.className = 'form-msg success';
                showToast('Кандидата додано!', 'success');
                form.reset();
                fetchCandidates();
                setTimeout(() => scrollToList(), 800);
                setTimeout(() => { msgEl.className = 'form-msg'; msgEl.textContent = ''; }, 4000);
            } else {
                msgEl.textContent = '❌ Невірний пароль або помилка сервера';
                msgEl.className = 'form-msg error-msg';
                setError('password', 'Перевірте пароль');
                showToast('Невірний пароль', 'error');
                setTimeout(() => { msgEl.className = 'form-msg'; msgEl.textContent = ''; }, 4000);
            }
        } catch {
            msgEl.textContent = '❌ Не вдалося підключитися до сервера';
            msgEl.className = 'form-msg error-msg';
        }
    };
});

// ========== HELPERS ==========
function getInitials(name) {
    return name.trim().split(/\s+/).slice(0,2).map(p => p[0] || '').join('').toUpperCase() || '?';
}
function getBadgeInfo(idx) {
    if (idx >= 70) return { cls:'idx-70', icon:'⭐', label:'Підтриманий президентом' };
    if (idx >= 15) return { cls:'idx-15', icon:'🔵', label:'Підтриманий опозицією' };
    if (idx >= 10) return { cls:'idx-10', icon:'🔶', label:'Знімає кандидатуру' };
    return { cls:'idx-5', icon:'⚪', label:'Інший кандидат' };
}
function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function animateNumber(el, target) {
    let start = 0;
    const step = Math.max(1, Math.ceil(target / 20));
    const timer = setInterval(() => {
        start = Math.min(start + step, target);
        el.textContent = start;
        if (start >= target) clearInterval(timer);
    }, 40);
}
function scrollToList()   { document.getElementById('list-section').scrollIntoView({ behavior:'smooth' }); }
function scrollToForm()   { document.getElementById('form-section').scrollIntoView({ behavior:'smooth' }); }
function scrollToVoting() { document.getElementById('voting-section').scrollIntoView({ behavior:'smooth' }); }

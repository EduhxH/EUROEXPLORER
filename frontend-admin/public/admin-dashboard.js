const API_BASE = 'http://localhost:8000';

const state = {
    user: getStoredUser(),
    commits: [],
    filtered: []
};

const els = {
    total: document.getElementById('stat-total'),
    approved: document.getElementById('stat-approved'),
    pending: document.getElementById('stat-pending'),
    rejected: document.getElementById('stat-rejected'),
    deltaTotal: document.getElementById('delta-total'),
    deltaApproved: document.getElementById('delta-approved'),
    deltaPending: document.getElementById('delta-pending'),
    chart: document.getElementById('activity-chart'),
    notifications: document.getElementById('notification-list'),
    team: document.getElementById('team-list'),
    panel: document.getElementById('notifications-panel'),
    panelBackdrop: document.getElementById('panel-backdrop'),
    panelList: document.getElementById('panel-list'),
    panelSummary: document.getElementById('panel-summary'),
    progressCard: document.querySelector('.progress-card'),
    progressMeter: document.getElementById('progress-meter'),
    progressValue: document.getElementById('progress-value'),
    reminderTitle: document.getElementById('reminder-title'),
    reminderTime: document.getElementById('reminder-time'),
    navBadge: document.getElementById('dash-nav-badge'),
    tracker: document.getElementById('tracker-time'),
    search: document.getElementById('dash-search-input'),
    profileName: document.getElementById('dash-profile-name'),
    profileEmail: document.getElementById('dash-profile-email'),
    profileAvatar: document.getElementById('dash-profile-avatar')
};

document.addEventListener('DOMContentLoaded', () => {
    init();
});

async function init() {
    localStorage.removeItem('admin_token');
    state.user = await hydrateSession();

    if (!state.user) {
        sessionStorage.setItem('admin_open_login', '1');
        window.location.replace('index.html');
        return;
    }

    if (state.user.role !== 'SUPER_ADMIN') {
        renderAccessDenied();
        return;
    }

    bindEvents();
    renderProfile();
    tickTracker();
    setInterval(tickTracker, 1000);
    fetchCommits();
    animateDashboard();

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function renderAccessDenied() {
    document.body.innerHTML = `
        <main class="admin-access-denied" role="alert">
            <a class="admin-access-back" href="index.html">Voltar para website</a>
            <section>
                <div class="admin-access-icon">!</div>
                <h1>VOCE NAO TEM ACESSO A ESTA PAGINA. APENAS SUPER ADMINS PODEM VER A DASHBOARD.</h1>
            </section>
        </main>
    `;
}

function getStoredUser() {
    try {
        return JSON.parse(localStorage.getItem('admin_user') || 'null');
    } catch {
        return null;
    }
}

async function hydrateSession() {
    try {
        const response = await fetch(`${API_BASE}/api/admin/me`, { credentials: 'include' });
        if (!response.ok) throw new Error('session');
        const user = await response.json();
        localStorage.setItem('admin_user', JSON.stringify(user));
        return user;
    } catch {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        return null;
    }
}

function bindEvents() {
    document.getElementById('dash-refresh')?.addEventListener('click', fetchCommits);
    document.getElementById('dash-sidebar-refresh')?.addEventListener('click', fetchCommits);
    document.getElementById('dash-open-panel')?.addEventListener('click', openNotificationsPanel);
    document.getElementById('dash-open-notifications')?.addEventListener('click', openNotificationsPanel);
    document.getElementById('dash-bell')?.addEventListener('click', openNotificationsPanel);
    document.getElementById('notifications-new')?.addEventListener('click', openNotificationsPanel);
    document.getElementById('reminder-action')?.addEventListener('click', openNotificationsPanel);
    document.getElementById('close-notifications')?.addEventListener('click', closeNotificationsPanel);
    els.panelBackdrop?.addEventListener('click', closeNotificationsPanel);
    document.getElementById('dash-logout')?.addEventListener('click', () => {
        fetch(`${API_BASE}/api/auth/logout`, { credentials: 'include', method: 'POST' }).catch(() => undefined);
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        sessionStorage.setItem('admin_open_login', '1');
        window.location.assign('index.html');
    });

    els.search?.addEventListener('input', () => {
        applySearch();
        renderDashboard();
    });

    document.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
            event.preventDefault();
            els.search?.focus();
        }

        if (event.key === 'Escape') {
            closeNotificationsPanel();
        }
    });
}

function renderProfile() {
    const username = state.user?.username || 'Admin';
    els.profileName.textContent = username;
    els.profileEmail.textContent = state.user?.role || 'SUPER_ADMIN';
    els.profileAvatar.textContent = initials(username);
}

async function fetchCommits() {
    setLoading(true);

    try {
        const response = await fetch(`${API_BASE}/api/commits`, {
            credentials: 'include'
        });

        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('admin_token');
            localStorage.removeItem('admin_user');
            sessionStorage.setItem('admin_open_login', '1');
            window.location.replace('index.html');
            return;
        }

        if (!response.ok) {
            throw new Error('Nao foi possivel carregar as alteracoes.');
        }

        const data = await response.json();
        state.commits = Array.isArray(data) ? data.map(normalizeCommit) : [];
        applySearch();
        renderDashboard();
    } catch (error) {
        renderError(error instanceof Error ? error.message : 'Erro inesperado.');
    } finally {
        setLoading(false);
    }
}

function normalizeCommit(commit) {
    return {
        ...commit,
        author_name: commit.author_name || 'Utilizador',
        message: commit.message || `Alteracao em ${commit.country_id || 'pais'}`,
        status: commit.status || 'PENDING',
        created_at: commit.created_at || new Date().toISOString()
    };
}

function applySearch() {
    const query = (els.search?.value || '').trim().toLowerCase();
    state.filtered = query
        ? state.commits.filter((commit) => {
            return [
                commit.author_name,
                commit.country_id,
                commit.message,
                commit.status,
                commit.rejection_note
            ].some((value) => String(value || '').toLowerCase().includes(query));
        })
        : [...state.commits];
}

function renderDashboard() {
    const commits = state.filtered;
    const stats = getStats(commits);

    els.total.textContent = stats.total;
    els.approved.textContent = stats.approved;
    els.pending.textContent = stats.pending;
    els.rejected.textContent = stats.rejected;
    els.deltaTotal.textContent = stats.total;
    els.deltaApproved.textContent = stats.approved;
    els.deltaPending.textContent = stats.pending;
    els.navBadge.textContent = stats.pending;

    renderChart(commits);
    renderNotifications(commits);
    renderTeam(commits);
    renderProgress(stats);
    renderReminder(commits);

    if (window.lucide) {
        window.lucide.createIcons();
    }

    animateCards();
    animateBars();
}

function getStats(commits) {
    return {
        total: commits.length,
        approved: commits.filter((commit) => commit.status === 'APPROVED').length,
        pending: commits.filter((commit) => commit.status === 'PENDING').length,
        rejected: commits.filter((commit) => commit.status === 'REJECTED').length
    };
}

function renderChart(commits) {
    const days = buildLastSevenDays();
    const counts = days.map((day) => {
        return commits.filter((commit) => toDateKey(commit.created_at) === day.key).length;
    });
    const max = Math.max(...counts, 1);
    const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    els.chart.innerHTML = days.map((day, index) => {
        const height = 56 + Math.round((counts[index] / max) * 92);
        const tone = index === 1 ? 'filled' : index === 2 ? 'light' : index === 3 ? 'dark' : '';
        return `
            <div class="chart-day" title="${counts[index]} alteracoes">
                <div class="chart-bar ${tone}" style="--bar-height:${height}px"></div>
                <span>${labels[day.date.getDay()]}</span>
            </div>
        `;
    }).join('');
}

function renderNotifications(commits) {
    const latest = [...commits]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 6);

    if (!latest.length) {
        els.notifications.innerHTML = '<p class="empty-state">Sem notificacoes para mostrar.</p>';
        els.panelList.innerHTML = '<p class="empty-state">Sem alteracoes registadas.</p>';
        els.panelSummary.textContent = '0 alteracoes encontradas';
        return;
    }

    els.notifications.innerHTML = latest.map((commit, index) => {
        return `
            <button class="notification-row" type="button" data-open-panel>
                <span class="notification-icon" style="background:${iconColor(index)}">${initials(commit.author_name)}</span>
                <span>
                    <strong>${escapeHtml(commit.author_name)} fez uma alteracao!</strong>
                    <span>${escapeHtml(commit.message)} - ${formatDate(commit.created_at)}</span>
                </span>
            </button>
        `;
    }).join('');

    document.querySelectorAll('[data-open-panel]').forEach((button) => {
        button.addEventListener('click', openNotificationsPanel);
    });

    els.panelSummary.textContent = `${commits.length} alteracoes encontradas`;
    els.panelList.innerHTML = latest.concat(commits.slice(6)).map((commit) => {
        const canReview = commit.status === 'PENDING';
        return `
            <article class="panel-item">
                <strong>${escapeHtml(commit.author_name)} fez uma alteracao!</strong>
                <span>${escapeHtml(commit.country_id || 'Pais')} - ${escapeHtml(commit.message)}</span>
                <small>${statusLabel(commit.status)} - ${formatDate(commit.created_at)}</small>
                ${canReview ? `
                    <div class="panel-actions">
                        <button type="button" data-approve="${commit._id}">Aprovar</button>
                        <button type="button" data-reject="${commit._id}">Rejeitar</button>
                    </div>
                ` : ''}
            </article>
        `;
    }).join('');

    els.panelList.querySelectorAll('[data-approve]').forEach((button) => {
        button.addEventListener('click', () => reviewCommit(button.dataset.approve, 'approve'));
    });
    els.panelList.querySelectorAll('[data-reject]').forEach((button) => {
        button.addEventListener('click', () => reviewCommit(button.dataset.reject, 'reject'));
    });
}

function renderTeam(commits) {
    const grouped = new Map();

    commits.forEach((commit) => {
        const name = commit.author_name || 'Utilizador';
        const current = grouped.get(name) || {
            name,
            total: 0,
            pending: 0,
            latest: commit
        };

        current.total += 1;
        current.pending += commit.status === 'PENDING' ? 1 : 0;
        if (new Date(commit.created_at) > new Date(current.latest.created_at)) {
            current.latest = commit;
        }
        grouped.set(name, current);
    });

    const rows = Array.from(grouped.values()).slice(0, 5);

    if (!rows.length) {
        els.team.innerHTML = '<p class="empty-state">Sem atividade de equipa.</p>';
        return;
    }

    els.team.innerHTML = rows.map((member) => {
        const status = member.pending ? 'pending' : statusClass(member.latest.status);
        const label = member.pending ? 'Pendente' : statusLabel(member.latest.status);
        return `
            <div class="team-row">
                <span class="team-avatar">${initials(member.name)}</span>
                <span>
                    <strong>${escapeHtml(member.name)}</strong>
                    <span>${member.total} alteracoes - ${escapeHtml(member.latest.message)}</span>
                </span>
                <em class="team-status ${status}">${label}</em>
            </div>
        `;
    }).join('');
}

function renderProgress(stats) {
    const approvedPercent = stats.total ? Math.round((stats.approved / stats.total) * 100) : 0;
    const angle = Math.round((approvedPercent / 100) * 360);

    els.progressValue.textContent = `${approvedPercent}%`;
    els.progressCard.dataset.progressLabel = `${approvedPercent}%`;
    els.progressMeter.style.setProperty('--progress-angle', `${angle}deg`);
}

function renderReminder(commits) {
    const pending = commits.find((commit) => commit.status === 'PENDING');
    if (!pending) {
        els.reminderTitle.textContent = 'Sem revisoes urgentes';
        els.reminderTime.textContent = 'Todas as alteracoes filtradas estao tratadas.';
        return;
    }

    els.reminderTitle.textContent = `Rever ${pending.country_id || 'alteracao'}`;
    els.reminderTime.textContent = `${pending.author_name} - ${formatDate(pending.created_at)}`;
}

async function reviewCommit(id, action) {
    if (!id) return;

    let body;
    const headers = {};

    if (action === 'reject') {
        const note = window.prompt('Justificacao para rejeitar esta alteracao:');
        if (!note?.trim()) return;
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify({ note: note.trim() });
    }

    try {
        const response = await fetch(`${API_BASE}/api/commits/${id}/${action}`, {
            method: 'POST',
            credentials: 'include',
            headers,
            body
        });

        if (!response.ok) {
            throw new Error('A operacao falhou.');
        }

        await fetchCommits();
    } catch (error) {
        renderError(error instanceof Error ? error.message : 'Erro ao rever alteracao.');
    }
}

function renderError(message) {
    els.notifications.innerHTML = `<p class="dash-error">${escapeHtml(message)}</p>`;
    els.panelList.innerHTML = `<p class="dash-error">${escapeHtml(message)}</p>`;
    els.panelSummary.textContent = 'Erro ao carregar alteracoes';
}

function setLoading(isLoading) {
    document.querySelectorAll('#dash-refresh, #dash-sidebar-refresh').forEach((button) => {
        button.disabled = isLoading;
    });
}

function openNotificationsPanel() {
    els.panel.classList.add('active');
    els.panel.setAttribute('aria-hidden', 'false');
    els.panelBackdrop.classList.add('active');

    if (window.anime) {
        window.anime.remove(els.panel);
        window.anime({
            targets: els.panel,
            translateX: ['100%', '0%'],
            opacity: [0, 1],
            duration: 450,
            easing: 'easeOutCubic'
        });
    } else {
        els.panel.style.opacity = 1;
        els.panel.style.transform = 'translateX(0)';
    }
}

function closeNotificationsPanel() {
    if (!els.panel.classList.contains('active')) return;

    if (window.anime) {
        window.anime.remove(els.panel);
        window.anime({
            targets: els.panel,
            translateX: ['0%', '100%'],
            opacity: [1, 0],
            duration: 320,
            easing: 'easeInCubic',
            complete: () => {
                els.panel.classList.remove('active');
                els.panel.setAttribute('aria-hidden', 'true');
                els.panelBackdrop.classList.remove('active');
            }
        });
    } else {
        els.panel.classList.remove('active');
        els.panel.setAttribute('aria-hidden', 'true');
        els.panelBackdrop.classList.remove('active');
    }
}

function animateDashboard() {
    if (!window.anime) return;

    window.anime.set('.dash-sidebar, .dash-topbar, .dash-heading, .dash-stats, .dash-grid', {
        opacity: 0,
        translateY: 28
    });

    window.anime({
        targets: '.dash-sidebar, .dash-topbar, .dash-heading, .dash-stats, .dash-grid',
        opacity: [0, 1],
        translateY: [28, 0],
        delay: window.anime.stagger(95),
        duration: 720,
        easing: 'easeOutExpo'
    });
}

function animateCards() {
    if (!window.anime) return;

    window.anime.remove('.stat-card');
    window.anime({
        targets: '.stat-card',
        opacity: [0, 1],
        translateY: [30, 0],
        delay: window.anime.stagger(120),
        duration: 700,
        easing: 'easeOutExpo'
    });
}

function animateBars() {
    if (!window.anime) return;

    document.querySelectorAll('.chart-bar').forEach((bar) => {
        const height = getComputedStyle(bar).getPropertyValue('--bar-height') || '80px';
        window.anime.set(bar, { height: 0 });
        window.anime({
            targets: bar,
            height,
            duration: 850,
            delay: window.anime.random(40, 180),
            easing: 'easeOutCubic'
        });
    });
}

function tickTracker() {
    const started = Number(sessionStorage.getItem('admin_tracker_start') || Date.now());
    sessionStorage.setItem('admin_tracker_start', String(started));
    const elapsed = Math.floor((Date.now() - started) / 1000);
    const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
    const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    els.tracker.textContent = `${h}:${m}:${s}`;

    if (window.anime && !els.tracker.dataset.pulsing) {
        els.tracker.dataset.pulsing = 'true';
        window.anime({
            targets: '.tracker-time',
            scale: [1, 1.035],
            opacity: [0.82, 1],
            duration: 1300,
            direction: 'alternate',
            loop: true,
            easing: 'easeInOutSine'
        });
    }
}

function buildLastSevenDays() {
    return Array.from({ length: 7 }, (_, index) => {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() - (6 - index));
        return { date, key: toDateKey(date) };
    });
}

function toDateKey(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
}

function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Data indisponivel';

    return new Intl.DateTimeFormat('pt-PT', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

function initials(name) {
    return String(name || 'EU')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase();
}

function statusLabel(status) {
    return {
        PENDING: 'Pendente',
        APPROVED: 'Aprovada',
        REJECTED: 'Rejeitada'
    }[status] || status;
}

function statusClass(status) {
    return {
        PENDING: 'pending',
        APPROVED: '',
        REJECTED: 'rejected'
    }[status] || '';
}

function iconColor(index) {
    return ['#2448e8', '#2563eb', '#f2b92b', '#ef7f2d', '#6c3bc0', '#173d83'][index % 6];
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

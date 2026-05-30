// admin.js - Europa Explorer CMS
document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = (
        window.EUROEXPLORER_API_BASE
        || document.querySelector('meta[name="europa-api-base"]')?.content
        || (['localhost', '127.0.0.1'].includes(window.location.hostname) ? 'http://localhost:8000' : '')
    ).replace(/\/+$/, '');

    function apiUrl(path) {
        if (!API_BASE) {
            throw new Error('API_NOT_CONFIGURED');
        }
        return `${API_BASE}${path}`;
    }

    async function apiFetch(path, options = {}, timeoutMs = 15000) {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
        try {
            return await fetch(apiUrl(path), { ...options, signal: controller.signal });
        } finally {
            window.clearTimeout(timeout);
        }
    }

    function adminApiErrorMessage(error) {
        if (error?.message === 'API_NOT_CONFIGURED') {
            return 'Backend Render não configurado. Defina o URL da API antes de iniciar sessão.';
        }
        if (error?.name === 'AbortError') {
            return 'O backend demorou demasiado a responder. Confirme se o Render esta ativo.';
        }
        return 'Servidor offline. Certifique-se de que o backend esta a correr.';
    }

    const modalHtml = `
        <div id="admin-login-modal" aria-hidden="true">
            <div class="admin-login-shell" role="dialog" aria-modal="true" aria-labelledby="admin-login-title">
                <aside class="admin-login-art" aria-label="Imagem de destaque">
                    <img class="admin-login-photo" src="assets/dog-hat.png" alt="Cao com chapeu">
                    <div class="admin-login-photo-fallback" aria-hidden="true">
                        <span>EU</span>
                    </div>
                    <div class="admin-login-art-shade"></div>
                    <button class="admin-login-back" id="admin-cancel-login" type="button">
                        Voltar ao website
                        <span aria-hidden="true">-&gt;</span>
                    </button>
                    <div class="admin-login-mark">EU</div>
                    <div class="admin-login-caption">
                        <strong>Europa Explorer</strong>
                        <span>Centro de administração</span>
                    </div>
                </aside>

                <section class="admin-login-panel">
                    <div class="admin-login-copy">
                        <span class="admin-login-kicker">Acesso reservado</span>
                        <h2 id="admin-login-title">Login de administradores</h2>
                        <p>Entre com a sua conta para rever alterações, gerir propostas e acompanhar notificações.</p>
                    </div>

                    <form id="admin-login-form" class="admin-login-form">
                        <label class="admin-login-input">
                            <span>Utilizador</span>
                            <input type="text" id="admin-username" autocomplete="username">
                        </label>

                        <label class="admin-login-input">
                            <span>Palavra-passe</span>
                            <div class="admin-password-wrap">
                                <input type="password" id="admin-password" autocomplete="current-password">
                                <button type="button" id="admin-toggle-password" aria-label="Mostrar palavra-passe">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" stroke="currentColor" stroke-width="1.7"/>
                                        <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/>
                                    </svg>
                                </button>
                            </div>
                        </label>

                        <button id="admin-submit-login" class="admin-primary-login" type="submit">
                            Entrar no painel
                        </button>

                        <p id="admin-login-error" role="alert">Credenciais invalidas. Tente novamente.</p>
                    </form>
                </section>
            </div>
        </div>

        <div class="admin-notification" id="admin-notification" role="status" aria-live="polite">
            <div class="admin-notif-icon">!</div>
            <div>
                <strong>Proposta rejeitada</strong><br>
                <span id="admin-rejection-note"></span>
            </div>
            <button class="admin-notif-close" type="button">Fechar</button>
        </div>

        <div id="country-editor-shell" class="country-editor-shell" aria-hidden="true">
            <aside class="editor-rail" aria-label="Categorias do editor">
                <button class="active" type="button" data-editor-tab="text"><span aria-hidden="true">T</span><strong>Texto</strong></button>
                <button type="button" data-editor-tab="images"><span aria-hidden="true">I</span><strong>Imagens</strong></button>
                <button type="button" data-editor-tab="sections"><span aria-hidden="true">S</span><strong>Secções</strong></button>
                <button type="button" data-editor-tab="uploads"><span aria-hidden="true">U</span><strong>Uploads</strong></button>
                <button type="button" data-editor-tab="adjustments"><span aria-hidden="true">A</span><strong>Ajustes</strong></button>
                <button type="button" data-editor-tab="history"><span aria-hidden="true">H</span><strong>Histórico</strong></button>
                <button type="button" data-editor-tab="settings"><span aria-hidden="true">C</span><strong>Config.</strong></button>
                <button type="button" data-editor-tab="new-section"><span aria-hidden="true">+</span><strong>Nova Secção</strong></button>
            </aside>
            <aside class="editor-menu" aria-label="Submenu do editor">
                <div class="editor-menu-head">
                    <span id="editor-mode-label">Editor</span>
                    <strong id="editor-menu-title">Texto</strong>
                </div>
                <div id="editor-menu-content" class="editor-menu-content"></div>
            </aside>
            <header class="editor-topbar" aria-label="Ações do editor">
                <button type="button" id="editor-undo">Undo</button>
                <button type="button" id="editor-redo">Redo</button>
                <button type="button" id="editor-save">Guardar</button>
                <button type="button" id="editor-preview">Pré-visualizar</button>
                <button type="button" id="editor-publish">Publicar</button>
                <button type="button" id="editor-exit">Sair da edição</button>
            </header>
            <aside class="editor-context" aria-label="Painel contextual">
                <div id="editor-context-content"></div>
            </aside>
            <input type="file" id="admin-upload-image" accept="image/*">
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const loginModal = document.getElementById('admin-login-modal');
    const loginShell = loginModal.querySelector('.admin-login-shell');
    const loginForm = document.getElementById('admin-login-form');
    const submitButton = document.getElementById('admin-submit-login');
    const usernameInput = document.getElementById('admin-username');
    const passwordInput = document.getElementById('admin-password');
    const errEl = document.getElementById('admin-login-error');
    const cancelLoginButton = document.getElementById('admin-cancel-login');
    const togglePasswordButton = document.getElementById('admin-toggle-password');

    function runAnime(config) {
        if (window.anime) {
            window.anime(config);
        }
    }

    function getStoredAdminUser() {
        try {
            return JSON.parse(localStorage.getItem('admin_user') || 'null');
        } catch {
            return null;
        }
    }

    function setStoredAdminUser(user) {
        localStorage.removeItem('admin_token');
        localStorage.setItem('admin_user', JSON.stringify(user));
    }

    async function clearAdminSession() {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        updateLoginButtonState();
        await apiFetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        }).catch(() => undefined);
    }

    function openLoginModal() {
        loginModal.classList.add('active');
        loginModal.setAttribute('aria-hidden', 'false');
        errEl.style.display = 'none';

        if (window.anime) {
            window.anime.remove('.admin-login-shell, .admin-login-art, .admin-login-input, .admin-primary-login');
            window.anime.set('.admin-login-shell', { opacity: 0, translateY: 40 });
            window.anime.set('.admin-login-art', { opacity: 0, translateX: -36 });
            window.anime.set('.admin-login-input, .admin-primary-login', { opacity: 0, translateY: 20 });
            window.anime.timeline({ easing: 'easeOutCubic' })
                .add({
                    targets: '.admin-login-shell',
                    opacity: [0, 1],
                    translateY: [40, 0],
                    duration: 700
                })
                .add({
                    targets: '.admin-login-art',
                    opacity: [0, 1],
                    translateX: [-36, 0],
                    duration: 640
                }, '-=520')
                .add({
                    targets: '.admin-login-input, .admin-primary-login',
                    opacity: [0, 1],
                    translateY: [20, 0],
                    delay: window.anime.stagger(120),
                    duration: 600,
                    easing: 'easeOutQuad'
                }, '-=360');
        }

        window.setTimeout(() => usernameInput.focus(), 120);
    }

    function closeLoginModal() {
        loginModal.classList.remove('active');
        loginModal.setAttribute('aria-hidden', 'true');
        errEl.style.display = 'none';
    }

    function injectLoginButton(container) {
        if (!container || container.querySelector('.auth-login-btn')) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'auth-login-btn';
        btn.dataset.adminAuth = 'true';
        btn.setAttribute('aria-label', 'Aceder ao painel de administração');
        btn.textContent = 'Admin';
        container.appendChild(btn);
    }

    injectLoginButton(document.querySelector('.intro-nav-meta'));
    injectLoginButton(document.querySelector('.hdr-meta'));

    const globeScreen = document.getElementById('globe-screen');
    if (globeScreen) {
        const globeObserver = new MutationObserver(() => {
            if (globeScreen.classList.contains('active')) {
                injectLoginButton(document.querySelector('.hdr-meta'));
                updateLoginButtonState();
            }
        });
        globeObserver.observe(globeScreen, { attributes: true });
    }

    document.addEventListener('click', (e) => {
        const authButton = e.target?.closest?.('.auth-login-btn');
        if (!authButton) return;

        const user = getStoredAdminUser();

        if (user) {
            if (user.role === 'SUPER_ADMIN') {
                openSuperAdminDashboard();
                return;
            }

            clearAdminSession();
            location.reload();
            return;
        }

        openLoginModal();
    });

    cancelLoginButton.addEventListener('click', closeLoginModal);
    loginModal.addEventListener('click', (e) => {
        if (e.target === loginModal) closeLoginModal();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && loginModal.classList.contains('active')) {
            closeLoginModal();
        }
    });

    togglePasswordButton.addEventListener('click', () => {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        togglePasswordButton.setAttribute('aria-label', isPassword ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe');
    });

    ['mouseenter', 'focus'].forEach((eventName) => {
        submitButton.addEventListener(eventName, () => {
            runAnime({ targets: submitButton, scale: 1.025, duration: 180, easing: 'easeOutQuad' });
        });
    });

    ['mouseleave', 'blur'].forEach((eventName) => {
        submitButton.addEventListener(eventName, () => {
            runAnime({ targets: submitButton, scale: 1, duration: 220, easing: 'easeOutQuad' });
        });
    });

    submitButton.addEventListener('mousedown', () => {
        runAnime({ targets: submitButton, scale: 0.985, duration: 120, easing: 'easeOutQuad' });
    });

    submitButton.addEventListener('mouseup', () => {
        runAnime({ targets: submitButton, scale: 1.025, duration: 140, easing: 'easeOutQuad' });
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        errEl.style.display = 'none';

        if (!username || !password) {
            errEl.textContent = 'Preencha o utilizador e a palavra-passe.';
            errEl.style.display = 'block';
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = 'A validar...';

        try {
            const res = await apiFetch('/api/auth/login', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (!res.ok) {
                errEl.textContent = 'Credenciais invalidas.';
                errEl.style.display = 'block';
                return;
            }

            const data = await res.json();
            setStoredAdminUser(data.user);
            closeLoginModal();
            updateLoginButtonState();

            if (data.user.role === 'SUPER_ADMIN') {
                openSuperAdminDashboard();
            } else {
                setupStandardAdminEditor();
                checkForRejections();
            }
        } catch (err) {
            errEl.textContent = adminApiErrorMessage(err);
            errEl.style.display = 'block';
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Entrar no painel';
        }
    });

    document.querySelector('.admin-notif-close')?.addEventListener('click', () => {
        document.getElementById('admin-notification')?.classList.remove('active');
    });

    function updateLoginButtonState() {
        const user = getStoredAdminUser();

        document.querySelectorAll('.auth-login-btn').forEach((btn) => {
            if (user) {
                btn.textContent = user.role === 'SUPER_ADMIN' ? 'Painel' : 'Sair';
                btn.classList.add('logged-in');
            } else {
                btn.textContent = 'Admin';
                btn.classList.remove('logged-in');
            }
        });
    }

    function openSuperAdminDashboard() {
        window.location.assign('admin-panel/');
    }

    let currentImages = [];
    let isEditing = false;
    let originalContent = null;

    const editor = {
        activeTab: 'text',
        history: [],
        future: [],
        selected: null,
        selectedType: null,
        selectedSection: null,
        uploadMode: 'floating',
        replaceTarget: null,
        pendingSection: null,
        preview: false,
        bound: false
    };

    const fontOptions = ['Inter', 'Cinzel', 'Crimson Text'];
    const statKeyByLabel = {
        capital: 'capital',
        populacao: 'population',
        area: 'area',
        moeda: 'currency',
        lingua: 'language',
        'na ue desde': 'eu_since'
    };

    function setupStandardAdminEditor() {
        const countryModal = document.getElementById('country-modal');
        if (!countryModal) return;

        const observer = new MutationObserver(() => {
            if (countryModal.classList.contains('active')) {
                injectEditorControls();
                const countryId = getCurrentCountryId();
                if (countryId) fetchAndRenderCountryData(countryId);
            } else {
                closeEditor(false);
                document.querySelectorAll('.canvas-image, .free-text-block').forEach((e) => e.remove());
                document.getElementById('country-custom-sections')?.remove();
            }
        });
        observer.observe(countryModal, { attributes: true });

        if (countryModal.classList.contains('active')) {
            injectEditorControls();
        }
    }

    function injectEditorControls() {
        const ccFooter = document.querySelector('.cc-footer');
        if (!ccFooter || !getStoredAdminUser()) return;

        if (!document.getElementById('admin-edit-btn')) {
            const editBtn = document.createElement('button');
            editBtn.id = 'admin-edit-btn';
            editBtn.className = 'btn-stamp';
            editBtn.textContent = 'EDITAR PAÍS';
            ccFooter.insertBefore(editBtn, ccFooter.firstChild);
            editBtn.addEventListener('click', () => {
                if (isEditing) closeEditor(true);
                else openEditor();
            });
        }

        bindEditorShell();
        prepareEditableElements();
    }

    function bindEditorShell() {
        if (editor.bound) return;
        editor.bound = true;

        document.querySelectorAll('[data-editor-tab]').forEach((button) => {
            button.addEventListener('click', () => setEditorTab(button.dataset.editorTab));
        });

        document.getElementById('editor-undo')?.addEventListener('click', undoEditor);
        document.getElementById('editor-redo')?.addEventListener('click', redoEditor);
        document.getElementById('editor-save')?.addEventListener('click', submitProposal);
        document.getElementById('editor-publish')?.addEventListener('click', publishCountryContent);
        document.getElementById('editor-preview')?.addEventListener('click', togglePreview);
        document.getElementById('editor-exit')?.addEventListener('click', () => closeEditor(true));

        document.getElementById('admin-upload-image')?.addEventListener('change', handleUploadChange);

        document.addEventListener('click', (event) => {
            if (!isEditing) return;
            if (event.target.closest('#country-editor-shell')) return;
            if (event.target.closest('.editor-action, .section-action, .curi-tool-row')) return;

            const selectable = event.target.closest('[data-editor-selectable], .canvas-image, .section-image, .country-custom-section, .free-text-block');
            if (!selectable || !document.querySelector('.country-card')?.contains(selectable)) return;

            const target = event.target.closest('[data-editor-selectable], .canvas-image, .section-image, .free-text-block') || selectable;
            if (!canEditElement(target)) {
                showEditorNotice('Apenas SUPER ADMINS podem editar estes dados.');
                return;
            }

            selectEditorElement(target);
        });

        document.addEventListener('input', (event) => {
            if (!isEditing) return;
            if (event.target.matches('[contenteditable="true"]')) {
                renderContextPanel();
            }
        });

        const countryModal = document.getElementById('country-modal');
        countryModal?.addEventListener('dragover', (event) => {
            if (!isEditing) return;
            event.preventDefault();
        });
        countryModal?.addEventListener('drop', async (event) => {
            if (!isEditing) return;
            event.preventDefault();
            const file = event.dataTransfer?.files?.[0];
            if (file) {
                editor.uploadMode = 'floating';
                await uploadAndPlace(file);
            }
        });
    }

    function getAdminUser() {
        try {
            return JSON.parse(localStorage.getItem('admin_user') || 'null');
        } catch {
            return null;
        }
    }

    function isSuperAdmin() {
        return getAdminUser()?.role === 'SUPER_ADMIN';
    }

    function getCurrentCountryId() {
        return document.getElementById('modal-country-name')?.textContent?.trim() || '';
    }

    function normalizeLabel(value) {
        return String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim();
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    function safeUploadUrl(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        const safePathPattern = /^\/uploads\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+$/;
        try {
            const parsed = new URL(raw, window.location.origin);
            return safePathPattern.test(parsed.pathname) ? parsed.href : '';
        } catch {
            return safePathPattern.test(raw) ? raw : '';
        }
    }

    function sanitizeEditorHtml(value) {
        const template = document.createElement('template');
        template.innerHTML = String(value || '');
        template.content.querySelectorAll('script,style,iframe,object,embed,svg,math,link,meta').forEach((node) => node.remove());
        template.content.querySelectorAll('*').forEach((node) => {
            Array.from(node.attributes).forEach((attr) => {
                const name = attr.name.toLowerCase();
                const val = attr.value.toLowerCase();
                if (name.startsWith('on') || name === 'style' || val.includes('javascript:') || val.includes('data:')) {
                    node.removeAttribute(attr.name);
                }
            });
        });
        return template.innerHTML;
    }

    function uid(prefix) {
        return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    }

    function openEditor() {
        const card = document.querySelector('.country-card');
        const shell = document.getElementById('country-editor-shell');
        const editBtn = document.getElementById('admin-edit-btn');
        if (!card || !shell || !editBtn) return;

        isEditing = true;
        editor.history = [];
        editor.future = [];
        editor.selected = null;
        editor.selectedType = null;
        editor.selectedSection = null;
        editor.preview = false;
        originalContent = serializeContent({ full: true });

        syncContextPanelState();
        document.body.classList.add('country-editor-active');
        card.classList.add('admin-edit-mode');
        shell.classList.add('active');
        shell.setAttribute('aria-hidden', 'false');
        editBtn.textContent = 'SAIR';
        editBtn.style.background = '#C0392B';

        prepareEditableElements();
        setEditorTab('text');
        pushHistory();
        document.querySelectorAll('.canvas-image').forEach((el) => el.classList.add('draggable'));
        runAnime({ targets: '#country-editor-shell .editor-rail, #country-editor-shell .editor-menu, #country-editor-shell .editor-context, #country-editor-shell .editor-topbar', opacity: [0, 1], translateY: [10, 0], delay: window.anime ? window.anime.stagger(45) : 0, duration: 380, easing: 'easeOutQuad' });
    }

    function closeEditor(revert) {
        if (!isEditing && !document.body.classList.contains('country-editor-active')) return;

        const card = document.querySelector('.country-card');
        const shell = document.getElementById('country-editor-shell');
        const editBtn = document.getElementById('admin-edit-btn');

        if (revert && originalContent) {
            restoreContent(originalContent);
        }

        isEditing = false;
        editor.preview = false;
        editor.selected = null;
        editor.selectedType = null;
        editor.selectedSection = null;
        document.body.classList.remove('country-editor-active', 'country-editor-preview', 'editor-has-selection');
        card?.classList.remove('admin-edit-mode');
        shell?.classList.remove('active', 'has-selection');
        shell?.setAttribute('aria-hidden', 'true');
        if (editBtn) {
            editBtn.textContent = 'EDITAR PAÍS';
            editBtn.style.background = '#173d83';
        }
        clearSelection();
        cleanupEditChrome();
        document.querySelectorAll('[contenteditable="true"]').forEach((el) => el.setAttribute('contenteditable', 'false'));
        document.querySelectorAll('.canvas-image').forEach((el) => el.classList.remove('draggable'));
    }

    function canEditElement(element) {
        if (isSuperAdmin()) return true;
        const field = element.dataset?.editorField;
        const restrictedStats = ['capital', 'population', 'area', 'currency', 'language', 'eu_since'];
        return !restrictedStats.includes(field);
    }

    function prepareEditableElements() {
        const desc = document.getElementById('modal-desc');
        if (desc) {
            desc.dataset.editorSelectable = 'true';
            desc.dataset.editorKind = 'text';
            desc.dataset.editorField = 'desc';
            desc.setAttribute('contenteditable', isEditing ? 'true' : 'false');
        }

        document.querySelectorAll('.stat-item').forEach((item) => {
            const key = statKeyByLabel[normalizeLabel(item.querySelector('.stat-label')?.textContent)];
            const value = item.querySelector('.stat-value');
            if (!key || !value) return;
            value.dataset.editorSelectable = 'true';
            value.dataset.editorKind = 'text';
            value.dataset.editorField = key;
            value.setAttribute('contenteditable', isSuperAdmin() && isEditing ? 'true' : 'false');
        });

        document.querySelectorAll('#modal-curis .curi-item').forEach((item) => {
            item.dataset.editorSelectable = 'true';
            item.dataset.editorKind = 'text';
            item.dataset.editorField = 'curiosity';
            item.setAttribute('contenteditable', isEditing ? 'true' : 'false');
        });

        document.querySelectorAll('.country-custom-section [data-editor-selectable]').forEach((item) => {
            item.setAttribute('contenteditable', isEditing ? 'true' : 'false');
        });

        renderCuriosityTools();
        renderSectionTools();
    }

    function cleanupEditChrome() {
        document.querySelectorAll('.curi-tool-row').forEach((node) => node.remove());
        unwrapCuriosityBlocks();
        document.querySelectorAll('.is-selected').forEach((node) => node.classList.remove('is-selected'));
    }

    function unwrapCuriosityBlocks() {
        document.querySelectorAll('#modal-curis .curiosity-editor-block').forEach((block) => {
            const item = block.querySelector(':scope > .curi-item');
            if (item) block.replaceWith(item);
            else block.remove();
        });
    }

    function setEditorTab(tab) {
        editor.activeTab = tab;
        document.querySelectorAll('[data-editor-tab]').forEach((button) => {
            button.classList.toggle('active', button.dataset.editorTab === tab);
        });
        const titles = {
            text: 'Texto',
            images: 'Imagens',
            sections: 'Secções',
            uploads: 'Uploads',
            adjustments: 'Ajustes',
            history: 'Histórico',
            settings: 'Configurações',
            'new-section': 'Nova Secção'
        };
        const title = document.getElementById('editor-menu-title');
        if (title) title.textContent = titles[tab] || 'Editor';
        renderEditorMenu();
    }

    function renderEditorMenu() {
        const menu = document.getElementById('editor-menu-content');
        if (!menu) return;
        const superAdmin = isSuperAdmin();
        const sectionCount = document.querySelectorAll('.country-custom-section').length;

        if (editor.activeTab === 'text') {
            menu.innerHTML = `
                <button class="editor-menu-button" type="button" data-action="add-text">Adicionar texto livre</button>
                <button class="editor-menu-button" type="button" data-action="add-curiosity">Adicionar curiosidade</button>
                <p>Selecione texto no template para abrir as ferramentas contextuais.</p>
            `;
        } else if (editor.activeTab === 'images') {
            menu.innerHTML = `
                <button class="editor-menu-button" type="button" data-action="upload-floating">Carregar imagem</button>
                <button class="editor-menu-button" type="button" data-action="remove-selected-image">Remover imagem selecionada</button>
                <p>As imagens carregadas são guardadas no backend e entram no pedido de alteração.</p>
            `;
        } else if (editor.activeTab === 'sections') {
            menu.innerHTML = `
                <p>${sectionCount} secções personalizadas neste país.</p>
                <button class="editor-menu-button" type="button" data-action="select-sections">Selecionar secções</button>
            `;
        } else if (editor.activeTab === 'new-section') {
            menu.innerHTML = `
                <form class="new-section-form" id="new-section-form">
                    <label>Nome da secção
                        <input id="new-section-name" type="text" autocomplete="off">
                    </label>
                    <button class="editor-menu-button" type="submit">Criar Secção</button>
                </form>
                <div class="section-manager" id="section-manager">${renderSectionManager()}</div>
            `;
        } else if (editor.activeTab === 'uploads') {
            menu.innerHTML = `
                <button class="editor-menu-button" type="button" data-action="upload-floating">Escolher ficheiro</button>
                <p>Também pode arrastar uma imagem para a área do país.</p>
            `;
        } else if (editor.activeTab === 'adjustments') {
            menu.innerHTML = `
                <button class="editor-menu-button" type="button" data-action="snap-all">Alinhar elementos à grelha</button>
                <button class="editor-menu-button" type="button" data-action="clear-selection">Limpar seleção</button>
            `;
        } else if (editor.activeTab === 'history') {
            menu.innerHTML = `
                <button class="editor-menu-button" type="button" data-action="undo">Undo</button>
                <button class="editor-menu-button" type="button" data-action="redo">Redo</button>
                <p>${Math.max(editor.history.length - 1, 0)} passos no histórico. ${editor.future.length} passos para refazer.</p>
            `;
        } else {
            menu.innerHTML = `
                <p>Permissão atual: <strong>${getAdminUser()?.role || 'Sem sessão'}</strong></p>
                <p>${superAdmin ? 'Pode editar todos os dados do país.' : 'Pode editar conteúdo editorial; apenas dados estatísticos exigem SUPER_ADMIN.'}</p>
            `;
        }

        menu.querySelectorAll('[data-action]').forEach((button) => {
            button.addEventListener('click', () => handleEditorAction(button.dataset.action));
        });

        menu.querySelector('#new-section-form')?.addEventListener('submit', (event) => {
            event.preventDefault();
            const input = menu.querySelector('#new-section-name');
            const name = input?.value.trim();
            if (!name) {
                showEditorNotice('Escreva o nome da secção.');
                return;
            }
            createCustomSection({ title: escapeHtml(name) });
            input.value = '';
            renderEditorMenu();
        });

        menu.querySelectorAll('[data-section-id][data-section-list-action]').forEach((button) => {
            button.addEventListener('click', () => {
                const section = document.querySelector(`.country-custom-section[data-section-id="${button.dataset.sectionId}"]`);
                if (!section) return;
                handleSectionAction(button.dataset.sectionListAction, section);
                renderEditorMenu();
            });
        });

        menu.querySelectorAll('[data-section-rename]').forEach((input) => {
            input.addEventListener('input', () => {
                const section = document.querySelector(`.country-custom-section[data-section-id="${input.dataset.sectionRename}"]`);
                const title = section?.querySelector('.custom-section-title');
                if (title) {
                    title.textContent = input.value;
                    pushHistoryDeferred();
                }
            });
        });
    }

    function renderSectionManager() {
        const sections = Array.from(document.querySelectorAll('.country-custom-section'));
        if (!sections.length) return '<p>0 secções criadas.</p>';
        return sections.map((section, index) => {
            const id = section.dataset.sectionId;
            const name = section.querySelector('.custom-section-title')?.textContent?.trim() || '';
            return `
                <article class="section-manager-item">
                    <label>Nome
                        <input type="text" value="${escapeHtml(name)}" data-section-rename="${id}">
                    </label>
                    <div class="section-manager-actions">
                        <button type="button" data-section-id="${id}" data-section-list-action="up">Subir</button>
                        <button type="button" data-section-id="${id}" data-section-list-action="down">Descer</button>
                        <button type="button" data-section-id="${id}" data-section-list-action="duplicate">Duplicar</button>
                        <button type="button" data-section-id="${id}" data-section-list-action="delete">Excluir</button>
                    </div>
                </article>
            `;
        }).join('');
    }

    function handleEditorAction(action) {
        if (action === 'add-text') addFreeTextBlock();
        if (action === 'add-curiosity') addCuriosity();
        if (action === 'upload-floating') triggerUpload('floating');
        if (action === 'remove-selected-image') removeSelectedImage();
        if (action === 'select-sections') {
            const firstSection = document.querySelector('.country-custom-section');
            if (firstSection) selectEditorElement(firstSection);
        }
        if (action === 'snap-all') snapAllElements();
        if (action === 'clear-selection') clearSelection();
        if (action === 'undo') undoEditor();
        if (action === 'redo') redoEditor();
    }

    function selectEditorElement(element) {
        clearSelection();
        editor.selected = element;
        editor.selectedSection = element.closest('.country-custom-section');
        if (element.classList.contains('canvas-image') || element.classList.contains('section-image')) {
            editor.selectedType = 'image';
        } else if (element.classList.contains('country-custom-section')) {
            editor.selectedType = 'section';
        } else {
            editor.selectedType = 'text';
        }
        element.classList.add('is-selected');
        syncContextPanelState();
        renderContextPanel();
    }

    function clearSelection() {
        document.querySelectorAll('.is-selected').forEach((node) => node.classList.remove('is-selected'));
        editor.selected = null;
        editor.selectedType = null;
        editor.selectedSection = null;
        syncContextPanelState();
        renderContextPanel();
    }

    function syncContextPanelState() {
        const hasSelection = Boolean(editor.selected);
        document.body.classList.toggle('editor-has-selection', hasSelection);
        document.getElementById('country-editor-shell')?.classList.toggle('has-selection', hasSelection);
    }

    function renderContextPanel() {
        const context = document.getElementById('editor-context-content');
        if (!context) return;

        if (!editor.selected) {
            context.innerHTML = '<h3>Painel contextual</h3><p>Selecione texto, imagem ou secção para editar.</p>';
            return;
        }

        if (editor.selectedType === 'text') renderTextContext(context);
        if (editor.selectedType === 'image') renderImageContext(context);
        if (editor.selectedType === 'section') renderSectionContext(context);
    }

    function renderTextContext(context) {
        const selected = editor.selected;
        const styles = window.getComputedStyle(selected);
        context.innerHTML = `
            <h3>Texto</h3>
            <label>Tipo de letra
                <select data-text-style="fontFamily">${fontOptions.map((font) => `<option value="${font}" ${styles.fontFamily.includes(font) ? 'selected' : ''}>${font}</option>`).join('')}</select>
            </label>
            <label>Tamanho
                <input type="range" min="10" max="72" value="${parseInt(styles.fontSize, 10) || 18}" data-text-style="fontSize" data-unit="px">
            </label>
            <label>Peso
                <select data-text-style="fontWeight">
                    <option value="400">Regular</option>
                    <option value="500">Medium</option>
                    <option value="700">Bold</option>
                    <option value="900">Black</option>
                </select>
            </label>
            <label>Cor do texto <input type="color" value="${rgbToHex(styles.color)}" data-text-style="color"></label>
            <label>Fundo <input type="color" value="${rgbToHex(styles.backgroundColor)}" data-text-style="backgroundColor"></label>
            <div class="editor-segment">
                <button type="button" data-align="left">Esq.</button>
                <button type="button" data-align="center">Centro</button>
                <button type="button" data-align="right">Dir.</button>
            </div>
            <label>Entre linhas <input type="range" min="0.9" max="2.2" step="0.05" value="${parseFloat(styles.lineHeight) / (parseFloat(styles.fontSize) || 16) || 1.4}" data-text-style="lineHeight"></label>
            <label>Entre letras <input type="range" min="0" max="8" step="0.2" value="${parseFloat(styles.letterSpacing) || 0}" data-text-style="letterSpacing" data-unit="px"></label>
            <label>Opacidade <input type="range" min="20" max="100" value="${Math.round((parseFloat(styles.opacity) || 1) * 100)}" data-text-style="opacity" data-scale="100"></label>
            <label>Sombra cor <input type="color" value="${selected.dataset.shadowColor || '#000000'}" data-shadow="color"></label>
            <label>Sombra blur <input type="range" min="0" max="30" value="${selected.dataset.shadowBlur || 0}" data-shadow="blur"></label>
            <label>Sombra offset X <input type="range" min="-20" max="20" value="${selected.dataset.shadowOffsetX || 0}" data-shadow="offsetX"></label>
            <label>Sombra offset Y <input type="range" min="-20" max="20" value="${selected.dataset.shadowOffsetY || 0}" data-shadow="offsetY"></label>
            <div class="editor-segment vertical">
                <button type="button" data-transform="uppercase">Maiusculas</button>
                <button type="button" data-transform="lowercase">Minusculas</button>
                <button type="button" data-transform="capitalize">Capitalizar</button>
            </div>
            <div class="editor-segment vertical">
                <button type="button" data-element-action="duplicate">Duplicar</button>
                <button type="button" data-element-action="delete">Excluir</button>
                <button type="button" data-element-action="lock">Bloquear</button>
                <button type="button" data-element-action="front">Trazer para frente</button>
                <button type="button" data-element-action="back">Enviar para trás</button>
            </div>
        `;
        context.querySelector('[data-text-style="fontWeight"]').value = selected.style.fontWeight || styles.fontWeight || '400';
        context.querySelectorAll('[data-text-style]').forEach((input) => {
            input.addEventListener('input', () => {
                const value = input.dataset.scale ? Number(input.value) / Number(input.dataset.scale) : `${input.value}${input.dataset.unit || ''}`;
                selected.style[input.dataset.textStyle] = value;
                pushHistoryDeferred();
            });
        });
        context.querySelectorAll('[data-align]').forEach((button) => button.addEventListener('click', () => {
            selected.style.textAlign = button.dataset.align;
            pushHistory();
        }));
        context.querySelectorAll('[data-transform]').forEach((button) => button.addEventListener('click', () => {
            selected.textContent = transformText(selected.textContent, button.dataset.transform);
            pushHistory();
        }));
        context.querySelectorAll('[data-shadow]').forEach((input) => input.addEventListener('input', () => {
            selected.dataset[`shadow${input.dataset.shadow[0].toUpperCase()}${input.dataset.shadow.slice(1)}`] = input.value;
            applyTextShadow(selected);
            pushHistoryDeferred();
        }));
        context.querySelectorAll('[data-element-action]').forEach((button) => button.addEventListener('click', () => handleElementAction(button.dataset.elementAction)));
    }

    function renderImageContext(context) {
        const image = editor.selected;
        context.innerHTML = `
            <h3>Imagem</h3>
            <button class="editor-menu-button" type="button" data-image-action="replace">Substituir imagem</button>
            <button class="editor-menu-button" type="button" data-image-action="remove">Remover imagem</button>
            <button class="editor-menu-button" type="button" data-image-action="crop">Recortar / mover dentro do frame</button>
            ${imageRange('rotate', 'Girar', -180, 180, image.dataset.rotate || 0)}
            ${imageRange('brightness', 'Brilho', 20, 180, image.dataset.brightness || 100)}
            ${imageRange('contrast', 'Contraste', 20, 180, image.dataset.contrast || 100)}
            ${imageRange('saturate', 'Saturacao', 0, 220, image.dataset.saturate || 100)}
            ${imageRange('temperature', 'Temperatura', 0, 100, image.dataset.temperature || 0)}
            ${imageRange('hue', 'Matiz', -180, 180, image.dataset.hue || 0)}
            ${imageRange('vignette', 'Vignette', 0, 100, image.dataset.vignette || 0)}
            ${imageRange('blur', 'Desfoque', 0, 16, image.dataset.blur || 0)}
            ${imageRange('opacity', 'Transparencia', 10, 100, image.dataset.opacity || 100)}
            ${imageRange('radius', 'Cantos', 0, 48, image.dataset.radius || 4)}
            ${imageRange('scale', 'Imagem dentro do frame', 100, 220, image.dataset.scale || 100)}
            <div class="editor-segment vertical">
                <button type="button" data-image-action="flip-x">Inverter horizontal</button>
                <button type="button" data-image-action="flip-y">Inverter vertical</button>
                <button type="button" data-image-action="filter-calm">Filtro frio</button>
                <button type="button" data-image-action="filter-warm">Filtro quente</button>
                <button type="button" data-image-action="filter-mono">Filtro mono</button>
                <button type="button" data-image-action="auto-enhance">Auto-enhance</button>
                <button type="button" data-image-action="reset">Reset</button>
            </div>
        `;
        context.querySelectorAll('[data-image-prop]').forEach((input) => {
            input.addEventListener('input', () => {
                image.dataset[input.dataset.imageProp] = input.value;
                applyImageStyles(image);
                pushHistoryDeferred();
            });
        });
        context.querySelectorAll('[data-image-action]').forEach((button) => {
            button.addEventListener('click', () => handleImageAction(button.dataset.imageAction, image));
        });
    }

    function renderSectionContext(context) {
        const section = editor.selected.closest('.country-custom-section') || editor.selected;
        context.innerHTML = `
            <h3>Secção</h3>
            <button class="editor-menu-button" type="button" data-section-action="upload">Adicionar/Substituir imagem</button>
            <button class="editor-menu-button" type="button" data-section-action="duplicate">Duplicar secção</button>
            <button class="editor-menu-button" type="button" data-section-action="delete">Excluir secção</button>
            <div class="editor-segment">
                <button type="button" data-section-action="up">Subir</button>
                <button type="button" data-section-action="down">Descer</button>
            </div>
            <label>Espacamento <input type="range" min="12" max="48" value="${parseInt(section.dataset.gap || 20, 10)}" data-section-prop="gap"></label>
            <label>Cantos <input type="range" min="0" max="28" value="${parseInt(section.dataset.radius || 14, 10)}" data-section-prop="radius"></label>
        `;
        context.querySelectorAll('[data-section-action]').forEach((button) => button.addEventListener('click', () => handleSectionAction(button.dataset.sectionAction, section)));
        context.querySelectorAll('[data-section-prop]').forEach((input) => input.addEventListener('input', () => {
            section.dataset[input.dataset.sectionProp] = input.value;
            applySectionStyles(section);
            pushHistoryDeferred();
        }));
    }

    function imageRange(prop, label, min, max, value) {
        return `<label>${label}<input type="range" min="${min}" max="${max}" value="${value}" data-image-prop="${prop}"></label>`;
    }

    function rgbToHex(value) {
        const match = String(value).match(/\d+/g);
        if (!match || match.length < 3) return '#000000';
        return `#${match.slice(0, 3).map((part) => Number(part).toString(16).padStart(2, '0')).join('')}`;
    }

    function transformText(value, mode) {
        if (mode === 'uppercase') return value.toUpperCase();
        if (mode === 'lowercase') return value.toLowerCase();
        return value.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
    }

    function applyTextShadow(element) {
        const color = element.dataset.shadowColor || '#000000';
        const blur = element.dataset.shadowBlur || 0;
        const offsetX = element.dataset.shadowOffsetX || 0;
        const offsetY = element.dataset.shadowOffsetY || 0;
        element.style.textShadow = `${offsetX}px ${offsetY}px ${blur}px ${color}`;
    }

    function handleElementAction(action) {
        const element = editor.selected;
        if (!element) return;
        if (action === 'duplicate') {
            const clone = element.cloneNode(true);
            clone.dataset.editorId = uid('text');
            element.after(clone);
            prepareEditableElements();
            selectEditorElement(clone);
        }
        if (action === 'delete') {
            element.remove();
            clearSelection();
        }
        if (action === 'lock') {
            const locked = element.dataset.locked !== 'true';
            element.dataset.locked = String(locked);
            element.setAttribute('contenteditable', locked ? 'false' : 'true');
            element.classList.toggle('editor-locked', locked);
        }
        if (action === 'front') element.style.zIndex = String((parseInt(element.style.zIndex, 10) || 60) + 1);
        if (action === 'back') element.style.zIndex = String(Math.max(1, (parseInt(element.style.zIndex, 10) || 60) - 1));
        pushHistory();
    }

    function handleImageAction(action, image) {
        if (action === 'replace') {
            editor.replaceTarget = image;
            triggerUpload('replace');
        }
        if (action === 'remove') {
            image.remove();
            clearSelection();
        }
        if (action === 'crop') {
            image.classList.toggle('crop-active');
            showEditorNotice(image.classList.contains('crop-active') ? 'Arraste a imagem para ajustar o recorte.' : 'Recorte terminado.');
        }
        if (action === 'flip-x') image.dataset.flipX = image.dataset.flipX === 'true' ? 'false' : 'true';
        if (action === 'flip-y') image.dataset.flipY = image.dataset.flipY === 'true' ? 'false' : 'true';
        if (action === 'filter-calm') Object.assign(image.dataset, { brightness: 95, contrast: 108, saturate: 92, temperature: 0 });
        if (action === 'filter-warm') Object.assign(image.dataset, { brightness: 106, contrast: 104, saturate: 118, temperature: 38 });
        if (action === 'filter-mono') Object.assign(image.dataset, { brightness: 98, contrast: 116, saturate: 0, temperature: 0 });
        if (action === 'auto-enhance') Object.assign(image.dataset, { brightness: 108, contrast: 112, saturate: 118, temperature: 8, blur: 0 });
        if (action === 'reset') Object.assign(image.dataset, normalizeImageData({ url: image.dataset.url || image.querySelector('img')?.src || '' }));
        applyImageStyles(image);
        pushHistory();
        renderContextPanel();
    }

    function handleSectionAction(action, section) {
        if (action === 'upload') {
            editor.pendingSection = section;
            triggerUpload('section');
        }
        if (action === 'duplicate') {
            const data = serializeSection(section);
            data.id = uid('section');
            createCustomSection(data);
        }
        if (action === 'delete') {
            section.remove();
            clearSelection();
        }
        if (action === 'up' && section.previousElementSibling) section.parentNode.insertBefore(section, section.previousElementSibling);
        if (action === 'down' && section.nextElementSibling) section.parentNode.insertBefore(section.nextElementSibling, section);
        pushHistory();
        renderEditorMenu();
    }

    function addFreeTextBlock(data = {}, forceRender = false) {
        const container = document.querySelector('.cc-body');
        if (!container) {
            return;
        }
        container.style.position = 'relative';
        const safe = (!forceRender && data.x === undefined && data.y === undefined)
            ? getSafeCanvasPosition(data.w || 240, data.h || 44)
            : null;
        const block = document.createElement('div');
        block.className = 'free-text-block';
        block.dataset.editorSelectable = 'true';
        block.dataset.editorKind = 'text';
        block.dataset.editorId = data.id || uid('text');
        block.innerHTML = sanitizeEditorHtml(data.html || '');
        block.setAttribute('contenteditable', isEditing ? 'true' : 'false');
        block.style.cssText = `left:${safe?.x ?? data.x ?? 32}px;top:${safe?.y ?? data.y ?? 32}px;width:${safe?.w ?? data.w ?? 240}px;min-height:${safe?.h ?? data.h ?? 44}px;${data.style || ''}`;
        container.appendChild(block);
        bindMovableElement(block);
        if (!editor.restoring) {
            selectEditorElement(block);
            pushHistory();
        }
    }

    function addCuriosity(html = '') {
        const list = document.getElementById('modal-curis');
        if (!list) return;
        const item = document.createElement('div');
        item.className = 'curi-item';
        item.innerHTML = sanitizeEditorHtml(html);
        list.appendChild(item);
        prepareEditableElements();
        selectEditorElement(item);
        item.focus();
        pushHistory();
    }

    function renderCuriosityTools() {
        document.querySelectorAll('.curi-tool-row').forEach((node) => node.remove());
        unwrapCuriosityBlocks();
        if (!isEditing) return;
        document.querySelectorAll('#modal-curis .curi-item').forEach((item) => {
            const block = document.createElement('div');
            block.className = 'curiosity-editor-block';
            const row = document.createElement('div');
            row.className = 'curi-tool-row';
            row.innerHTML = `
                <button type="button" data-curi="up">Subir</button>
                <button type="button" data-curi="down">Descer</button>
                <button type="button" data-curi="delete">Excluir</button>
            `;
            item.after(block);
            block.append(item, row);
            row.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => {
                if (button.dataset.curi === 'delete') block.remove();
                if (button.dataset.curi === 'up') {
                    const previous = block.previousElementSibling;
                    if (previous) previous.before(block);
                }
                if (button.dataset.curi === 'down') {
                    const next = block.nextElementSibling;
                    if (next) next.after(block);
                }
                prepareEditableElements();
                pushHistory();
            }));
        });
    }

    function getSectionsRoot() {
        let root = document.getElementById('country-custom-sections');
        if (!root) {
            root = document.createElement('div');
            root.id = 'country-custom-sections';
            root.className = 'country-custom-sections';
            document.querySelector('.cc-curiosities')?.after(root);
        }
        return root;
    }

    function createCustomSection(data = {}) {
        const root = getSectionsRoot();
        const section = document.createElement('section');
        section.className = 'country-custom-section';
        section.dataset.sectionId = data.id || uid('section');
        section.dataset.gap = data.gap || 20;
        section.dataset.radius = data.radius || 14;
        section.dataset.editorSelectable = 'true';
        section.innerHTML = `
            <div class="custom-section-media">
            </div>
            <div class="custom-section-copy">
                <h2 class="custom-section-title" data-editor-selectable="true" data-editor-kind="text" contenteditable="${isEditing}">${sanitizeEditorHtml(data.title || '')}</h2>
                <div class="custom-section-desc" data-editor-selectable="true" data-editor-kind="text" contenteditable="${isEditing}">${sanitizeEditorHtml(data.desc || '')}</div>
            </div>
            <div class="section-actions">
                <button class="section-action section-upload" type="button">Adicionar Imagem</button>
                <button class="section-action" type="button" data-section-action="up">Subir</button>
                <button class="section-action" type="button" data-section-action="down">Descer</button>
                <button class="section-action" type="button" data-section-action="duplicate">Duplicar</button>
                <button class="section-action" type="button" data-section-action="delete">Excluir</button>
            </div>
        `;
        root.appendChild(section);
        if (data.image?.url) renderSectionImage(section, data.image);
        bindSectionTools(section);
        applySectionStyles(section);
        prepareEditableElements();
        if (!editor.restoring) {
            selectEditorElement(section);
            pushHistory();
        }
        renderEditorMenu();
        return section;
    }

    function bindSectionTools(section) {
        if (section.dataset.toolsBound === 'true') return;
        section.dataset.toolsBound = 'true';
        section.querySelector('.section-upload')?.addEventListener('click', () => {
            editor.pendingSection = section;
            triggerUpload('section');
        });
        section.querySelectorAll('[data-section-action]').forEach((button) => {
            button.addEventListener('click', () => handleSectionAction(button.dataset.sectionAction, section));
        });
    }

    function renderSectionTools() {
        document.querySelectorAll('.country-custom-section').forEach(bindSectionTools);
    }

    function renderSectionImage(section, imageData) {
        const frame = section.querySelector('.custom-section-media');
        if (!frame) return;
        frame.innerHTML = '';
        const image = document.createElement('div');
        image.className = 'section-image';
        image.dataset.editorSelectable = 'true';
        image.dataset.editorKind = 'image';
        Object.assign(image.dataset, normalizeImageData(imageData));
        const safeUrl = safeUploadUrl(imageData.url);
        if (!safeUrl) return;
        image.innerHTML = `<img src="${safeUrl}" alt=""><span class="image-vignette"></span>`;
        frame.appendChild(image);
        applyImageStyles(image);
    }

    function applySectionStyles(section) {
        section.style.gap = `${section.dataset.gap || 20}px`;
        section.style.borderRadius = `${section.dataset.radius || 14}px`;
    }

    function triggerUpload(mode) {
        editor.uploadMode = mode;
        document.getElementById('admin-upload-image')?.click();
    }

    async function handleUploadChange(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        await uploadAndPlace(file);
        event.target.value = '';
    }

    async function uploadAndPlace(file) {
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await apiFetch('/api/upload', {
                method: 'POST',
                credentials: 'include',
                body: formData
            });
            if (!res.ok) throw new Error('upload');
            const data = await res.json();
            if (!data.url) return;

            if (editor.uploadMode === 'replace' && editor.replaceTarget) {
                editor.replaceTarget.querySelector('img').src = data.url;
                editor.replaceTarget.dataset.url = data.url;
                editor.replaceTarget = null;
            } else if (editor.uploadMode === 'section' && editor.pendingSection) {
                renderSectionImage(editor.pendingSection, { url: data.url });
                selectEditorElement(editor.pendingSection.querySelector('.section-image'));
                editor.pendingSection = null;
            } else {
                const safe = getSafeCanvasPosition(260, 180);
                addImageToCanvas(data.url, safe.x, safe.y, safe.w, safe.h);
            }
            pushHistory();
        } catch (err) {
            showEditorNotice('Não foi possível carregar a imagem.');
        }
    }

    function addImageToCanvas(url, x = 32, y = 32, w = 260, h = 180, data = {}) {
        const safeUrl = safeUploadUrl(url);
        if (!safeUrl) return null;
        const container = document.querySelector('.cc-body');
        if (!container) return null;
        container.style.position = 'relative';
        const wrapper = document.createElement('div');
        wrapper.className = `canvas-image${isEditing ? ' draggable' : ''}`;
        wrapper.dataset.editorSelectable = 'true';
        wrapper.dataset.editorKind = 'image';
        wrapper.dataset.imageId = data.id || uid('image');
        Object.assign(wrapper.dataset, normalizeImageData({ ...data, url: safeUrl }));
        wrapper.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;z-index:${data.z || 50};`;
        wrapper.innerHTML = `<img src="${safeUrl}" alt=""><span class="image-vignette"></span><div class="resize-handle"></div>`;
        container.appendChild(wrapper);
        applyImageStyles(wrapper);
        bindMovableElement(wrapper);
        if (isEditing && !editor.restoring) selectEditorElement(wrapper);
        return wrapper;
    }

    function getSafeCanvasPosition(width = 260, height = 180) {
        const container = document.querySelector('.cc-body');
        if (!container) return { x: 32, y: 32, w: width, h: height };
        const containerRect = container.getBoundingClientRect();
        const availableWidth = Math.max(160, container.clientWidth - 48);
        const safeWidth = Math.min(width, availableWidth);
        const flowChildren = Array.from(container.children).filter((child) => (
            !child.classList.contains('canvas-image')
            && !child.classList.contains('free-text-block')
        ));
        const flowBottom = flowChildren.reduce((bottom, child) => {
            const rect = child.getBoundingClientRect();
            if (!rect.width || !rect.height) return bottom;
            return Math.max(bottom, rect.bottom - containerRect.top + container.scrollTop);
        }, 0);
        return {
            x: 24,
            y: Math.ceil(flowBottom + 24),
            w: safeWidth,
            h: height
        };
    }

    function normalizeImageData(data = {}) {
        return {
            url: data.url || '',
            rotate: data.rotate ?? 0,
            brightness: data.brightness ?? 100,
            contrast: data.contrast ?? 100,
            saturate: data.saturate ?? 100,
            temperature: data.temperature ?? 0,
            hue: data.hue ?? 0,
            vignette: data.vignette ?? 0,
            blur: data.blur ?? 0,
            opacity: data.opacity ?? 100,
            radius: data.radius ?? 4,
            scale: data.scale ?? 100,
            cropX: data.cropX ?? 50,
            cropY: data.cropY ?? 50,
            flipX: data.flipX ?? false,
            flipY: data.flipY ?? false
        };
    }

    function applyImageStyles(wrapper) {
        const img = wrapper.querySelector('img');
        if (!img) return;
        const d = normalizeImageData(wrapper.dataset);
        wrapper.style.opacity = Number(d.opacity) / 100;
        wrapper.style.borderRadius = `${d.radius}px`;
        wrapper.style.transform = `rotate(${d.rotate}deg)`;
        wrapper.style.overflow = 'hidden';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.objectPosition = `${d.cropX}% ${d.cropY}%`;
        img.style.filter = `brightness(${d.brightness}%) contrast(${d.contrast}%) saturate(${d.saturate}%) sepia(${d.temperature}%) hue-rotate(${d.hue}deg) blur(${d.blur}px)`;
        img.style.transform = `scaleX(${String(d.flipX) === 'true' ? -1 : 1}) scaleY(${String(d.flipY) === 'true' ? -1 : 1}) scale(${Number(d.scale) / 100})`;
        const vignette = wrapper.querySelector('.image-vignette');
        if (vignette) vignette.style.opacity = Number(d.vignette) / 100;
    }

    function bindMovableElement(element) {
        if (element.dataset.moveBound) return;
        element.dataset.moveBound = 'true';
        let move = null;
        element.addEventListener('pointerdown', (event) => {
            if (!isEditing || element.dataset.locked === 'true') return;
            if (event.target.closest('[contenteditable="true"]')) return;
            const rect = element.getBoundingClientRect();
            move = {
                type: event.target.classList.contains('resize-handle') ? 'resize' : element.classList.contains('crop-active') ? 'crop' : 'drag',
                x: event.clientX,
                y: event.clientY,
                w: rect.width,
                h: rect.height,
                left: parseInt(element.style.left, 10) || 0,
                top: parseInt(element.style.top, 10) || 0,
                cropX: Number(element.dataset.cropX || 50),
                cropY: Number(element.dataset.cropY || 50)
            };
            element.setPointerCapture(event.pointerId);
            selectEditorElement(element);
            event.preventDefault();
        });
        element.addEventListener('pointermove', (event) => {
            if (!move) return;
            const dx = event.clientX - move.x;
            const dy = event.clientY - move.y;
            if (move.type === 'resize') {
                element.style.width = `${Math.max(80, snap(move.w + dx))}px`;
                element.style.height = `${Math.max(60, snap(move.h + dy))}px`;
            } else if (move.type === 'crop') {
                element.dataset.cropX = String(Math.min(100, Math.max(0, move.cropX + dx / 3)));
                element.dataset.cropY = String(Math.min(100, Math.max(0, move.cropY + dy / 3)));
                applyImageStyles(element);
            } else {
                element.style.left = `${snap(move.left + dx)}px`;
                element.style.top = `${snap(move.top + dy)}px`;
            }
        });
        element.addEventListener('pointerup', () => {
            if (move) pushHistory();
            move = null;
        });
    }

    function snap(value) {
        return Math.round(value / 8) * 8;
    }

    function snapAllElements() {
        document.querySelectorAll('.canvas-image, .free-text-block').forEach((element) => {
            element.style.left = `${snap(parseInt(element.style.left, 10) || 0)}px`;
            element.style.top = `${snap(parseInt(element.style.top, 10) || 0)}px`;
        });
        pushHistory();
    }

    function removeSelectedImage() {
        if (editor.selectedType !== 'image' || !editor.selected) return;
        editor.selected.remove();
        clearSelection();
        pushHistory();
    }

    function serializeContent(options = {}) {
        const includeStats = options.includeStats !== undefined ? options.includeStats : true;
        const content = {};

        content.desc = document.getElementById('modal-desc')?.innerHTML || '';
        if (includeStats) {
            content.stats = {};
            document.querySelectorAll('.stat-value[data-editor-field]').forEach((item) => {
                content.stats[item.dataset.editorField] = item.textContent.trim();
            });
        }
        content.curiosities = Array.from(document.querySelectorAll('#modal-curis .curi-item'))
            .map((item) => item.innerHTML.trim())
            .filter(Boolean);
        content.images = Array.from(document.querySelectorAll('.canvas-image')).map(serializeImageElement);
        content.textBlocks = Array.from(document.querySelectorAll('.free-text-block')).map((block) => ({
            id: block.dataset.editorId,
            html: block.innerHTML,
            x: parseInt(block.style.left, 10) || 0,
            y: parseInt(block.style.top, 10) || 0,
            w: parseInt(block.style.width, 10) || block.offsetWidth,
            h: parseInt(block.style.minHeight, 10) || block.offsetHeight,
            style: block.getAttribute('style') || ''
        }));

        content.sections = Array.from(document.querySelectorAll('.country-custom-section')).map(serializeSection);
        return content;
    }

    function serializeImageElement(element) {
        return {
            id: element.dataset.imageId,
            url: element.dataset.url || element.querySelector('img')?.src || '',
            x: parseInt(element.style.left, 10) || 0,
            y: parseInt(element.style.top, 10) || 0,
            w: parseInt(element.style.width, 10) || element.offsetWidth,
            h: parseInt(element.style.height, 10) || element.offsetHeight,
            z: parseInt(element.style.zIndex, 10) || 50,
            rotate: element.dataset.rotate || 0,
            brightness: element.dataset.brightness || 100,
            contrast: element.dataset.contrast || 100,
            saturate: element.dataset.saturate || 100,
            temperature: element.dataset.temperature || 0,
            hue: element.dataset.hue || 0,
            vignette: element.dataset.vignette || 0,
            blur: element.dataset.blur || 0,
            opacity: element.dataset.opacity || 100,
            radius: element.dataset.radius || 4,
            scale: element.dataset.scale || 100,
            cropX: element.dataset.cropX || 50,
            cropY: element.dataset.cropY || 50,
            flipX: element.dataset.flipX || false,
            flipY: element.dataset.flipY || false
        };
    }

    function serializeSection(section) {
        const image = section.querySelector('.section-image');
        return {
            id: section.dataset.sectionId,
            title: section.querySelector('.custom-section-title')?.innerHTML || '',
            desc: section.querySelector('.custom-section-desc')?.innerHTML || '',
            gap: section.dataset.gap || 20,
            radius: section.dataset.radius || 14,
            image: image ? serializeImageElement(image) : null
        };
    }

    function restoreContent(content = {}) {
        editor.restoring = true;
        if (content.desc !== undefined) document.getElementById('modal-desc').innerHTML = sanitizeEditorHtml(content.desc);
        if (content.stats) {
            Object.entries(content.stats).forEach(([key, value]) => {
                const node = document.querySelector(`.stat-value[data-editor-field="${key}"]`);
                if (node) node.textContent = value;
            });
        }
        if (Array.isArray(content.curiosities)) {
            document.getElementById('modal-curis').innerHTML = content.curiosities.map((item) => `<div class="curi-item">${sanitizeEditorHtml(item)}</div>`).join('');
        }
        renderCanvasImages(content.images || []);
        renderFreeTextBlocks(content.textBlocks || []);
        renderCustomSections(content.sections || []);
        editor.restoring = false;
        prepareEditableElements();
    }

    function renderCanvasImages(images = []) {
        currentImages = images;
        document.querySelectorAll('.canvas-image').forEach((e) => e.remove());
        currentImages.forEach((img) => addImageToCanvas(img.url, img.x, img.y, img.w, img.h, img));
    }

    function renderFreeTextBlocks(blocks = []) {
        document.querySelectorAll('.free-text-block').forEach((node) => node.remove());
        blocks.forEach((block) => addFreeTextBlock(block, true));
    }

    function renderCustomSections(sections = []) {
        const root = getSectionsRoot();
        root.innerHTML = '';
        sections.forEach((section) => createCustomSection(section));
    }

    async function submitProposal() {
        const countryId = getCurrentCountryId();
        if (!countryId) return;
        const diff = serializeContent({ includeStats: isSuperAdmin() });

        try {
            const res = await apiFetch('/api/commits', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ country_id: countryId, message: `Atualizacao editorial: ${countryId}`, diff })
            });

            if (res.ok) {
                showToast('Proposta enviada com sucesso.');
                closeEditor(false);
            } else {
                const data = await res.json().catch(() => ({}));
                showEditorNotice(data.detail || 'Erro ao submeter proposta.');
            }
        } catch (err) {
            showEditorNotice('Erro de ligacao ao servidor.');
        }
    }

    async function publishCountryContent() {
        if (!isSuperAdmin()) {
            showEditorNotice('Apenas SUPER ADMINS podem publicar diretamente.');
            return;
        }
        const countryId = getCurrentCountryId();
        if (!countryId) return;

        try {
            const res = await apiFetch(`/api/countries/${encodeURIComponent(countryId)}/content`, {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(serializeContent({ includeStats: true }))
            });
            if (!res.ok) throw new Error('publish');
            showToast('Conteúdo publicado com sucesso.');
            closeEditor(false);
        } catch (err) {
            showEditorNotice('Não foi possível publicar o conteúdo.');
        }
    }

    async function fetchAndRenderCountryData(countryId) {
        try {
            const res = await apiFetch(`/api/countries/${encodeURIComponent(countryId)}`);
            if (res.ok) {
                const data = await res.json();
                const content = data.content || {};
                if (content.desc !== undefined) document.getElementById('modal-desc').innerHTML = sanitizeEditorHtml(content.desc);
                if (content.stats) {
                    prepareEditableElements();
                    Object.entries(content.stats).forEach(([key, value]) => {
                        const node = document.querySelector(`.stat-value[data-editor-field="${key}"]`);
                        if (node) node.textContent = value;
                    });
                }
                if (Array.isArray(content.curiosities)) {
                    document.getElementById('modal-curis').innerHTML = content.curiosities.map((item) => `<div class="curi-item">${sanitizeEditorHtml(item)}</div>`).join('');
                }
                renderCanvasImages(Array.isArray(content.images) ? content.images : []);
                renderFreeTextBlocks(Array.isArray(content.textBlocks) ? content.textBlocks : []);
                renderCustomSections(Array.isArray(content.sections) ? content.sections : []);
                prepareEditableElements();
            }
        } catch (err) {
            // Non-blocking country data sync.
        }
    }

    function pushHistory() {
        if (!isEditing || editor.restoring) return;
        const snapshot = JSON.stringify(serializeContent({ includeStats: true }));
        if (editor.history[editor.history.length - 1] === snapshot) return;
        editor.history.push(snapshot);
        editor.future = [];
        renderEditorMenu();
    }

    let historyTimer = null;
    function pushHistoryDeferred() {
        window.clearTimeout(historyTimer);
        historyTimer = window.setTimeout(pushHistory, 220);
    }

    function undoEditor() {
        if (editor.history.length <= 1) return;
        const current = editor.history.pop();
        editor.future.push(current);
        restoreContent(JSON.parse(editor.history[editor.history.length - 1]));
        renderEditorMenu();
    }

    function redoEditor() {
        if (!editor.future.length) return;
        const next = editor.future.pop();
        editor.history.push(next);
        restoreContent(JSON.parse(next));
        renderEditorMenu();
    }

    function togglePreview() {
        editor.preview = !editor.preview;
        document.body.classList.toggle('country-editor-preview', editor.preview);
        document.getElementById('editor-preview').textContent = editor.preview ? 'Voltar a edição' : 'Pré-visualizar';
    }

    function showEditorNotice(message) {
        showToast(message);
    }

    async function checkForRejections() {
        try {
            const res = await apiFetch('/api/commits/me', {
                credentials: 'include'
            });

            if (res.ok) {
                const commits = await res.json();
                const rejected = commits.find((c) => c.status === 'REJECTED' && c.rejection_note);
                if (rejected) {
                    document.getElementById('admin-rejection-note').textContent = rejected.rejection_note;
                    document.getElementById('admin-notification').classList.add('active');
                }
            }
        } catch (err) {
            // Rejection notifications are non-critical.
        }
    }

    function showToast(msg) {
        const toast = document.getElementById('toast');
        if (!toast) return;

        toast.textContent = msg;
        toast.style.transform = 'translateX(-50%) translateY(0)';
        setTimeout(() => {
            toast.style.transform = 'translateX(-50%) translateY(60px)';
        }, 3000);
    }

    async function hydrateAdminSession() {
        localStorage.removeItem('admin_token');
        try {
            const res = await apiFetch('/api/admin/me', { credentials: 'include' });
            if (!res.ok) throw new Error('session');
            const user = await res.json();
            setStoredAdminUser(user);
            updateLoginButtonState();
            if (user.role === 'STANDARD_ADMIN' || user.role === 'SUPER_ADMIN') {
                setupStandardAdminEditor();
                checkForRejections();
            }
        } catch {
            localStorage.removeItem('admin_user');
            updateLoginButtonState();
        }
    }

    updateLoginButtonState();
    hydrateAdminSession();

    if (sessionStorage.getItem('admin_open_login') === '1') {
        sessionStorage.removeItem('admin_open_login');
        openLoginModal();
    }
});

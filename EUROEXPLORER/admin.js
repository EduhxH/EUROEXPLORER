// admin.js — Europa Explorer CMS
document.addEventListener('DOMContentLoaded', () => {

    // ─────────────────────────────────────────────────────────
    //  STEP 1: Inject modal HTML into body (always)
    // ─────────────────────────────────────────────────────────
    const modalHtml = `
        <div id="admin-login-modal">
            <div class="admin-card">
                <div class="admin-card-logo">
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                        <circle cx="16" cy="16" r="15" stroke="#d9b45f" stroke-width="1.5"/>
                        <text x="16" y="20" text-anchor="middle" font-size="13" fill="#d9b45f" font-family="Cinzel, serif">EU</text>
                    </svg>
                </div>
                <h2>Admin Login</h2>
                <input type="text" id="admin-username" placeholder="Username" autocomplete="username">
                <input type="password" id="admin-password" placeholder="Password" autocomplete="current-password">
                <button id="admin-submit-login">Entrar</button>
                <button class="cancel" id="admin-cancel-login">Cancelar</button>
                <p id="admin-login-error">Credenciais inválidas. Tente novamente.</p>
            </div>
        </div>
        <div class="admin-notification" id="admin-notification">
            <div class="admin-notif-icon">✕</div>
            <div>
                <strong>Proposta Rejeitada</strong><br>
                <span id="admin-rejection-note"></span>
            </div>
            <button class="admin-notif-close" onclick="this.closest('.admin-notification').classList.remove('active')">Fechar</button>
        </div>
        <div id="admin-toolbar" class="admin-toolbar" style="display:none;">
            <label class="btn-toolbar" style="cursor:pointer">
                ＋ Adicionar Imagem
                <input type="file" id="admin-upload-image" accept="image/*" style="display:none">
            </label>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // ─────────────────────────────────────────────────────────
    //  STEP 2: Inject LOGIN ADMIN button wherever nav exists
    // ─────────────────────────────────────────────────────────
    function injectLoginButton(container) {
        if (!container || container.querySelector('#auth-login-btn')) return;
        const btn = document.createElement('button');
        btn.id = 'auth-login-btn';
        btn.textContent = 'LOGIN ADMIN';
        container.appendChild(btn);
    }

    // Inject into intro-screen nav (visible on first page load)
    injectLoginButton(document.querySelector('.intro-nav-meta'));
    // Inject into globe header (visible after entering the map)
    injectLoginButton(document.querySelector('.hdr-meta'));

    // When globe screen activates, also inject there
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

    // ─────────────────────────────────────────────────────────
    //  STEP 3: Modal open/close logic (delegated to document)
    // ─────────────────────────────────────────────────────────
    const loginModal = document.getElementById('admin-login-modal');

    document.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'auth-login-btn') {
            const token = localStorage.getItem('admin_token');
            const userStr = localStorage.getItem('admin_user');
            if (token && userStr) {
                const user = JSON.parse(userStr);
                if (user.role === 'SUPER_ADMIN') {
                    openSuperAdminDashboard();
                } else {
                    // Logout
                    localStorage.removeItem('admin_token');
                    localStorage.removeItem('admin_user');
                    location.reload();
                }
            } else {
                loginModal.classList.add('active');
            }
        }
    });

    document.getElementById('admin-cancel-login').addEventListener('click', () => {
        loginModal.classList.remove('active');
        document.getElementById('admin-login-error').style.display = 'none';
    });

    // Close modal on backdrop click
    loginModal.addEventListener('click', (e) => {
        if (e.target === loginModal) {
            loginModal.classList.remove('active');
        }
    });

    // Enter key submits login
    document.getElementById('admin-password').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('admin-submit-login').click();
    });

    // ─────────────────────────────────────────────────────────
    //  STEP 4: Login form submission
    // ─────────────────────────────────────────────────────────
    document.getElementById('admin-submit-login').addEventListener('click', async () => {
        const username = document.getElementById('admin-username').value.trim();
        const password = document.getElementById('admin-password').value;
        const errEl = document.getElementById('admin-login-error');
        errEl.style.display = 'none';

        if (!username || !password) {
            errEl.textContent = 'Preencha o utilizador e a senha.';
            errEl.style.display = 'block';
            return;
        }

        try {
            const res = await fetch('http://localhost:8000/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            if (res.ok) {
                const data = await res.json();
                localStorage.setItem('admin_token', data.access_token);
                localStorage.setItem('admin_user', JSON.stringify(data.user));
                loginModal.classList.remove('active');
                updateLoginButtonState();
                if (data.user.role === 'SUPER_ADMIN') {
                    openSuperAdminDashboard();
                } else {
                    setupStandardAdminEditor();
                    checkForRejections(data.access_token);
                }
            } else {
                errEl.textContent = 'Credenciais inválidas.';
                errEl.style.display = 'block';
            }
        } catch (err) {
            errEl.textContent = 'Servidor offline. Certifique-se de que o backend está a correr.';
            errEl.style.display = 'block';
        }
    });

    // ─────────────────────────────────────────────────────────
    //  STEP 5: Update button text/color based on auth state
    // ─────────────────────────────────────────────────────────
    function updateLoginButtonState() {
        const token = localStorage.getItem('admin_token');
        const userStr = localStorage.getItem('admin_user');

        document.querySelectorAll('#auth-login-btn').forEach(btn => {
            if (token && userStr) {
                const user = JSON.parse(userStr);
                btn.textContent = user.role === 'SUPER_ADMIN' ? '⚙ DASHBOARD' : '⇦ LOGOUT';
                btn.classList.add('logged-in');
            } else {
                btn.textContent = 'LOGIN ADMIN';
                btn.classList.remove('logged-in');
            }
        });
    }

    function openSuperAdminDashboard() {
        // Open React admin dashboard in new tab (when available)
        // For now show a styled notice
        const existing = document.getElementById('super-admin-notice');
        if (existing) { existing.remove(); return; }
        const notice = document.createElement('div');
        notice.id = 'super-admin-notice';
        notice.innerHTML = `
            <div class="sa-notice-card">
                <div class="sa-notice-logo">⚙</div>
                <h3>Dashboard de Administrador Superior</h3>
                <p>Para abrir o painel React completo, execute este comando no terminal:</p>
                <code>cd frontend-admin &amp;&amp; npm install &amp;&amp; npm run dev</code>
                <p style="margin-top:12px; color: var(--c-text-dim); font-size:0.8rem;">Depois abra <strong>http://localhost:3000</strong> num novo separador.</p>
                <button onclick="document.getElementById('super-admin-notice').remove()">Fechar</button>
            </div>
        `;
        document.body.appendChild(notice);
    }

    // ─────────────────────────────────────────────────────────
    //  STEP 6: Standard Admin Editor (inside country modal)
    // ─────────────────────────────────────────────────────────
    let currentImages = [];
    let isEditing = false;
    let originalDesc = '';

    function setupStandardAdminEditor() {
        const countryModal = document.getElementById('country-modal');
        if (!countryModal) return;

        // Watch for country modal opening
        const observer = new MutationObserver(() => {
            if (countryModal.classList.contains('active')) {
                injectEditorControls();
                const countryId = document.getElementById('modal-country-name')?.textContent;
                if (countryId) fetchAndRenderCountryData(countryId);
            } else {
                document.querySelectorAll('.canvas-image').forEach(e => e.remove());
                isEditing = false;
            }
        });
        observer.observe(countryModal, { attributes: true });

        // If already open
        if (countryModal.classList.contains('active')) {
            injectEditorControls();
        }
    }

    function injectEditorControls() {
        const ccFooter = document.querySelector('.cc-footer');
        if (!ccFooter || document.getElementById('admin-edit-btn')) return;

        const editBtn = document.createElement('button');
        editBtn.id = 'admin-edit-btn';
        editBtn.className = 'btn-stamp';
        editBtn.style.cssText = 'background:#173d83; border:1px solid rgba(255,204,0,0.3);';
        editBtn.textContent = '✏ EDITAR PAÍS';
        ccFooter.insertBefore(editBtn, ccFooter.firstChild);
        editBtn.addEventListener('click', toggleEditMode);

        // Image upload
        document.getElementById('admin-upload-image').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const formData = new FormData();
            formData.append('file', file);
            try {
                const res = await fetch('http://localhost:8000/api/upload', {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('admin_token') },
                    body: formData
                });
                const data = await res.json();
                if (data.url) addImageToCanvas(data.url, 20, 20, 220, 160);
            } catch (err) {
                alert('Erro no upload: ' + err);
            }
        });
    }

    function toggleEditMode() {
        isEditing = !isEditing;
        const modal = document.querySelector('.country-card');
        const descEl = document.getElementById('modal-desc');
        const editBtn = document.getElementById('admin-edit-btn');
        const toolbar = document.getElementById('admin-toolbar');

        if (isEditing) {
            modal.classList.add('admin-edit-mode');
            editBtn.textContent = '✕ CANCELAR';
            editBtn.style.background = '#C0392B';
            toolbar.style.display = 'flex';
            originalDesc = descEl.innerHTML;
            descEl.setAttribute('contenteditable', 'true');
            descEl.focus();
            document.querySelectorAll('.canvas-image').forEach(el => el.classList.add('draggable'));

            // Inject submit button if not present
            if (!document.getElementById('admin-submit-proposal')) {
                const submitBtn = document.createElement('button');
                submitBtn.id = 'admin-submit-proposal';
                submitBtn.className = 'btn-stamp';
                submitBtn.style.background = '#4fb98b';
                submitBtn.textContent = '✔ ENVIAR REQUEST';
                document.querySelector('.cc-footer').appendChild(submitBtn);
                submitBtn.addEventListener('click', submitProposal);
            } else {
                document.getElementById('admin-submit-proposal').style.display = '';
            }
        } else {
            modal.classList.remove('admin-edit-mode');
            editBtn.textContent = '✏ EDITAR PAÍS';
            editBtn.style.background = '#173d83';
            toolbar.style.display = 'none';
            descEl.setAttribute('contenteditable', 'false');
            descEl.innerHTML = originalDesc;
            document.querySelectorAll('.canvas-image').forEach(el => el.classList.remove('draggable'));
            const submitBtn = document.getElementById('admin-submit-proposal');
            if (submitBtn) submitBtn.style.display = 'none';
            const countryId = document.getElementById('modal-country-name')?.textContent;
            if (countryId) fetchAndRenderCountryData(countryId);
        }
    }

    async function submitProposal() {
        const countryId = document.getElementById('modal-country-name')?.textContent;
        const descEl = document.getElementById('modal-desc');
        const imageNodes = document.querySelectorAll('.canvas-image');
        const imagesData = Array.from(imageNodes).map(node => ({
            url: node.querySelector('img').src,
            x: parseInt(node.style.left) || 0,
            y: parseInt(node.style.top) || 0,
            w: parseInt(node.style.width) || 200,
            h: parseInt(node.style.height) || 150
        }));
        const diff = { desc: descEl.innerHTML, images: imagesData };

        try {
            const res = await fetch('http://localhost:8000/api/commits', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
                },
                body: JSON.stringify({ country_id: countryId, message: 'Alteração de conteúdo', diff })
            });
            if (res.ok) {
                showToast('Proposta enviada com sucesso!');
                toggleEditMode();
            } else {
                alert('Erro ao submeter proposta.');
            }
        } catch (err) {
            alert('Erro de ligação ao servidor.');
        }
    }

    async function fetchAndRenderCountryData(countryId) {
        try {
            const res = await fetch(`http://localhost:8000/api/countries/${encodeURIComponent(countryId)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.content?.images?.length) {
                    currentImages = data.content.images;
                    renderCanvasImages();
                }
                if (data.content?.desc) {
                    document.getElementById('modal-desc').innerHTML = data.content.desc;
                }
            }
        } catch (e) { /* silently fail */ }
    }

    function renderCanvasImages() {
        const container = document.querySelector('.cc-body');
        if (!container) return;
        container.style.position = 'relative';
        document.querySelectorAll('.canvas-image').forEach(e => e.remove());
        currentImages.forEach(img => addImageToCanvas(img.url, img.x, img.y, img.w, img.h));
    }

    function addImageToCanvas(url, x, y, w, h) {
        const container = document.querySelector('.cc-body');
        if (!container) return;
        const wrapper = document.createElement('div');
        wrapper.className = 'canvas-image' + (isEditing ? ' draggable' : '');
        wrapper.style.cssText = `position:absolute; left:${x}px; top:${y}px; width:${w}px; height:${h}px; z-index:50;`;
        wrapper.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;pointer-events:none;"><div class="resize-handle"></div>`;
        container.appendChild(wrapper);

        let isDragging = false, isResizing = false;
        let startX, startY, startW, startH, startLeft, startTop;

        wrapper.addEventListener('mousedown', (e) => {
            if (!isEditing) return;
            isResizing = e.target.classList.contains('resize-handle');
            isDragging = !isResizing;
            startX = e.clientX; startY = e.clientY;
            startW = wrapper.offsetWidth; startH = wrapper.offsetHeight;
            startLeft = parseInt(wrapper.style.left); startTop = parseInt(wrapper.style.top);
            e.stopPropagation(); e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                wrapper.style.left = (startLeft + e.clientX - startX) + 'px';
                wrapper.style.top = (startTop + e.clientY - startY) + 'px';
            } else if (isResizing) {
                wrapper.style.width = Math.max(80, startW + e.clientX - startX) + 'px';
                wrapper.style.height = Math.max(60, startH + e.clientY - startY) + 'px';
            }
        });

        document.addEventListener('mouseup', () => { isDragging = false; isResizing = false; });
    }

    // ─────────────────────────────────────────────────────────
    //  STEP 7: Check rejection notifications
    // ─────────────────────────────────────────────────────────
    async function checkForRejections(token) {
        try {
            const res = await fetch('http://localhost:8000/api/commits/me', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (res.ok) {
                const commits = await res.json();
                const rejected = commits.find(c => c.status === 'REJECTED' && c.rejection_note);
                if (rejected) {
                    document.getElementById('admin-rejection-note').textContent = rejected.rejection_note;
                    document.getElementById('admin-notification').classList.add('active');
                }
            }
        } catch (err) { /* silently fail */ }
    }

    // ─────────────────────────────────────────────────────────
    //  STEP 8: Toast helper
    // ─────────────────────────────────────────────────────────
    function showToast(msg) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = msg;
        toast.style.transform = 'translateX(-50%) translateY(0)';
        setTimeout(() => { toast.style.transform = 'translateX(-50%) translateY(60px)'; }, 3000);
    }

    // ─────────────────────────────────────────────────────────
    //  INIT
    // ─────────────────────────────────────────────────────────
    updateLoginButtonState();

    // If already logged in as standard admin, set up editor immediately
    const savedUser = localStorage.getItem('admin_user');
    if (savedUser) {
        const user = JSON.parse(savedUser);
        if (user.role === 'STANDARD_ADMIN') {
            setupStandardAdminEditor();
            checkForRejections(localStorage.getItem('admin_token'));
        }
    }
});

const AUTHORIZED_EMAILS = ['gadalicante@gmail.com', 'copg279@gmail.com', 'adamus03248@gmail.com', 'davidmesi83@gmail.com', 'pamiseseg@gmail.com', 'policia.g496@gmail.com', 'verdeguer279@gmail.com', 'cambiar_nombre6@gmail.com'];
const ADMIN_EMAIL = 'copg279@gmail.com';

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const db = firebase.database();
const auth = firebase.auth();

const BUTTONS_NODE = 'menuButtons';
const USERS_NODE = 'usuarios_google'; 

let menuButtonsData = {};
let currentMenuPath = [];
let isEditMode = false;
let currentUserEmail = "";
let draggedItem = null; // Variable para recordar qué botón estamos arrastrando

const openSidebar = () => { renderSidebarTree(null, document.getElementById('sidebar-tree-container')); document.getElementById('sidebar-menu').style.transform = "translateX(0)"; document.getElementById('sidebar-overlay').style.display = "block"; }
const closeSidebar = () => { document.getElementById('sidebar-menu').style.transform = "translateX(-100%)"; document.getElementById('sidebar-overlay').style.display = "none"; }
document.getElementById('close-sidebar').onclick = closeSidebar;
document.getElementById('sidebar-overlay').onclick = closeSidebar;

window.addEventListener('popstate', (event) => {
    if (document.getElementById('iframe-viewer-area').style.display === 'block') { closeContent(); } 
    else if (currentMenuPath.length > 0) { currentMenuPath.pop(); renderMenuButtons(); }
});
history.replaceState({ page: 'root' }, '', '');

function navigateToFolder(key) { currentMenuPath.push(key); history.pushState({ page: 'folder', id: key }, '', ''); renderMenuButtons(); }

function closeContent() {
    const iframeArea = document.getElementById('iframe-viewer-area');
    iframeArea.style.display = 'none'; 
    document.getElementById('main-scroll-area').style.display = 'block'; 
    document.getElementById('content-iframe').src = "about:blank"; 
    document.getElementById('iframe-back-float').style.display = 'none';
}

function renderMenuButtons() {
    const grid = document.getElementById('main-menu-grid'); grid.innerHTML = '';
    const parentId = currentMenuPath.length > 0 ? currentMenuPath[currentMenuPath.length - 1] : null;
    const buttons = Object.entries(menuButtonsData).filter(([k, v]) => v.parent == parentId).sort((a,b) => a[1].order - b[1].order);

    if(isEditMode) {
        const addBtn = document.createElement('div'); addBtn.className = 'tech-btn full-width'; 
        addBtn.style.border = '2px dashed var(--cyan)'; addBtn.style.background = 'rgba(0, 240, 255, 0.05)';
        addBtn.innerHTML = '<span class="tech-label" style="color:var(--cyan);"><i class="fas fa-plus"></i> AÑADIR NUEVO NODO</span>'; 
        addBtn.onclick = () => { document.getElementById('add-button-modal').style.display='flex'; }; grid.appendChild(addBtn);
    }

    buttons.forEach(([key, v]) => {
        const isFull = v.size === 'full-width';
        const btn = document.createElement('div'); btn.className = `tech-btn ${isFull ? 'full-width' : ''}`;
        
        if (v.color === '#ef4444' || v.color === '#dc2626') btn.classList.add('color-alert'); 
        else if (v.color === '#f59e0b') btn.classList.add('color-warning'); 
        else if (v.color === '#10b981' || v.color === '#16a34a') btn.classList.add('color-success');
        
        const editIcon = isEditMode ? `<div class="edit-mode-icon">EDIT</div>` : '';
        btn.innerHTML = `<span class="tech-label">${v.text}</span>${editIcon}`;
        
        // --- LOGICA ARRASTRAR Y SOLTAR (Solo en Modo Edición) ---
        if (isEditMode) {
            btn.setAttribute('draggable', 'true');
            btn.style.cursor = 'grab';
            
            // Al coger el botón
            btn.addEventListener('dragstart', function(e) {
                draggedItem = { key: key, order: v.order };
                setTimeout(() => this.classList.add('dragging'), 0);
            });
            
            // Al soltarlo en cualquier sitio
            btn.addEventListener('dragend', function() {
                this.classList.remove('dragging');
                draggedItem = null;
            });
            
            // Al pasar por encima de otro botón (Permite soltar)
            btn.addEventListener('dragover', function(e) {
                e.preventDefault();
                this.classList.add('drag-over');
            });
            
            // Al salir de encima de un botón
            btn.addEventListener('dragleave', function() {
                this.classList.remove('drag-over');
            });
            
            // Al soltar el botón arrastrado SOBRE este botón
            btn.addEventListener('drop', function(e) {
                e.preventDefault();
                this.classList.remove('drag-over');
                
                if (draggedItem && draggedItem.key !== key) {
                    // Magia: Intercambiamos el orden de los dos botones en Firebase
                    db.ref(`${BUTTONS_NODE}/${draggedItem.key}`).update({ order: v.order });
                    db.ref(`${BUTTONS_NODE}/${key}`).update({ order: draggedItem.order });
                }
            });
            
            // Clic normal para editar
            btn.onclick = (e) => { openEditModal(key, v); };
        } else {
            // Clic normal en modo vista
            btn.onclick = (e) => { 
                if (v.type === 'parent') { navigateToFolder(key); } 
                else { showContent(v); } 
            };
        }
        
        grid.appendChild(btn);
    });
    updateTitle(parentId);
}

function updateTitle(parentId) {
    const titleEl = document.getElementById('main-title-text');
    if (!parentId) { titleEl.innerText = 'UNIDAD GAD: INTERFAZ DE MANDO'; } 
    else { titleEl.innerText = menuButtonsData[parentId]?.text || 'SUBMENÚ'; }
}

function renderSidebarTree(parentId, container) {
    container.innerHTML = '';
    const items = Object.entries(menuButtonsData).filter(([k, v]) => v.parent == parentId).sort((a,b) => a[1].order - b[1].order);
    if (items.length === 0 && parentId === null) { container.innerHTML = '<div style="padding:15px; text-align:center;">Cargando menú...</div>'; return; }
    items.forEach(([key, data]) => {
        const div = document.createElement('div');
        const row = document.createElement('div'); row.className = 'sidebar-item';
        const icon = data.type === 'parent' ? 'fa-folder' : 'fa-link';
        row.innerHTML = `<i class="fas ${icon}"></i> ${data.text}`;
        row.onclick = (e) => {
            e.stopPropagation();
            if (data.type === 'parent') {
                let childrenDiv = div.querySelector('.children-container');
                if (!childrenDiv) { childrenDiv = document.createElement('div'); childrenDiv.className = 'children-container'; childrenDiv.style.paddingLeft = '15px'; childrenDiv.style.borderLeft = '1px solid #333'; div.appendChild(childrenDiv); renderSidebarTree(key, childrenDiv); } else { childrenDiv.remove(); }
            } else { showContent(data); closeSidebar(); }
        };
        div.appendChild(row); container.appendChild(div);
    });
}

// Limpiado: Ahora solo carga enlaces (href)
function showContent(data) {
    if (!data.href) return alert("Este botón no tiene enlace configurado.");
    history.pushState({ page: 'content' }, '', '');
    const viewer = document.getElementById('iframe-viewer-area'); const iframe = document.getElementById('content-iframe');
    document.getElementById('main-scroll-area').style.display = 'none'; viewer.style.display = 'block'; document.getElementById('iframe-back-float').style.display = 'block';
    iframe.src = data.href; 
}

// Limpiado: Ya no recoge htmlCode
function openEditModal(key, data) {
    document.getElementById('edit-button-modal').style.display = 'flex';
    document.getElementById('edit-button-id').value = key; 
    document.getElementById('edit-button-text').value = data.text; 
    document.getElementById('edit-button-href').value = data.href || ''; 
    document.getElementById('edit-button-size').value = data.size || 'normal';
    let colorVal = '#00f0ff'; if(data.color === '#ef4444' || data.color === '#dc2626') colorVal = '#ef4444'; if(data.color === '#f59e0b') colorVal = '#f59e0b'; if(data.color === '#10b981' || data.color === '#16a34a') colorVal = '#10b981';
    document.getElementById('edit-button-color-select').value = colorVal;
}

// Limpiado: Ya no guarda htmlCode
document.getElementById('save-button-changes').onclick = () => {
    const id = document.getElementById('edit-button-id').value;
    db.ref(`${BUTTONS_NODE}/${id}`).update({ 
        text: document.getElementById('edit-button-text').value, 
        href: document.getElementById('edit-button-href').value, 
        size: document.getElementById('edit-button-size').value, 
        color: document.getElementById('edit-button-color-select').value 
    });
    document.getElementById('edit-button-modal').style.display = 'none';
};

// Limpiado: Ya no guarda htmlCode
document.getElementById('save-new-button').onclick = async () => {
    const text = document.getElementById('new-button-text').value; if(!text) return alert("Escribe un nombre para el botón");
    const parent = currentMenuPath.length ? currentMenuPath[currentMenuPath.length-1] : null;
    const snap = await db.ref(BUTTONS_NODE).orderByChild('parent').equalTo(parent).once('value');
    const order = (snap.val() ? Object.keys(snap.val()).length : 0) + 1;
    
    db.ref(BUTTONS_NODE).push({ 
        text: text, 
        type: document.getElementById('new-button-type').value, 
        size: document.getElementById('new-button-size').value, 
        parent: parent, 
        order: order, 
        color: '#00f0ff' 
    });
    
    document.getElementById('new-button-text').value = ''; // Limpiar input
    document.getElementById('add-button-modal').style.display='none';
};

window.delBtn = (key) => { if(confirm('¿Seguro que quieres eliminar este nodo?')) { db.ref(`${BUTTONS_NODE}/${key}`).remove(); document.getElementById('edit-button-modal').style.display='none'; } };
document.getElementById('admin-toggle-btn').onclick = () => { const p = document.getElementById('admin-panel'); p.style.display = (p.style.display === 'flex') ? 'none' : 'flex'; setTimeout(() => { if (p.style.display === 'flex') p.scrollIntoView({ behavior: 'smooth' }); }, 100); };
document.getElementById('show-edit-menu-modal').onclick = () => { isEditMode = !isEditMode; const btn = document.getElementById('show-edit-menu-modal'); if (isEditMode) { btn.innerHTML = '<i class="fas fa-check" style="color:var(--green)"></i> FIN EDICIÓN'; btn.style.borderColor = 'var(--green)'; } else { btn.innerHTML = '<i class="fas fa-edit"></i> EDITAR'; btn.style.borderColor = '#444'; } renderMenuButtons(); };

function sanitizeEmail(email) { return email.replace(/\./g, ','); }
async function getClientIP() { try { const r = await fetch('https://api.ipify.org?format=json'); const d = await r.json(); return d.ip || 'Oculta'; } catch { return 'Oculta'; } }

auth.onAuthStateChanged(async (user) => {
    if (user && AUTHORIZED_EMAILS.includes(user.email)) {
        currentUserEmail = user.email; document.body.classList.add('loaded');
        db.ref(BUTTONS_NODE).on('value', s => { menuButtonsData = s.val() || {}; renderMenuButtons(); document.getElementById('loading-screen').style.opacity = '0'; setTimeout(()=>document.getElementById('loading-screen').style.display='none', 500); });
        const emailKey = sanitizeEmail(user.email); const isAdmin = (user.email === ADMIN_EMAIL); const ip = await getClientIP();
        db.ref(USERS_NODE + '/' + emailKey).transaction(d => d ? { ...d, email: user.email, ultimoAcceso: Date.now(), accesos: (d.accesos||0)+1 } : { email: user.email, accesos: 1, ultimoAcceso: Date.now() });
        db.ref('visitLog').push().set({ email: user.email, timestamp: Date.now(), ip: ip, action: 'login' });
        
        document.getElementById('user-info-display').innerText = `OPERADOR ACTIVO: ${user.email.split('@')[0].toUpperCase()}`;
        
        if(isAdmin) { initAdminFeatures(); } else { document.getElementById('admin-toggle-btn').style.display = 'none'; document.getElementById('user-controls').style.display = 'block'; }
    } else { window.location.href = '/index.html'; }
});

function initAdminFeatures() {
    db.ref(USERS_NODE).on('value', s => {
        const users = s.val() || {}; let total = 0; let html = ''; const listContainer = document.getElementById('user-list-container'); listContainer.innerHTML = '';
        Object.entries(users).forEach(([k, u]) => { total += (u.accesos || 0); html += `<div class="counter-card"><div class="counter-header">${(u.nombre||u.email.split('@')[0]).substring(0,12)}</div><div class="counter-number">${u.accesos}</div></div>`; listContainer.innerHTML += `<div class="cyber-list-item"><div><strong style="color:var(--cyan)">${u.nombre || 'Agente'}</strong><br><span style="font-size:0.8em">${u.email}</span></div><i class="fas fa-trash-alt" style="color:var(--red); cursor:pointer;" onclick="if(confirm('¿Eliminar usuario?')) db.ref('${USERS_NODE}/${k}').remove()"></i></div>`; });
        document.getElementById('counters-row').innerHTML = `<div class="counters-container"><div class="counter-card total"><div class="counter-header">TOTAL ACCESOS</div><div class="counter-number">${total}</div></div>${html}</div>`;
    });
}
document.getElementById('show-manage-users-modal').onclick = () => document.getElementById('manage-users-modal').style.display = 'flex';
document.getElementById('add-user-button').onclick = () => { const e = document.getElementById('new-user-email').value.trim().toLowerCase(); if(e && e.includes('@')) { db.ref(USERS_NODE + '/' + sanitizeEmail(e)).set({ email: e, nombre: document.getElementById('new-user-alias').value || 'Agente', accesos: 0, ultimoAcceso: Date.now() }); alert('Autorizado'); document.getElementById('new-user-email').value = ''; } };
document.getElementById('show-full-log-modal').onclick = async () => { document.getElementById('full-log-modal').style.display = 'flex'; document.getElementById('full-log-container').innerHTML = 'Cargando registros...'; const s = await db.ref('visitLog').limitToLast(100).once('value'); const logs = s.val() ? Object.values(s.val()).reverse() : []; document.getElementById('full-log-container').innerHTML = logs.map(l => `<div style="border-bottom:1px solid #333; padding:8px 5px; display:flex; justify-content:space-between;"><span><span style="color:#888">[${new Date(l.timestamp).toLocaleString()}]</span> <strong style="color:var(--cyan)">${l.email}</strong></span><span style="color:#666; font-size:0.9em">IP: ${l.ip}</span></div>`).join(''); };
document.querySelectorAll('.btn-logout').forEach(b => b.onclick = () => { if(confirm("¿Cerrar sesión segura?")) auth.signOut().then(() => window.location.href = '/index.html'); });
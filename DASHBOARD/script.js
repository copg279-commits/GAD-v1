// =================CONFIGURACIÓN FIREBASE=================
const firebaseConfig = {
    apiKey: "AIzaSyCY8V_P7m8lZUvGbMVlGaa-GVhbmyikmag",
    authDomain: "gad-alicante-v4.firebaseapp.com",
    databaseURL: "https://gad-alicante-v4-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "gad-alicante-v4",
    storageBucket: "gad-alicante-v4.firebasestorage.app",
    messagingSenderId: "119727545224",
    appId: "1:119727545224:web:36880c50d196c456cdb83d"
};
// ========================================================

const AUTHORIZED_EMAILS = [
    'gadalicante@gmail.com', 'copg279@gmail.com', 'adamus03248@gmail.com', 
    'davidmesi83@gmail.com', 'pamiseseg@gmail.com', 'policia.g496@gmail.com', 
    'verdeguer279@gmail.com', 'test@gad.com'
];
const ADMIN_EMAIL = 'copg279@gmail.com';

// Inicialización de Firebase
if (!firebase.apps.length) { 
    firebase.initializeApp(firebaseConfig); 
}
const db = firebase.database();
const auth = firebase.auth();

// Constantes y Variables de Estado
const BUTTONS_NODE = 'menuButtons'; 
const USERS_NODE = 'usuarios_google';
let menuButtonsData = {};
let currentMenuPath = [];
let isEditMode = false;
let currentUserEmail = "";
let draggedItem = null; // Guarda temporalmente el botón que estamos arrastrando

// ================= FUNCIONES DE NAVEGACIÓN (UI) =================

const openSidebar = () => { 
    renderSidebarTree(null, document.getElementById('sidebar-tree-container')); 
    document.getElementById('sidebar-menu').style.transform = "translateX(0)"; 
    document.getElementById('sidebar-overlay').style.display = "block"; 
    
    const floatBtn = document.getElementById('sidebar-toggle-float');
    if(floatBtn) floatBtn.style.opacity = "0";
};

const closeSidebar = () => { 
    document.getElementById('sidebar-menu').style.transform = "translateX(-100%)"; 
    document.getElementById('sidebar-overlay').style.display = "none"; 
    
    const floatBtn = document.getElementById('sidebar-toggle-float');
    if(floatBtn) floatBtn.style.opacity = "1";
};

const closeSidebarBtn = document.getElementById('close-sidebar');
if(closeSidebarBtn) closeSidebarBtn.onclick = closeSidebar;

const sidebarOverlay = document.getElementById('sidebar-overlay');
if(sidebarOverlay) sidebarOverlay.onclick = closeSidebar;

window.addEventListener('popstate', (event) => {
    const iframeArea = document.getElementById('iframe-viewer-area');
    if (iframeArea && iframeArea.style.display === 'block') {
        closeContent();
    } else if (currentMenuPath.length > 0) {
        currentMenuPath.pop();
        renderMenuButtons();
    }
});

history.replaceState({ page: 'root' }, '', '');

function navigateToFolder(key) {
    currentMenuPath.push(key);
    history.pushState({ page: 'folder', id: key }, '', '');
    renderMenuButtons();
}

function closeContent() {
    const iframeArea = document.getElementById('iframe-viewer-area');
    const iframe = document.getElementById('content-iframe');
    const backBtn = document.getElementById('iframe-back-float');
    
    iframe.style.opacity = '0';
    
    setTimeout(() => {
        iframeArea.style.display = 'none'; 
        document.getElementById('main-scroll-area').style.display = 'block'; 
        iframe.src = "about:blank"; 
        if(backBtn) backBtn.style.display = 'none';
    }, 300);
}

// ================= RENDERIZADO DE BOTONES Y DRAG & DROP =================

function renderMenuButtons() {
    const grid = document.getElementById('main-menu-grid'); 
    
    if(!grid) return;
    grid.style.opacity = '0';
    
    setTimeout(() => {
        grid.innerHTML = '';
        const parentId = currentMenuPath.length > 0 ? currentMenuPath[currentMenuPath.length - 1] : null;
        
        // Obtenemos y ordenamos los botones por su propiedad 'order'
        const buttons = Object.entries(menuButtonsData)
            .filter(([k, v]) => v.parent == parentId)
            .sort((a,b) => a[1].order - b[1].order);

        // Botón especial para Añadir (Solo visible en edición)
        if(isEditMode) {
            const addBtn = document.createElement('div'); 
            addBtn.className = 'tech-btn full-width'; 
            addBtn.style.border = '2px dashed var(--cyan-dark)'; 
            addBtn.style.background = 'rgba(0, 240, 255, 0.05)';
            addBtn.innerHTML = '<div class="tech-label" style="color:var(--cyan)"><i class="fas fa-plus-circle fa-lg" style="display:block !important;"></i> AÑADIR NUEVO NODO</div>'; 
            addBtn.onclick = () => { document.getElementById('add-button-modal').style.display='flex'; }; 
            grid.appendChild(addBtn);
        }

        if (buttons.length === 0 && !isEditMode) {
             grid.innerHTML = '<div class="full-width" style="text-align:center; color:#888; padding:20px;">DIRECTORIO VACÍO</div>';
        }

        buttons.forEach(([key, v]) => {
            const isFull = v.size === 'full-width'; 
            const btn = document.createElement('div'); 
            btn.className = `tech-btn ${isFull ? 'full-width' : ''}`;
            
            // Colores
            if (v.color === '#ef4444' || v.color === '#dc2626') btn.classList.add('color-alert'); 
            else if (v.color === '#f59e0b') btn.classList.add('color-warning'); 
            else if (v.color === '#10b981' || v.color === '#16a34a') btn.classList.add('color-success');
            
            const editIcon = isEditMode ? `<div class="edit-mode-icon">EDITAR</div>` : '';
            
            // Estructura limpia sin SVG internos
            btn.innerHTML = `
                <div class="tech-label">
                    ${v.text}
                </div>
                ${editIcon}
            `;

            // === LÓGICA ARRASTRAR Y SOLTAR (Solo activa en Edición) ===
            if (isEditMode) {
                btn.setAttribute('draggable', 'true');
                btn.style.cursor = 'grab';
                
                // Empezamos a arrastrar el botón
                btn.addEventListener('dragstart', function(e) {
                    draggedItem = { key: key, order: v.order };
                    setTimeout(() => this.classList.add('dragging'), 0);
                });
                
                // Soltamos el botón (fuera de zona válida)
                btn.addEventListener('dragend', function() {
                    this.classList.remove('dragging');
                    draggedItem = null;
                });
                
                // Pasamos por encima de otro botón (se ilumina)
                btn.addEventListener('dragover', function(e) {
                    e.preventDefault();
                    this.classList.add('drag-over');
                });
                
                // Salimos de encima de otro botón
                btn.addEventListener('dragleave', function() {
                    this.classList.remove('drag-over');
                });
                
                // SOLTAMOS EL BOTÓN ENCIMA DE OTRO
                btn.addEventListener('drop', function(e) {
                    e.preventDefault();
                    this.classList.remove('drag-over');
                    
                    if (draggedItem && draggedItem.key !== key) {
                        // Firebase: Intercambiamos el número de 'order' entre ambos botones
                        db.ref(`${BUTTONS_NODE}/${draggedItem.key}`).update({ order: v.order });
                        db.ref(`${BUTTONS_NODE}/${key}`).update({ order: draggedItem.order });
                        // Firebase lanzará un evento on('value') automático y re-renderizará la pantalla
                    }
                });
            }
            // =========================================================
            
            // Clic normal
            btn.onclick = (e) => { 
                if (isEditMode) { 
                    openEditModal(key, v); 
                } else { 
                    if (v.type === 'parent') { 
                        navigateToFolder(key); 
                    } else { 
                        showContent(v); 
                    } 
                } 
            };
            grid.appendChild(btn);
        });
        
        updateTitle(parentId);
        grid.style.opacity = '1';

    }, 200);
}

function updateTitle(parentId) {
    const titleEl = document.getElementById('main-title-text');
    const subTitleEl = document.getElementById('user-info-display');
    
    if(!titleEl) return;

    titleEl.style.opacity = 0;
    setTimeout(() => {
        if (!parentId) { 
            titleEl.innerText = 'UNIDAD GAD: INTERFAZ DE MANDO'; 
            if(subTitleEl) subTitleEl.innerText = `OPERADOR ACTIVO: ${currentUserEmail.split('@')[0].toUpperCase()}`;
        } else { 
            const folderName = menuButtonsData[parentId]?.text || 'SUBDIRECTORIO';
            titleEl.innerText = folderName; 
            if(subTitleEl) subTitleEl.innerText = `NIVEL DE ACCESO: SUBDIRECTORIO`;
        }
        titleEl.style.opacity = 1;
    }, 200);
}

// ================= SIDEBAR =================

function renderSidebarTree(parentId, container) {
    container.innerHTML = '';
    const items = Object.entries(menuButtonsData).filter(([k, v]) => v.parent == parentId).sort((a,b) => a[1].order - b[1].order);
    
    if (items.length === 0 && parentId === null) { 
        container.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">Cargando estructura...</div>'; 
        return; 
    }
    
    items.forEach(([key, data]) => {
        const div = document.createElement('div');
        const row = document.createElement('div'); 
        row.className = 'sidebar-item';
        
        const icon = data.type === 'parent' ? 'fa-folder' : 'fa-external-link-alt';
        row.innerHTML = `<i class="fas ${icon}"></i> ${data.text}`;
        
        row.onclick = (e) => {
            e.stopPropagation();
            if (data.type === 'parent') {
                let childrenDiv = div.querySelector('.children-container');
                if (!childrenDiv) { 
                    childrenDiv = document.createElement('div'); 
                    childrenDiv.className = 'children-container'; 
                    div.appendChild(childrenDiv); 
                    renderSidebarTree(key, childrenDiv); 
                    row.querySelector('i').classList.replace('fa-folder', 'fa-folder-open');
                } else { 
                    childrenDiv.remove(); 
                    row.querySelector('i').classList.replace('fa-folder-open', 'fa-folder');
                }
            } else { 
                showContent(data); 
                closeSidebar(); 
            }
        };
        div.appendChild(row); 
        container.appendChild(div);
    });
}


// ================= VISOR DE IFRAME (CON AUTO-RUTAS) =================

function showContent(data) {
    const viewer = document.getElementById('iframe-viewer-area'); 
    const iframe = document.getElementById('content-iframe');
    const backBtn = document.getElementById('iframe-back-float');

    if (!data.href && !data.htmlCode) {
        alert("Este botón no tiene contenido configurado.");
        return;
    }
    
    history.pushState({ page: 'content' }, '', '');
    document.getElementById('main-scroll-area').style.display = 'none'; 
    viewer.style.display = 'block'; 
    
    setTimeout(() => {
         iframe.style.opacity = '1';
         if(backBtn) backBtn.style.display = 'block';
    }, 100);

    // PRIORIDAD 1: Si hay Código HTML (como en tu dashboard antiguo)
    if (data.htmlCode) {
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(data.htmlCode);
        doc.close();
        return;
    }

    // PRIORIDAD 2: Si es un Enlace (URL)
    let finalUrl = data.href.trim();
    finalUrl = finalUrl.replace(/ /g, '%20'); // Corregir espacios para GitHub

    // Si NO es un enlace externo (http) y NO tiene ya el salto de carpeta (../)
    if (!finalUrl.startsWith('http') && !finalUrl.startsWith('../')) {
        // Si empieza por carpeta raíz, quitamos la barra
        if (finalUrl.startsWith('/')) finalUrl = finalUrl.substring(1);
        
        // AÑADIMOS EL SALTO: Como index.html está en /DASHBOARD/, 
        // necesitamos ../ para ir a la carpeta principal de GitHub
        finalUrl = '../' + finalUrl;
    }

    console.log("Cargando recurso en:", finalUrl);
    iframe.src = finalUrl; 
}

// ================= GESTIÓN CRUD (LIMPIADO DE HTML) =================

function openEditModal(key, data) {
    document.getElementById('edit-button-modal').style.display = 'flex';
    document.getElementById('edit-button-id').value = key; 
    document.getElementById('edit-button-text').value = data.text; 
    
    // Si tiene href lo ponemos, si no lo dejamos en blanco
    document.getElementById('edit-button-href').value = data.href || ''; 
    document.getElementById('edit-button-size').value = data.size || 'normal';
    
    let colorVal = '#00f0ff'; 
    if(data.color === '#ef4444' || data.color === '#dc2626') colorVal = '#ef4444';
    if(data.color === '#f59e0b') colorVal = '#f59e0b'; 
    if(data.color === '#10b981' || data.color === '#16a34a') colorVal = '#10b981';
    
    document.getElementById('edit-button-color-select').value = colorVal;
}

document.getElementById('save-button-changes').onclick = () => {
    const id = document.getElementById('edit-button-id').value;
    
    db.ref(`${BUTTONS_NODE}/${id}`).update({ 
        text: document.getElementById('edit-button-text').value, 
        href: document.getElementById('edit-button-href').value, 
        // Ya no enviamos htmlCode
        size: document.getElementById('edit-button-size').value, 
        color: document.getElementById('edit-button-color-select').value 
    });
    
    document.getElementById('edit-button-modal').style.display = 'none';
};

document.getElementById('save-new-button').onclick = async () => {
    const text = document.getElementById('new-button-text').value; 
    if(!text) {
        alert("El nombre del botón es obligatorio");
        return;
    }
    
    const parent = currentMenuPath.length ? currentMenuPath[currentMenuPath.length-1] : null;
    
    // Obtener la cantidad de botones para asignar el nuevo orden al final
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
    
    // Limpiar input y cerrar modal
    document.getElementById('new-button-text').value = '';
    document.getElementById('add-button-modal').style.display = 'none';
};

window.delBtn = (key) => { 
    if(confirm('ADVERTENCIA: ¿Confirmar eliminación del nodo de datos? Esta acción es irreversible.')) { 
        db.ref(`${BUTTONS_NODE}/${key}`).remove(); 
        document.getElementById('edit-button-modal').style.display='none'; 
    } 
};

// ================= CONTROLES DE ADMINISTRADOR =================

const adminToggleBtn = document.getElementById('admin-toggle-btn');
if(adminToggleBtn) {
    adminToggleBtn.onclick = () => { 
        const p = document.getElementById('admin-panel'); 
        if(p.style.display === 'flex') {
            p.style.display = 'none';
            document.getElementById('admin-toggle-btn').innerHTML = '<i class="fas fa-terminal"></i> CONSOLA DE MANDO';
        } else {
            p.style.display = 'flex';
            setTimeout(() => p.scrollIntoView({behavior: "smooth"}), 100);
            document.getElementById('admin-toggle-btn').innerHTML = '<i class="fas fa-chevron-up"></i> OCULTAR CONSOLA';
        }
    };
}

const showEditModalBtn = document.getElementById('show-edit-menu-modal');
if(showEditModalBtn) {
    showEditModalBtn.onclick = () => { 
        isEditMode = !isEditMode; 
        const btn = document.getElementById('show-edit-menu-modal');
        if (isEditMode) {
            btn.innerHTML = '<i class="fas fa-check-circle" style="color:var(--green)"></i> FINALIZAR EDICIÓN';
            btn.style.borderColor = 'var(--green)';
        } else {
            btn.innerHTML = '<i class="fas fa-edit"></i> EDITAR UI';
            btn.style.borderColor = '#444';
        }
        renderMenuButtons(); 
    };
}

// ================= AUTENTICACIÓN Y LOGS =================

function sanitizeEmail(email) { 
    return email.replace(/\./g, ','); 
}

async function getClientIP() { 
    try { 
        const r = await fetch('https://api.ipify.org?format=json'); 
        const d = await r.json(); 
        return d.ip || 'Desconocida'; 
    } catch { 
        return 'Oculta'; 
    } 
}

auth.onAuthStateChanged(async (user) => {
    if (user && AUTHORIZED_EMAILS.includes(user.email)) {
        currentUserEmail = user.email;
        
        db.ref('menuButtons').on('value', s => { 
            menuButtonsData = s.val() || {}; 
            renderMenuButtons(); 
            const loading = document.getElementById('loading-screen');
            if(loading) loading.style.display = 'none';
        });

        const emailKey = sanitizeEmail(user.email); 
        const isAdmin = (user.email === ADMIN_EMAIL); 
        const ip = await getClientIP();
        
        db.ref(USERS_NODE + '/' + emailKey).transaction(d => d ? { ...d, email: user.email, ultimoAcceso: Date.now(), accesos: (d.accesos||0)+1 } : { email: user.email, accesos: 1, ultimoAcceso: Date.now() });
        db.ref('visitLog').push().set({ email: user.email, timestamp: Date.now(), ip: ip, action: 'login' });
        
        if(isAdmin) { 
            initAdminFeatures(); 
        } else { 
            const btn = document.getElementById('admin-toggle-btn');
            if(btn) btn.style.display = 'none';
            const uc = document.getElementById('user-controls');
            if(uc) uc.style.display = 'block'; 
        }

    } else { 
        const loadingScreen = document.getElementById('loading-screen');
        if(loadingScreen) {
            loadingScreen.innerHTML = '<h2 style="color:red; font-family:Orbitron">ACCESO DENEGADO</h2><p style="color:#ccc">Retornando...</p>';
        }
        setTimeout(() => { window.location.href = '../index.html'; }, 2000);
    }
});

function initAdminFeatures() {
    db.ref(USERS_NODE).on('value', s => {
        const users = s.val() || {}; 
        let total = 0; 
        let html = ''; 
        const listContainer = document.getElementById('user-list-container'); 
        
        if(!listContainer) return;
        listContainer.innerHTML = '';
        
        Object.entries(users).forEach(([k, u]) => { 
            total += (u.accesos || 0); 
            html += `<div class="counter-card"><div class="counter-header">${(u.nombre||u.email.split('@')[0]).substring(0,12)}</div><div class="counter-number">${u.accesos}</div></div>`; 
            
            const lastAccess = new Date(u.ultimoAcceso).toLocaleDateString();
            listContainer.innerHTML += `
                <div class="cyber-list-item">
                    <div>
                        <strong style="color:var(--cyan)">${u.nombre || 'Sin Alias'}</strong><br>
                        <span style="font-size:0.8em">${u.email}</span>
                    </div>
                    <div style="text-align:right">
                        <span style="font-size:0.7em; color:#888">Acceso: ${lastAccess}</span><br>
                        <i class="fas fa-trash-alt" style="color:var(--red); cursor:pointer; margin-top:5px;" onclick="if(confirm('¿Eliminar usuario?')) db.ref('${USERS_NODE}/${k}').remove()"></i>
                    </div>
                </div>`; 
        });
        
        const cRow = document.getElementById('counters-row');
        if(cRow) {
            cRow.innerHTML = `<div class="counters-container"><div class="counter-card total"><div class="counter-header">TOTAL ACCESOS</div><div class="counter-number">${total}</div></div>${html}</div>`;
        }
    });
}

const showUsersModalBtn = document.getElementById('show-manage-users-modal');
if(showUsersModalBtn) {
    showUsersModalBtn.onclick = () => document.getElementById('manage-users-modal').style.display = 'flex';
}

const addUserBtn = document.getElementById('add-user-button');
if(addUserBtn) {
    addUserBtn.onclick = () => { 
        const e = document.getElementById('new-user-email').value.trim().toLowerCase(); 
        const alias = document.getElementById('new-user-alias').value;
        if(e && e.includes('@')) { 
            db.ref(USERS_NODE + '/' + sanitizeEmail(e)).set({ email: e, nombre: alias || 'Agente', accesos: 0, ultimoAcceso: Date.now() }); 
            alert('Credenciales autorizadas para: ' + e);
            document.getElementById('new-user-email').value = '';
            document.getElementById('new-user-alias').value = '';
        } else {
            alert("Email inválido");
        }
    };
}

const showLogBtn = document.getElementById('show-full-log-modal');
if(showLogBtn) {
    showLogBtn.onclick = async () => { 
        document.getElementById('full-log-modal').style.display = 'flex'; 
        const container = document.getElementById('full-log-container');
        container.innerHTML = '<div style="text-align:center; padding:20px;">Cargando registros del sistema...</div>'; 
        
        const s = await db.ref('visitLog').limitToLast(150).once('value'); 
        const logs = s.val() ? Object.values(s.val()).reverse() : []; 
        
        container.innerHTML = logs.map(l => {
            const date = new Date(l.timestamp);
            const timeStr = date.toLocaleTimeString();
            const dateStr = date.toLocaleDateString();
            return `
            <div style="border-bottom:1px solid rgba(0,240,255,0.1); padding:8px 5px; display:flex; justify-content:space-between;">
                <span><span style="color:#888">[${dateStr} ${timeStr}]</span> <strong style="color:var(--cyan)">${l.email}</strong></span>
                <span style="color:#666; font-size:0.9em">IP: ${l.ip}</span>
            </div>`;
        }).join(''); 
    };
}

document.querySelectorAll('.btn-logout').forEach(b => {
    b.onclick = () => {
        if(confirm("¿Cerrar sesión segura?")) {
            auth.signOut().then(() => {
                window.location.href = '/index.html';
            });
        }
    };
});
// =================CONFIGURACIÓN FIREBASE=================
// ¡IMPORTANTE! REEMPLAZA ESTO CON TUS PROPIAS CREDENCIALES DE FIREBASE
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

const AUTHORIZED_EMAILS = ['gadalicante@gmail.com', 'copg279@gmail.com', 'adamus03248@gmail.com', 'davidmesi83@gmail.com', 'pamiseseg@gmail.com', 'policia.g496@gmail.com', 'verdeguer279@gmail.com', 'cambiar_nombre6@gmail.com'];
const ADMIN_EMAIL = 'copg279@gmail.com'; // El correo principal de administrador

// Inicialización de Firebase
if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const db = firebase.database();
const auth = firebase.auth();

// Constantes y Variables de Estado
const BUTTONS_NODE = 'menuButtons'; 
const USERS_NODE = 'usuarios_google';
let menuButtonsData = {};
let currentMenuPath = [];
let isEditMode = false;
let currentUserEmail = "";

// Rutas SVG para los circuitos de los botones (Simplificadas para el nuevo diseño)
const SVG_PATHS = {
    small: { viewBox: "0 0 160 90", outer: "M5,5 L155,5 L155,85 L5,85 Z M20,5 L20,25 L50,25 L50,5 M140,85 L140,65 L110,65 L110,85", inner: "M10,35 H150 M10,55 H150 M35,10 V80 M125,10 V80" },
    full: { viewBox: "0 0 340 90", outer: "M5,5 L335,5 L335,85 L5,85 Z M30,5 L30,25 L80,25 L80,5 M310,85 L310,65 L260,65 L260,85", inner: "M10,35 H330 M10,55 H330 M55,10 V80 M285,10 V80 H170 V10" }
};


// ================= FUNCIONES DE INTERFAZ (UI) =================

// Manejo del Sidebar
const openSidebar = () => { 
    renderSidebarTree(null, document.getElementById('sidebar-tree-container')); 
    document.getElementById('sidebar-menu').style.transform = "translateX(0)"; 
    document.getElementById('sidebar-overlay').style.display = "block"; 
    document.getElementById('sidebar-toggle-float').style.opacity = "0";
}
const closeSidebar = () => { 
    document.getElementById('sidebar-menu').style.transform = "translateX(-100%)"; 
    document.getElementById('sidebar-overlay').style.display = "none"; 
    document.getElementById('sidebar-toggle-float').style.opacity = "1";
}
document.getElementById('close-sidebar').onclick = closeSidebar;
document.getElementById('sidebar-overlay').onclick = closeSidebar;

// Manejo de la navegación (Atrás)
window.addEventListener('popstate', (event) => {
    if (document.getElementById('iframe-viewer-area').style.display === 'block') {
        closeContent();
    } else if (currentMenuPath.length > 0) {
        currentMenuPath.pop();
        renderMenuButtons();
    }
});

// Establecer estado inicial del historial
history.replaceState({ page: 'root' }, '', '');

// Navegar a una carpeta (Submenú)
function navigateToFolder(key) {
    currentMenuPath.push(key);
    history.pushState({ page: 'folder', id: key }, '', '');
    renderMenuButtons();
}

// Cerrar el visor de contenido (Iframe)
function closeContent() {
    const iframeArea = document.getElementById('iframe-viewer-area');
    const iframe = document.getElementById('content-iframe');
    iframe.style.opacity = '0';
    setTimeout(() => {
        iframeArea.style.display = 'none'; 
        document.getElementById('main-scroll-area').style.display = 'flex'; // Volver a flex
        iframe.src = "about:blank"; 
        document.getElementById('iframe-back-float').style.display = 'none';
    }, 300);
}

// ================= RENDERIZADO DEL MENÚ PRINCIPAL =================

function renderMenuButtons() {
    const grid = document.getElementById('main-menu-grid'); 
    // Pequeña animación de salida antes de renderizar lo nuevo
    grid.style.opacity = '0';
    
    setTimeout(() => {
        grid.innerHTML = '';
        const parentId = currentMenuPath.length > 0 ? currentMenuPath[currentMenuPath.length - 1] : null;
        const buttons = Object.entries(menuButtonsData).filter(([k, v]) => v.parent == parentId).sort((a,b) => a[1].order - b[1].order);

        // Botón de añadir en modo edición
        if(isEditMode) {
            const addBtn = document.createElement('div'); 
            addBtn.className = 'tech-btn full-width'; 
            addBtn.style.border = '2px dashed var(--cyan-dark)'; 
            addBtn.style.background = 'rgba(0, 240, 255, 0.05)';
            addBtn.innerHTML = '<div class="tech-label" style="color:var(--cyan)"><i class="fas fa-plus-circle fa-lg"></i> AÑADIR NUEVO NODO</div>'; 
            addBtn.onclick = () => { document.getElementById('add-button-modal').style.display='flex'; }; 
            grid.appendChild(addBtn);
        }

        if (buttons.length === 0 && !isEditMode) {
             grid.innerHTML = '<div class="full-width" style="text-align:center; color:#888; padding:20px;">DIRECTORIO VACÍO</div>';
        }

        buttons.forEach(([key, v]) => {
            const isFull = v.size === 'full-width'; 
            const paths = isFull ? SVG_PATHS.full : SVG_PATHS.small;
            const btn = document.createElement('div'); 
            btn.className = `tech-btn ${isFull ? 'full-width' : ''}`;
            
            // Asignar clases de color
            if (v.color === '#ef4444' || v.color === '#dc2626') btn.classList.add('color-alert'); 
            else if (v.color === '#f59e0b') btn.classList.add('color-warning'); 
            else if (v.color === '#10b981' || v.color === '#16a34a') btn.classList.add('color-success');
            
            const energyBeam = isFull ? '<div class="energy-beam"></div>' : ''; 
            const editIcon = isEditMode ? `<div class="edit-mode-icon">EDITAR</div>` : '';
            
            // Determinar icono y texto
            let iconHtml = v.type === 'parent' ? '<i class="fas fa-folder-tree"></i>' : '<i class="fas fa-file-code"></i>';
            if(v.href) iconHtml = '<i class="fas fa-external-link-alt"></i>';

            btn.innerHTML = `
                <svg viewBox="${paths.viewBox}" preserveAspectRatio="none">
                    <path class="path-outer" d="${paths.outer}" />
                    <path class="path-inner" d="${paths.inner}" />
                </svg>
                ${energyBeam}
                <div class="tech-label">
                    ${iconHtml}
                    ${v.text}
                </div>
                ${editIcon}
            `;
            
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
        
        // Animación de entrada
        grid.style.opacity = '1';
        grid.classList.remove('animate-fade-in-up');
        void grid.offsetWidth; // Trigger reflow
        grid.classList.add('animate-fade-in-up');

    }, 200); // Espera breve para la transición
}

function updateTitle(parentId) {
    const titleEl = document.getElementById('main-title-text');
    const subTitleEl = document.getElementById('user-info-display');
    
    titleEl.style.opacity = 0;
    setTimeout(() => {
        if (!parentId) { 
            titleEl.innerText = 'UNIDAD GAD: INTERFAZ DE MANDO'; 
            subTitleEl.innerText = `OPERADOR ACTIVO: ${currentUserEmail.split('@')[0].toUpperCase()}`;
        } else { 
            // Buscar el nombre de la carpeta actual
            const folderName = menuButtonsData[parentId]?.text || 'SUBDIRECTORIO';
            titleEl.innerHTML = `<i class="fas fa-folder-open" style="font-size:0.8em; opacity:0.7"></i> ${folderName}`; 
             subTitleEl.innerText = `NIVEL DE ACCESO: SUBDIRECTORIO`;
        }
        titleEl.style.opacity = 1;
    }, 200);
}

// ================= RENDERIZADO DEL SIDEBAR =================

function renderSidebarTree(parentId, container) {
    container.innerHTML = '';
    const items = Object.entries(menuButtonsData).filter(([k, v]) => v.parent == parentId).sort((a,b) => a[1].order - b[1].order);
    if (items.length === 0 && parentId === null) { container.innerHTML = '<div style="padding:20px; text-align:center; color:#888;">Cargando estructura...</div>'; return; }
    items.forEach(([key, data]) => {
        const div = document.createElement('div');
        const row = document.createElement('div'); row.className = 'sidebar-item';
        const icon = data.type === 'parent' ? 'fa-folder' : (data.href ? 'fa-external-link-alt' : 'fa-file-alt');
        row.innerHTML = `<i class="fas ${icon}"></i> ${data.text}`;
        row.onclick = (e) => {
            e.stopPropagation();
            if (data.type === 'parent') {
                let childrenDiv = div.querySelector('.children-container');
                // Toggle para expandir/contraer
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
        div.appendChild(row); container.appendChild(div);
    });
}

// ================= VISOR DE CONTENIDO (IFRAME) =================

function showContent(data) {
    history.pushState({ page: 'content' }, '', '');
    const viewer = document.getElementById('iframe-viewer-area'); 
    const iframe = document.getElementById('content-iframe');
    
    document.getElementById('main-scroll-area').style.display = 'none'; 
    viewer.style.display = 'block'; 
    
    setTimeout(() => {
         iframe.style.opacity = '1';
         document.getElementById('iframe-back-float').style.display = 'block';
    }, 100);

    if (data.htmlCode) {
        const doc = iframe.contentWindow.document; doc.open();
        let content = data.htmlCode;
        // Inyectar configuración si no existe (Opcional, depende de tus documentos)
        if(!content.includes('gadConfigV4')) { 
            content = `<script>var gadConfigV5 = { apiKey: "${firebaseConfig.apiKey}", authDomain: "${firebaseConfig.authDomain}", databaseURL: "${firebaseConfig.databaseURL}", projectId: "${firebaseConfig.projectId}" }; if (!firebase.apps.length) firebase.initializeApp(gadConfigV5);<\/script>` + content; 
        }
        doc.write(content); doc.close();
    } else if (data.href) { 
        iframe.src = data.href; 
    }
}

// ================= GESTIÓN DE BOTONES (CRUD) =================

function openEditModal(key, data) {
    document.getElementById('edit-button-modal').style.display = 'flex';
    document.getElementById('edit-button-id').value = key; 
    document.getElementById('edit-button-text').value = data.text; 
    document.getElementById('edit-button-href').value = data.href || ''; 
    document.getElementById('edit-button-html-code').value = data.htmlCode || ''; 
    document.getElementById('edit-button-size').value = data.size || 'normal';
    
    let colorVal = '#00f0ff'; // Default cyan
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
        htmlCode: document.getElementById('edit-button-html-code').value, 
        size: document.getElementById('edit-button-size').value, 
        color: document.getElementById('edit-button-color-select').value 
    });
    document.getElementById('edit-button-modal').style.display = 'none';
};

document.getElementById('save-new-button').onclick = async () => {
    const text = document.getElementById('new-button-text').value; if(!text) return alert("Nombre requerido");
    const parent = currentMenuPath.length ? currentMenuPath[currentMenuPath.length-1] : null;
    
    // Calcular orden
    const snap = await db.ref(BUTTONS_NODE).orderByChild('parent').equalTo(parent).once('value');
    const order = (snap.val() ? Object.keys(snap.val()).length : 0) + 1;
    
    db.ref(BUTTONS_NODE).push({ 
        text: text, 
        type: document.getElementById('new-button-type').value, 
        size: document.getElementById('new-button-size').value, 
        htmlCode: document.getElementById('new-button-html-code').value || '', 
        parent: parent, 
        order: order, 
        color: '#00f0ff' // Color por defecto al crear
    });
    
    // Limpiar inputs
    document.getElementById('new-button-text').value = '';
    document.getElementById('new-button-html-code').value = '';
    document.getElementById('add-button-modal').style.display='none';
};

window.delBtn = (key) => { 
    if(confirm('ADVERTENCIA: ¿Confirmar eliminación del nodo de datos? Esta acción es irreversible.')) { 
        db.ref(`${BUTTONS_NODE}/${key}`).remove(); 
        document.getElementById('edit-button-modal').style.display='none'; 
    } 
};

// ================= CONTROLES DE ADMINISTRADOR =================

// Toggle del panel
document.getElementById('admin-toggle-btn').onclick = () => { 
    const p = document.getElementById('admin-panel'); 
    if(p.style.display === 'flex') {
        p.style.display = 'none';
        document.getElementById('admin-toggle-btn').innerHTML = '<i class="fas fa-terminal"></i> CONSOLA DE MANDO';
    } else {
        p.style.display = 'flex';
        // Scroll hacia el panel
        setTimeout(() => p.scrollIntoView({behavior: "smooth"}), 100);
        document.getElementById('admin-toggle-btn').innerHTML = '<i class="fas fa-chevron-up"></i> OCULTAR CONSOLA';
    }
};

// Toggle modo edición
document.getElementById('show-edit-menu-modal').onclick = () => { 
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

// ================= AUTENTICACIÓN Y LOGS =================

function sanitizeEmail(email) { return email.replace(/\./g, ','); }
async function getClientIP() { try { const r = await fetch('https://api.ipify.org?format=json'); const d = await r.json(); return d.ip || 'Desconocida'; } catch { return 'Oculta'; } }

auth.onAuthStateChanged(async (user) => {
    const loadingScreen = document.getElementById('loading-screen');
    
    if (user && AUTHORIZED_EMAILS.includes(user.email)) {
        currentUserEmail = user.email; 
        console.log("Acceso autorizado: " + user.email);

        // Cargar datos del menú
        db.ref(BUTTONS_NODE).on('value', s => { 
            menuButtonsData = s.val() || {}; 
            renderMenuButtons(); 
            // Ocultar pantalla de carga con un pequeño delay para suavidad
            setTimeout(() => {
                loadingScreen.style.opacity = '0'; 
                setTimeout(()=> loadingScreen.style.display='none', 500);
            }, 1500);
        });

        // Registrar acceso
        const emailKey = sanitizeEmail(user.email); 
        const isAdmin = (user.email === ADMIN_EMAIL); 
        const ip = await getClientIP();
        
        db.ref(USERS_NODE + '/' + emailKey).transaction(d => d ? { ...d, email: user.email, ultimoAcceso: Date.now(), accesos: (d.accesos||0)+1 } : { email: user.email, accesos: 1, ultimoAcceso: Date.now() });
        db.ref('visitLog_v5').push().set({ email: user.email, timestamp: Date.now(), ip: ip, action: 'login' });
        
        // Configurar UI según rol
        if(isAdmin) { 
            initAdminFeatures(); 
        } else { 
            document.getElementById('admin-toggle-btn').style.display = 'none';
            document.getElementById('user-controls').style.display = 'block'; 
        }

    } else { 
        // Si no está autorizado o no hay usuario
        loadingScreen.innerHTML = '<h2 style="color:red; font-family:Orbitron">ACCESO DENEGADO</h2><p style="color:#ccc">Credenciales insuficientes.</p>';
        setTimeout(() => { window.location.href = '/index.html'; }, 2000); // Redirigir al login (asumo que index.html es tu login)
    }
});

// Funciones Admin Adicionales
function initAdminFeatures() {
    // Contadores en tiempo real
    db.ref(USERS_NODE).on('value', s => {
        const users = s.val() || {}; let total = 0; let html = ''; 
        const listContainer = document.getElementById('user-list-container'); 
        listContainer.innerHTML = '';
        
        Object.entries(users).forEach(([k, u]) => { 
            total += (u.accesos || 0); 
            html += `<div class="counter-card"><div class="counter-header">${(u.nombre||u.email.split('@')[0]).substring(0,12)}</div><div class="counter-number">${u.accesos}</div></div>`; 
            
            // Lista para el modal de usuarios
            const lastAccess = new Date(u.ultimoAcceso).toLocaleDateString();
            listContainer.innerHTML += `
                <div class="cyber-list-item">
                    <div>
                        <strong style="color:var(--cyan)">${u.nombre || 'Sin Alias'}</strong><br>
                        <span style="font-size:0.8em">${u.email}</span>
                    </div>
                    <div style="text-align:right">
                        <span style="font-size:0.7em; color:#888">Acceso: ${lastAccess}</span><br>
                        <i class="fas fa-trash-alt" style="color:var(--red); cursor:pointer; margin-top:5px;" onclick="if(confirm('Eliminar usuario?')) db.ref('${USERS_NODE}/${k}').remove()"></i>
                    </div>
                </div>`; 
        });
        document.getElementById('counters-row').innerHTML = `<div class="counters-container"><div class="counter-card total"><div class="counter-header">TOTAL ACCESOS</div><div class="counter-number">${total}</div></div>${html}</div>`;
    });
}

// Event listeners para modales admin
document.getElementById('show-manage-users-modal').onclick = () => document.getElementById('manage-users-modal').style.display = 'flex';

document.getElementById('add-user-button').onclick = () => { 
    const e = document.getElementById('new-user-email').value.trim().toLowerCase(); 
    const alias = document.getElementById('new-user-alias').value;
    if(e && e.includes('@')) { 
        db.ref(USERS_NODE + '/' + sanitizeEmail(e)).set({ email: e, nombre: alias || 'Agente', accesos: 0, ultimoAcceso: Date.now() }); 
        alert('Credenciales autorizadas para: ' + e);
        document.getElementById('new-user-email').value = '';
    } else {alert("Email inválido");}
};

document.getElementById('show-full-log-modal').onclick = async () => { 
    document.getElementById('full-log-modal').style.display = 'flex'; 
    const container = document.getElementById('full-log-container');
    container.innerHTML = '<div style="text-align:center; padding:20px;">Cargando registros del sistema...</div>'; 
    
    const s = await db.ref('visitLog_v5').limitToLast(150).once('value'); 
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

document.querySelectorAll('.btn-logout').forEach(b => b.onclick = () => {
    if(confirm("¿Cerrar sesión segura?")) {
        auth.signOut().then(() => {
            window.location.href = '/index.html';
        });
    }
});
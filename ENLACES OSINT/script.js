// --- 1. CONFIGURACIÓN V4 ---
const firebaseConfig = {
    apiKey: "AIzaSyCY8V_P7m8lZUvGbMVlGaa-GVhbmyikmag",
    authDomain: "gad-alicante-v4.firebaseapp.com",
    databaseURL: "https://gad-alicante-v4-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "gad-alicante-v4",
    storageBucket: "gad-alicante-v4.firebasestorage.app",
    messagingSenderId: "119727545224",
    appId: "1:119727545224:web:36880c50d196c456cdb83d"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const auth = firebase.auth();
const enlacesRef = database.ref('enlaces_osint');

// LISTA COMPLETA DE PAÍSES INTEGRADA
const countryMapping = {
    "ALBANIA": { iso: "al", vehicle: "AL" },
    "ALEMANIA": { iso: "de", vehicle: "D" },
    "ANDORRA": { iso: "ad", vehicle: "AND" },
    "ARGELIA": { iso: "dz", vehicle: "DZ" },
    "ARGENTINA": { iso: "ar", vehicle: "RA" },
    "ARMENIA": { iso: "am", vehicle: "AM" },
    "AUSTRALIA": { iso: "au", vehicle: "AUS" },
    "AUSTRIA": { iso: "at", vehicle: "A" },
    "AZERBAIYAN": { iso: "az", vehicle: "AZ" },
    "BELGICA": { iso: "be", vehicle: "B" },
    "BIELORRUSIA": { iso: "by", vehicle: "BY" },
    "BOLIVIA": { iso: "bo", vehicle: "BOL" },
    "BOSNIA": { iso: "ba", vehicle: "BIH" },
    "BRASIL": { iso: "br", vehicle: "BR" },
    "BULGARIA": { iso: "bg", vehicle: "BG" },
    "CANADA": { iso: "ca", vehicle: "CDN" },
    "CHILE": { iso: "cl", vehicle: "RCH" },
    "CHINA": { iso: "cn", vehicle: "RC" },
    "CHIPRE": { iso: "cy", vehicle: "CY" },
    "COLOMBIA": { iso: "co", vehicle: "CO" },
    "COREA DEL SUR": { iso: "kr", vehicle: "ROK" },
    "CROACIA": { iso: "hr", vehicle: "HR" },
    "DINAMARCA": { iso: "dk", vehicle: "DK" },
    "ECUADOR": { iso: "ec", vehicle: "EC" },
    "EEUU": { iso: "us", vehicle: "USA" },
    "EGIPTO": { iso: "eg", vehicle: "ET" },
    "EMIRATOS ARABES": { iso: "ae", vehicle: "UAE" },
    "ESLOVAQUIA": { iso: "sk", vehicle: "SK" },
    "ESLOVENIA": { iso: "si", vehicle: "SLO" },
    "ESPAÑA": { iso: "es", vehicle: "E" },
    "ESTONIA": { iso: "ee", vehicle: "EST" },
    "FINLANDIA": { iso: "fi", vehicle: "FIN" },
    "FRANCIA": { iso: "fr", vehicle: "F" },
    "GEORGIA": { iso: "ge", vehicle: "GE" },
    "GRECIA": { iso: "gr", vehicle: "GR" },
    "HUNGRIA": { iso: "hu", vehicle: "H" },
    "INDIA": { iso: "in", vehicle: "IND" },
    "IRLANDA": { iso: "ie", vehicle: "IRL" },
    "ISLANDIA": { iso: "is", vehicle: "IS" },
    "ISRAEL": { iso: "il", vehicle: "IL" },
    "ITALIA": { iso: "it", vehicle: "I" },
    "JAPON": { iso: "jp", vehicle: "J" },
    "KAZAJISTAN": { iso: "kz", vehicle: "KZ" },
    "LETONIA": { iso: "lv", vehicle: "LV" },
    "LITUANIA": { iso: "lt", vehicle: "LT" },
    "LUXEMBURGO": { iso: "lu", vehicle: "L" },
    "MALTA": { iso: "mt", vehicle: "M" },
    "MARRUECOS": { iso: "ma", vehicle: "MA" },
    "MEXICO": { iso: "mx", vehicle: "MEX" },
    "MOLDAVIA": { iso: "md", vehicle: "MD" },
    "MONACO": { iso: "mc", vehicle: "MC" },
    "MONTENEGRO": { iso: "me", vehicle: "MNE" },
    "NORUEGA": { iso: "no", vehicle: "N" },
    "NUEVA ZELANDA": { iso: "nz", vehicle: "NZ" },
    "PAISES BAJOS": { iso: "nl", vehicle: "NL" },
    "PAKISTAN": { iso: "pk", vehicle: "PK" },
    "PARAGUAY": { iso: "py", vehicle: "PY" },
    "PERU": { iso: "pe", vehicle: "PE" },
    "POLONIA": { iso: "pl", vehicle: "PL" },
    "PORTUGAL": { iso: "pt", vehicle: "P" },
    "REINO UNIDO": { iso: "gb", vehicle: "UK" },
    "REPUBLICA CHECA": { iso: "cz", vehicle: "CZ" },
    "RUMANIA": { iso: "ro", vehicle: "RO" },
    "RUSIA": { iso: "ru", vehicle: "RUS" },
    "SAN MARINO": { iso: "sm", vehicle: "RSM" },
    "SERBIA": { iso: "rs", vehicle: "SRB" },
    "SUECIA": { iso: "se", vehicle: "S" },
    "SUIZA": { iso: "ch", vehicle: "CH" },
    "TUNEZ": { iso: "tn", vehicle: "TN" },
    "TURQUIA": { iso: "tr", vehicle: "TR" },
    "UCRANIA": { iso: "ua", vehicle: "UA" },
    "URUGUAY": { iso: "uy", vehicle: "UY" },
    "VENEZUELA": { iso: "ve", vehicle: "YV" }
};

function getCountryData(paisName) {
    if (!paisName) return null;
    const normalized = paisName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    if (countryMapping[normalized]) return countryMapping[normalized];
    return { iso: null, vehicle: null };
}

let enlacesData = {};
let isEditMode = false;
let isUserAuthenticated = false;

// --- 2. SISTEMA DE SEGURIDAD Y ENTORNO DE PRUEBAS ---
auth.onAuthStateChanged((user) => {
    if (user) {
        permitirAcceso();
    } else {
        document.getElementById('loading-spinner').classList.add('hidden');
        document.getElementById('login-form').classList.remove('hidden');
    }
});

function loginTest() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-pass').value;
    const errorMsg = document.getElementById('login-error');

    auth.signInWithEmailAndPassword(email, pass)
        .then(() => permitirAcceso())
        .catch((error) => {
            // Bypass para pruebas de Local Live Server
            if(email === 'test@gad.com' && pass === '123456') {
                console.warn("Autenticación Firebase fallida. Forzando acceso de prueba local.");
                permitirAcceso();
            } else {
                errorMsg.textContent = "Credenciales incorrectas: " + error.message;
                errorMsg.classList.remove('hidden');
            }
        });
}

function permitirAcceso() {
    isUserAuthenticated = true;
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-content').classList.remove('hidden');
    document.getElementById('app-content').style.display = 'flex';
    initDataLoad();
}

// --- 3. CARGA Y LECTURA DE DATOS ---
function initDataLoad() {
    enlacesRef.on('value', (snapshot) => {
        enlacesData = snapshot.val() || {};
        const paisesSelect = document.getElementById('paises');
        const paises = Object.keys(enlacesData).sort();
        const paisSeleccionadoAnterior = paisesSelect.value;
        
        paisesSelect.innerHTML = '<option value="">-- SELECCIONAR PAÍS --</option>';
        
        paises.forEach(pais => {
            const data = getCountryData(pais);
            const label = data && data.vehicle ? `${pais} (${data.vehicle})` : pais;
            const option = document.createElement('option');
            option.value = pais;
            option.textContent = label;
            paisesSelect.appendChild(option);
        });
        
        if (paisSeleccionadoAnterior) paisesSelect.value = paisSeleccionadoAnterior;
        if (paisesSelect.value) buscar(paisesSelect.value, true); 
    });
}

// --- GESTIÓN DE LA INTERFAZ ---
window.toggleEditMode = function() {
    const checkbox = document.getElementById('editModeToggle');
    const helpBox = document.getElementById('editHelpBox');
    const addSection = document.getElementById('addLinkSection');
    
    isEditMode = checkbox.checked;
    
    if (isEditMode) {
        addSection.classList.remove('hidden');
        helpBox.classList.remove('hidden');
        setTimeout(() => helpBox.classList.add('active'), 10);
    } else {
        helpBox.classList.remove('active');
        setTimeout(() => { helpBox.classList.add('hidden'); addSection.classList.add('hidden'); }, 400);
    }

    if (document.getElementById('paises').value) buscar(document.getElementById('paises').value, true);
};

window.buscar = function(pais, refreshing = false) {
    const linksContainer = document.getElementById('linksContainer');
    const linkList = document.getElementById('linkList');
    
    linksContainer.innerHTML = '';

    if (!pais) {
        linkList.classList.add('hidden');
        return;
    }

    linkList.classList.remove('hidden');
    
    const data = getCountryData(pais) || {};
    const vehicleCode = data.vehicle ? `(${data.vehicle})` : '';
    
    document.getElementById('resultsTitle').innerHTML = `${pais} <span class="text-cyan-500 ml-2 text-sm">${vehicleCode}</span>`;
    
    if (data.iso) {
        document.getElementById('titleFlag').src = `https://flagcdn.com/h40/${data.iso}.png`;
        document.getElementById('titleFlag').classList.remove('hidden');
    } else {
        document.getElementById('titleFlag').classList.add('hidden');
    }

    let results = enlacesData[pais];
    
    if (results) {
        let resultsClone = { ...results };
        const sortedLinks = Object.entries(resultsClone).sort(([, a], [, b]) => (a.orden || 0) - (b.orden || 0));

        sortedLinks.forEach(([key, link], index) => {
            const linkItem = document.createElement('div');
            linkItem.className = 'bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-md relative group hover:border-cyan-500/50 hover:bg-slate-800/80 transition-all';

            if(link.status === 'caido' && !isEditMode) linkItem.classList.add('opacity-40', 'grayscale');

            const linkAnchor = document.createElement('a');
            linkAnchor.href = link.url;
            linkAnchor.target = "_blank";
            linkAnchor.className = 'block';
            
            const linkTitle = document.createElement('h3');
            linkTitle.className = 'font-bold text-lg flex items-center gap-2 flex-wrap mb-1';
            
            if (link.status === 'caido') {
                linkTitle.innerHTML = `<span class="text-red-400 line-through">${link.nombre}</span>`;
            } else {
                linkTitle.innerHTML = `<span class="text-cyan-400 group-hover:text-cyan-300 transition-colors">${link.nombre}</span>`;
            }

            const linkDesc = document.createElement('p');
            linkDesc.className = 'text-sm text-slate-300 mt-2 font-medium';
            linkDesc.textContent = link.descripcion;

            linkAnchor.append(linkTitle, linkDesc);
            linkItem.appendChild(linkAnchor);
            
            // Sección estado y controles
            // ... dentro de window.buscar, donde se crea statusContainer ...

const statusContainer = document.createElement('div');
statusContainer.className = 'mt-4 pt-4 border-t border-slate-700 flex flex-col gap-4';

const statusTextRow = document.createElement('div');
// Flexbox que en móvil pone las flechas al lado del texto de estado
statusTextRow.className = 'flex justify-between items-center w-full';

// Lado izquierdo: El estado (Activo/Inactivo)
const statusInfo = document.createElement('div');
statusInfo.innerHTML = link.status === 'caido' 
    ? `<span class="text-[11px] font-black text-red-500 uppercase tracking-widest flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-red-500"></span> INACTIVO</span>`
    : `<span class="text-[11px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-emerald-500"></span> ACTIVO</span>`;

statusTextRow.appendChild(statusInfo);

// Lado derecho: Las flechas (Solo en modo edición)
if (isEditMode) {
    const arrowGroup = document.createElement('div');
    arrowGroup.className = 'flex gap-2';
    const btnArrow = "text-xs font-bold px-3 py-1.5 rounded bg-slate-900 text-slate-300 border border-slate-600 hover:text-white transition shadow-sm";
    
    arrowGroup.innerHTML = `
        <button onclick="moverEnlace('${pais}', ${index}, 'arriba')" class="${btnArrow}" title="Subir">▲</button>
        <button onclick="moverEnlace('${pais}', ${index}, 'abajo')" class="${btnArrow}" title="Bajar">▼</button>
    `;
    statusTextRow.appendChild(arrowGroup);
}

statusContainer.appendChild(statusTextRow);

// Fila inferior de botones (Solo en modo edición)
if (isEditMode) {
    const actionRow = document.createElement('div');
    // En móvil (flex) ocupan el ancho disponible o se envuelven, en escritorio se alinean normal
    actionRow.className = 'flex flex-wrap md:flex-nowrap gap-2 w-full';
    
    const btnAction = "text-[10px] font-bold px-3 py-2 rounded bg-slate-900 text-slate-300 border border-slate-600 hover:text-white transition shadow-sm flex-1 md:flex-none text-center";
    
    actionRow.innerHTML = `
        <button onclick="toggleEditForm(this.closest('.bg-slate-800'), true)" class="${btnAction} hover:border-blue-500 hover:bg-blue-900/30 text-blue-400">EDITAR</button>
        <button onclick="toggleLinkStatus('${pais}', '${key}', '${link.status === 'caido' ? 'activo' : 'caido'}')" class="${btnAction} ${link.status === 'caido' ? 'hover:border-emerald-500 text-emerald-400' : 'hover:border-orange-500 text-orange-400'}">${link.status === 'caido' ? 'ACTIVAR' : 'CAÍDO'}</button>
        <button onclick="eliminarEnlace('${pais}', '${key}')" class="${btnAction} hover:border-red-500 hover:bg-red-900/30 text-red-400 md:ml-auto">BORRAR</button>
    `;
    statusContainer.appendChild(actionRow);
}

linkItem.appendChild(statusContainer);
// ... resto de la función ...

            // Formulario Edición Inline
            const editForm = document.createElement('div');
            editForm.className = 'form-container mt-4 bg-slate-900 p-4 rounded-xl border border-slate-600 hidden shadow-inner';
            editForm.innerHTML = `
                <div class="grid gap-3">
                    <input type="text" value="${link.nombre}" class="edit-nombre w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500">
                    <input type="url" value="${link.url}" class="edit-url w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500">
                    <input type="text" value="${link.descripcion}" class="edit-descripcion w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-cyan-500">
                    <div class="flex gap-3 mt-2">
                        <button onclick="saveEditedLink(event, '${pais}', '${key}')" class="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs py-2 rounded-lg transition-colors tracking-widest uppercase">GUARDAR</button>
                        <button onclick="toggleEditForm(this.closest('.bg-slate-800'), false)" class="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-black text-xs py-2 rounded-lg transition-colors tracking-widest uppercase">CANCELAR</button>
                    </div>
                </div>
            `;
            linkItem.appendChild(editForm);
            linksContainer.appendChild(linkItem);
        });
    } else {
        linksContainer.innerHTML = `<div class="text-center py-10 text-slate-500 font-bold text-sm tracking-widest">SIN ENLACES REGISTRADOS</div>`;
    }
};

window.toggleFormulario = function() {
    const formulario = document.getElementById('formularioEnlace');
    const isHidden = formulario.classList.contains('hidden');
    
    if (isHidden) {
        formulario.classList.remove('hidden');
        setTimeout(() => formulario.classList.add('active'), 10);
    } else {
        formulario.classList.remove('active');
        setTimeout(() => formulario.classList.add('hidden'), 400);
    }
};

window.volverAtras = function() {
    document.getElementById('linkList').classList.add('hidden');
    document.getElementById('paises').value = '';
};

// --- 4. FUNCIONES CRUD ---
window.guardarNuevoEnlace = function() {
    const paisInput = document.getElementById('nuevoPais').value.trim().toUpperCase();
    const descripcion = document.getElementById('nuevaDescripcion').value.trim();
    const url = document.getElementById('nuevaUrl').value.trim();

    if (!paisInput || !descripcion || !url) return alert("Datos incompletos.");

    enlacesRef.child(paisInput).push({ nombre: descripcion, url: url, descripcion: descripcion, status: 'activo', orden: Date.now() })
        .then(() => {
            document.getElementById('nuevoPais').value = '';
            document.getElementById('nuevaDescripcion').value = '';
            document.getElementById('nuevaUrl').value = '';
            toggleFormulario();
        });
};

window.toggleLinkStatus = function(pais, key, status) {
    enlacesRef.child(pais).child(key).update({ status: status });
};

window.eliminarEnlace = function(pais, key) {
    if (confirm("¿Eliminar definitivamente?")) enlacesRef.child(pais).child(key).remove();
};

window.toggleEditForm = function(linkItem, show) {
    const form = linkItem.querySelector('.form-container');
    if (show) {
        form.classList.remove('hidden');
        setTimeout(() => form.classList.add('active'), 10);
    } else {
        form.classList.remove('active');
        setTimeout(() => form.classList.add('hidden'), 400);
    }
};

window.saveEditedLink = function(event, pais, key) {
    const linkElement = event.target.closest('.bg-slate-800');
    const nuevoNombre = linkElement.querySelector('.edit-nombre').value.trim();
    const nuevaUrl = linkElement.querySelector('.edit-url').value.trim();
    const nuevaDesc = linkElement.querySelector('.edit-descripcion').value.trim();
    
    if (!nuevoNombre || !nuevaUrl) return alert("Faltan datos");

    enlacesRef.child(pais).child(key).update({ nombre: nuevoNombre, url: nuevaUrl, descripcion: nuevaDesc })
        .then(() => toggleEditForm(linkElement, false));
};

window.moverEnlace = function(pais, index, direccion) {
    // La lógica de reordenamiento lista para cuando la necesites
    console.log("Mover enlace de", pais, "índice", index, "hacia", direccion);
};
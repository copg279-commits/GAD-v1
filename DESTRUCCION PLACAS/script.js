import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { getDatabase, ref, get, update, push, remove } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-database.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCY8V_P7m8lZUvGbMVlGaa-GVhbmyikmag",
    authDomain: "gad-alicante-v4.firebaseapp.com",
    databaseURL: "https://gad-alicante-v4-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "gad-alicante-v4",
    storageBucket: "gad-alicante-v4.firebasestorage.app",
    messagingSenderId: "119727545224",
    appId: "1:119727545224:web:36880c50d196c456cdb83d"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app); 

let allPlatesData = []; 
let anuladasData = []; 
let uniqueLots = {}; 
let currentSort = { column: 'FECHA_AGREGADA', direction: 'desc' };
let lotMetadataGlobal = {}; // Ahora guardará {eurocop, estado, etc.} de cada lote
let currentPlatesInConsultedLot = [];
let currentConsultedLotName = "";
let knownCountries = []; 
let isUserAuthenticated = false;

// --- AUTO LOGIN (Para pruebas en Live Server) ---
const currentHost = window.location.hostname;
const isLocal = (currentHost === '127.0.0.1' || currentHost === 'localhost');

if (isLocal) {
    // ⚠️ Usa tus credenciales reales aquí para Live Server
    signInWithEmailAndPassword(auth, "tu_correo_real@gad.com", "TuContraseña") 
        .catch(error => console.error("Error Auto-login:", error));
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        isUserAuthenticated = true;
        document.getElementById('auth-loading-screen').style.display = 'none';
        document.getElementById('main-app-content').style.display = 'block';
        initApp();
    } else {
        isUserAuthenticated = false;
        if (!isLocal) {
            document.getElementById('auth-loading-screen').innerHTML = 
                "<div class='text-center text-red-500'><i class='fas fa-lock fa-3x mb-3'></i><br>ACCESO DENEGADO<br><span class='text-sm text-gray-300'>Inicia sesión en el Menú Principal</span></div>";
        }
    }
});

function initApp() {
    loadPlates();
    
    // Sort Headers interactivos
    document.querySelectorAll('.sort-header').forEach(header => {
        header.addEventListener('click', () => { handleSort(header.dataset.sortBy); });
    });
    updateSortIcons();
    
    document.getElementById('searchPlate').addEventListener('input', handleSearchPlate);
    
    document.getElementById('selectAllCheckbox').addEventListener('change', function() {
        const checkboxes = document.querySelectorAll('.plate-checkbox:not(:disabled)');
        checkboxes.forEach(cb => { cb.checked = this.checked; });
        updateLotButton();
    });

    // SISTEMA DE MODALES
    const overlay = document.getElementById('modal-overlay');
    const toggleModal = (modalId, show) => {
        overlay.style.display = show ? 'block' : 'none';
        document.getElementById(modalId).style.display = show ? 'flex' : 'none';
    };

    document.getElementById('openNewPlateModal').addEventListener('click', () => toggleModal('newPlateModal', true));
    document.getElementById('closeNewPlateModal').addEventListener('click', () => toggleModal('newPlateModal', false));
    document.getElementById('saveNewPlateButton').addEventListener('click', handleSaveNewPlate);
    
    document.getElementById('openAnuladasModal').addEventListener('click', () => { renderAnuladasModal(); toggleModal('anuladasModal', true); });
    document.getElementById('closeAnuladasModal').addEventListener('click', () => toggleModal('anuladasModal', false));
    
    document.getElementById('closeConsultLotModal').addEventListener('click', () => toggleModal('consultLotModal', false));
    
    document.getElementById('generateLotMainBtn').addEventListener('click', () => {
        const lotName = document.getElementById('lotNumber').value;
        document.getElementById('modalNextLotName').textContent = lotName;
        
        const pendingCount = allPlatesData.filter(p => !p.LoteDestruccion || p.LoteDestruccion.trim() === "").length;
        const selectedCount = document.querySelectorAll('.plate-checkbox:checked').length;
        
        document.getElementById('countPendingAuto').textContent = pendingCount;
        document.getElementById('countSelectedManual').textContent = selectedCount;
        
        toggleModal('generateLotModal', true);
    });

    document.getElementById('closeGenerateLotModal').addEventListener('click', () => toggleModal('generateLotModal', false));
    
    document.getElementById('btnGenAuto').addEventListener('click', () => {
        const pendingIds = allPlatesData.filter(p => !p.LoteDestruccion || p.LoteDestruccion.trim() === "").map(p => p.id);
        if(pendingIds.length === 0) return alert("No hay placas pendientes en el sistema.");
        executeGenerateLot(pendingIds);
        toggleModal('generateLotModal', false);
    });

    document.getElementById('btnGenManual').addEventListener('click', () => {
        const selectedIds = Array.from(document.querySelectorAll('.plate-checkbox:checked')).map(cb => cb.dataset.plateId);
        if(selectedIds.length === 0) {
            alert("⚠️ Selecciona manualmente alguna placa de la lista marcando el recuadro antes de usar esta opción.");
            toggleModal('generateLotModal', false);
            return;
        }
        executeGenerateLot(selectedIds);
        toggleModal('generateLotModal', false);
    });

    document.getElementById('exportLotToExcelButton').addEventListener('click', handleExportToExcel);
    
    // Botón exportar PDF desde el Modal
    document.getElementById('exportLotToPDFButton').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Generando...';
        btn.disabled = true;
        
        await generatePDFForLot(currentConsultedLotName, currentPlatesInConsultedLot);
        
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    });

    window.addEventListener('click', (e) => {
        if (e.target === overlay) {
            toggleModal('newPlateModal', false);
            toggleModal('anuladasModal', false);
            toggleModal('consultLotModal', false);
            toggleModal('generateLotModal', false);
        }
    });
}

// --- CARGA DE DATOS ---
async function loadPlates() {
    document.getElementById('platesTableBody').innerHTML = '<tr><td colspan="7" class="text-center p-6 text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>Cargando datos...</td></tr>';
    try {
        await loadLotMetadata(); 
        await loadAnuladas(); 
        const snapshot = await get(ref(database, 'placas_destruccion'));
        allPlatesData = []; 
        uniqueLots = {}; 

        if (snapshot.exists()) {
            allPlatesData = Object.entries(snapshot.val()).map(([key, value]) => {
                if (value.LoteDestruccion && value.LoteDestruccion.trim() !== "") {
                    const lotName = value.LoteDestruccion;
                    if (!uniqueLots[lotName]) uniqueLots[lotName] = [];
                    uniqueLots[lotName].push(key);
                }
                return { id: key, ...value };
            });
        }
        await getNextLotNumber();
        document.getElementById('plateCounter').textContent = allPlatesData.length; 
        handleSearchPlate(); 
        loadLotAdministrationPanel(); 
    } catch (error) {
        document.getElementById('platesTableBody').innerHTML = '<tr><td colspan="7" class="text-center p-6 text-red-500">Error conectando con base de datos.</td></tr>';
    }
}

async function loadLotMetadata() {
    const snapshot = await get(ref(database, 'lotes'));
    lotMetadataGlobal = {}; 
    if (snapshot.exists()) {
        lotMetadataGlobal = snapshot.val();
    }
}

async function loadAnuladas() {
    const snapshot = await get(ref(database, 'placas_anuladas'));
    anuladasData = []; 
    if (snapshot.exists()) { anuladasData = Object.entries(snapshot.val()).map(([key, value]) => ({ id: key, ...value })); }
    document.getElementById('anuladasCount').textContent = anuladasData.length;
}

async function getNextLotNumber() {
    let maxLotNumber = 0;
    allPlatesData.forEach(placa => {
        if (placa.LoteDestruccion) {
            const match = placa.LoteDestruccion.match(/LOTE (\d+)/i);
            if (match) maxLotNumber = Math.max(maxLotNumber, parseInt(match[1]));
        }
    });
    document.getElementById('lotNumber').value = `LOTE ${maxLotNumber + 1}`;
}

// --- FILTRO Y ORDENACIÓN (AHORA ALFABÉTICO PERFECTO) ---
function handleSearchPlate() {
    const searchTerm = document.getElementById('searchPlate').value.trim().toUpperCase();
    let filtered = allPlatesData;
    if (searchTerm !== "") {
        filtered = allPlatesData.filter(placa => 
            (placa.PLACA && placa.PLACA.toUpperCase().includes(searchTerm)) || 
            (placa.PAIS && placa.PAIS.toUpperCase().includes(searchTerm))
        );
    }
    renderPlates(filtered);
}

function handleSort(column) {
    if (currentSort.column === column) { currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc'; } 
    else { currentSort.column = column; currentSort.direction = 'asc'; }
    updateSortIcons(); handleSearchPlate(); 
}

function updateSortIcons() {
    document.querySelectorAll('.sort-icon').forEach(icon => icon.innerHTML = '');
    const currentIcon = document.getElementById(`sortIcon${currentSort.column}`);
    if (currentIcon) { currentIcon.innerHTML = currentSort.direction === 'asc' ? '<i class="fas fa-sort-up ml-1 text-blue-400"></i>' : '<i class="fas fa-sort-down ml-1 text-blue-400"></i>'; }
}

// --- RENDERIZAR TABLA PRINCIPAL ---
function renderPlates(platesToRender) {
    const tableBody = document.getElementById('platesTableBody');
    tableBody.innerHTML = '';
    
    // Motor de Ordenación Avanzada
    platesToRender.sort((a, b) => {
        const isADestroyed = !!a.LoteDestruccion && a.LoteDestruccion.trim() !== "";
        const isBDestroyed = !!b.LoteDestruccion && b.LoteDestruccion.trim() !== "";
        if (isADestroyed !== isBDestroyed) return isADestroyed ? 1 : -1; 
        
        let aVal = a[currentSort.column] || '', bVal = b[currentSort.column] || '';
        
        if (currentSort.column === 'FECHA_AGREGADA') {
            aVal = aVal ? new Date(aVal).getTime() : 0; bVal = bVal ? new Date(bVal).getTime() : 0;
            if (aVal < bVal) return currentSort.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return currentSort.direction === 'asc' ? 1 : -1;
            return 0;
        } else {
            // Ordenación alfabética perfecta reconociendo acentos (ej: España vs Francia)
            const cmp = String(aVal).localeCompare(String(bVal), 'es', { sensitivity: 'base' });
            return currentSort.direction === 'asc' ? cmp : -cmp;
        }
    });

    if (platesToRender.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center p-6 text-gray-500">No hay resultados.</td></tr>'; return;
    }

    platesToRender.forEach((placa, i) => {
        const isAssigned = placa.LoteDestruccion && placa.LoteDestruccion.trim() !== "";
        const assignedLotName = isAssigned ? placa.LoteDestruccion.trim() : "";
        const isLotLocked = isAssigned && lotMetadataGlobal[assignedLotName]?.estado === 'destruido';
        
        const rowClass = isAssigned ? (isLotLocked ? 'bg-red-900 bg-opacity-10 text-gray-400' : 'bg-emerald-900 bg-opacity-20 text-gray-400') : 'hover:bg-slate-800 transition';
        const fechaFormat = placa.FECHA_AGREGADA ? new Date(placa.FECHA_AGREGADA).toLocaleDateString('es-ES') : '';
        const row = document.createElement('tr');
        row.className = rowClass;
        
        row.innerHTML = `
            <td class="p-3 text-center"><input type="checkbox" data-plate-id="${placa.id}" ${isAssigned ? 'disabled hidden' : ''} class="plate-checkbox w-4 h-4 accent-red-500 cursor-pointer"></td>
            <td class="p-3 text-gray-500 font-bold">${platesToRender.length - i}</td>
            <td class="p-3 font-bold" id="pais-${placa.id}">${placa.PAIS || ''}</td>
            <td class="p-3 font-bold text-red-400 text-base" id="placa-${placa.id}">${placa.PLACA || ''}</td>
            <td class="p-3 text-gray-400">${fechaFormat}</td>
            <td class="p-3 font-bold ${isAssigned ? (isLotLocked ? 'text-red-500' : 'text-emerald-500') : 'text-gray-500'}">
                ${isAssigned ? (isLotLocked ? `<i class="fas fa-lock mr-1"></i>${assignedLotName}` : `<i class="fas fa-check-circle mr-1"></i>${assignedLotName}`) : 'PENDIENTE'}
            </td>
            <td class="p-3 text-center">
                ${!isAssigned ? `
                    <i class="fas fa-edit action-icon text-blue-400 hover:text-blue-300 mr-3" data-plate-id="${placa.id}" title="Editar"></i>
                    <i class="fas fa-times-circle action-icon text-red-500 hover:text-red-400" data-plate-id="${placa.id}" title="Anular"></i>
                ` : ''}
            </td>
        `;
        tableBody.appendChild(row);
        if (!isAssigned) {
            row.querySelector('.fa-times-circle').addEventListener('click', () => handleAnularPlate(placa));
            row.querySelector('.fa-edit').addEventListener('click', () => handleEditPlate(placa.id));
        }
    });

    document.querySelectorAll('.plate-checkbox').forEach(cb => { cb.addEventListener('change', updateLotButton); });
    updateLotButton();
}

function updateLotButton() {
    const count = document.querySelectorAll('.plate-checkbox:checked').length;
    document.getElementById('selectedCount').textContent = `(${count})`;
}

async function executeGenerateLot(plateIdsArray) {
    const lotName = document.getElementById('lotNumber').value;
    try {
        const updates = {};
        plateIdsArray.forEach(id => updates[`placas_destruccion/${id}/LoteDestruccion`] = lotName);
        updates[`lotes/${lotName}`] = { fechaCreacion: new Date().toLocaleDateString('es-ES'), totalPlacas: plateIdsArray.length, eurocop: "", estado: "pendiente" };
        
        await update(ref(database), updates);
        
        document.getElementById('selectAllCheckbox').checked = false;
        await loadPlates(); 
        alert(`✅ ${lotName} generado correctamente con ${plateIdsArray.length} placas.`);
    } catch (error) {
        console.error("Error generando lote:", error);
        alert("Error al generar lote.");
    }
}

// --- PANEL DE LOTES CREADOS (NUEVO BLINDAJE) ---
function loadLotAdministrationPanel() {
    const tbody = document.getElementById('lotAdminBody');
    tbody.innerHTML = '';
    
    const sortedLots = Object.keys(uniqueLots).sort((a, b) => { return parseInt((b.match(/\d+/) || [0])[0]) - parseInt((a.match(/\d+/) || [0])[0]); });
    if (sortedLots.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-gray-500">Aún no se ha generado ningún lote.</td></tr>'; return; }

    sortedLots.forEach(lotName => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-800 transition';
        
        const metadata = lotMetadataGlobal[lotName] || {};
        const isLocked = metadata.estado === 'destruido';
        const dateMatch = lotName.match(/\((.*?)\)/);
        
        row.innerHTML = `
            <td class="p-3 font-bold ${isLocked ? 'text-red-400' : 'text-gray-300'}">${lotName.replace(/\s*\([^)]*\)/, '')}</td>
            <td class="p-3">
                <input type="text" value="${metadata.eurocop || ''}" data-lot="${lotName}" placeholder="Nº Eurocop" 
                       class="border border-gadBorder px-2 py-1.5 rounded w-28 outline-none focus:border-blue-500 ${isLocked ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gadBg text-white'}" 
                       ${isLocked ? 'disabled' : ''}>
            </td>
            <td class="p-3 font-bold">${uniqueLots[lotName].length}</td>
            <td class="p-3 text-gray-400">${dateMatch ? dateMatch[1] : 'N/A'}</td>
            <td class="p-3">
                <div class="flex flex-wrap gap-2 items-center">
                    ${isLocked ? `
                        <span class="bg-red-900/40 text-red-400 border border-red-800 px-3 py-1.5 rounded text-xs font-bold mr-2"><i class="fas fa-lock mr-1"></i> DESTRUIDO</span>
                        <button class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-bold shadow-md" onclick="window.consultLot('${lotName}')"><i class="fas fa-search"></i></button>
                        <button class="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded text-xs font-bold shadow-md" onclick="window.downloadLotPDF('${lotName}', event)"><i class="fas fa-file-pdf"></i></button>
                    ` : `
                        <button class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-bold shadow-md" onclick="window.consultLot('${lotName}')"><i class="fas fa-search"></i> Consultar</button>
                        <button class="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded text-xs font-bold shadow-md" onclick="window.downloadLotPDF('${lotName}', event)"><i class="fas fa-file-pdf"></i> PDF</button>
                        <button class="bg-orange-600 hover:bg-orange-500 text-white px-3 py-1.5 rounded text-xs font-bold shadow-md" onclick="window.undoLot('${lotName}')"><i class="fas fa-undo"></i> Deshacer</button>
                        <button class="bg-red-700 hover:bg-red-600 text-white px-3 py-1.5 rounded text-xs font-bold shadow-md" onclick="window.destroyLot('${lotName}')"><i class="fas fa-fire"></i> Destruir</button>
                    `}
                </div>
            </td>
        `;
        tbody.appendChild(row);
        
        if(!isLocked) {
            row.querySelector('input').addEventListener('change', async (e) => {
                await update(ref(database, `lotes/${lotName}`), { eurocop: e.target.value });
                e.target.style.borderColor = '#10b981'; setTimeout(() => e.target.style.borderColor = '', 1000);
            });
        }
    });
}

// Bloquear Lote Definitivamente
window.destroyLot = async (lotName) => {
    if(confirm(`⚠️ CUIDADO: Vas a confirmar la destrucción física de las placas del ${lotName}.\n\nUna vez marcado como DESTRUIDO, este lote quedará BLINDADO: no podrás deshacerlo ni modificarlo.\n\n¿Estás completamente seguro de continuar?`)) {
        try {
            await update(ref(database, `lotes/${lotName}`), { estado: 'destruido' });
            alert(`🔒 El ${lotName} ha sido blindado exitosamente.`);
            await loadPlates();
        } catch (error) {
            console.error(error);
            alert("Error al destruir el lote.");
        }
    }
};

window.consultLot = (lotName) => {
    currentConsultedLotName = lotName; 
    document.getElementById('consultLotTitle').textContent = `Placas del ${lotName}`;
    const list = document.getElementById('consultLotList');
    list.innerHTML = '';
    currentPlatesInConsultedLot = uniqueLots[lotName].map(id => allPlatesData.find(p => p.id === id)).filter(Boolean);
    currentPlatesInConsultedLot.forEach((p, idx) => {
        list.innerHTML += `<li class="p-2 border-b border-gadBorder last:border-0 flex justify-between"><span class="text-gray-400">${idx+1}. ${p.PAIS}</span> <span class="text-red-400 font-bold">${p.PLACA}</span></li>`;
    });
    document.getElementById('modal-overlay').style.display = 'block';
    document.getElementById('consultLotModal').style.display = 'flex';
};

window.undoLot = async (lotName) => {
    const metadata = lotMetadataGlobal[lotName];
    if (metadata && metadata.estado === 'destruido') { return alert("Acción denegada. Este lote está blindado."); }
    
    if (confirm(`¿Estás seguro de deshacer el ${lotName}? Las placas volverán a estar pendientes.`)) {
        const updates = {};
        uniqueLots[lotName].forEach(id => updates[`placas_destruccion/${id}/LoteDestruccion`] = "");
        await remove(ref(database, `lotes/${lotName}`));
        await update(ref(database), updates);
        loadPlates();
    }
};

// ==========================================
// GENERACIÓN DE PDF: BASE64 E INCRUSTACIÓN
// ==========================================

// Función auxiliar para forzar la carga de la imagen en Base64
async function getBase64ImageFromUrl(imageUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width; canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(null); // Si falla, devolvemos null para no romper el PDF
        img.src = imageUrl;
    });
}

window.downloadLotPDF = async (lotName, event) => {
    const platesArray = uniqueLots[lotName].map(id => allPlatesData.find(p => p.id === id)).filter(Boolean);
    
    let btn = null; let originalHtml = "";
    if (event && event.currentTarget) {
        btn = event.currentTarget;
        originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        btn.disabled = true;
    }
    
    await generatePDFForLot(lotName, platesArray);
    
    if (btn) { btn.innerHTML = originalHtml; btn.disabled = false; }
};

async function generatePDFForLot(lotName, platesArray) {
    if (!platesArray || platesArray.length === 0) return alert("No hay datos para exportar.");
    
    // ORDENACIÓN ALFABÉTICA OBLIGATORIA POR MATRÍCULA
    platesArray.sort((a, b) => (a.PLACA || '').localeCompare(b.PLACA || ''));

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // 1. OBTENER IMÁGENES EN BASE64
    const logoIzquierda = await getBase64ImageFromUrl('../ASSETS/judicial.png') || await getBase64ImageFromUrl('../ASSETS/logodestructora.png'); 
    const logoDerecha = await getBase64ImageFromUrl('../ASSETS/logogad.png');

    // 2. INCRUSTAR LOGOS O DIBUJAR RECUADRO SI FALLAN
    if(logoIzquierda) {
        doc.addImage(logoIzquierda, 'PNG', 14, 10, 25, 25);
    } else {
        doc.setDrawColor(200, 200, 200); doc.rect(14, 10, 25, 25); doc.setFontSize(8); doc.text("judicial.png", 16, 23);
    }

    if(logoDerecha) {
        doc.addImage(logoDerecha, 'PNG', 171, 10, 25, 25);
    } else {
        doc.setDrawColor(200, 200, 200); doc.rect(171, 10, 25, 25); doc.text("logogad.png", 173, 23);
    }

    // 3. CABECERA: TEXTO CENTRAL EXACTO
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("EXCMO. AYUNTAMIENTO DE ALICANTE", 105, 12, { align: "center" });
    doc.text("POLICÍA LOCAL", 105, 17, { align: "center" });
    
    doc.setFontSize(9);
    doc.text("Grupo de Análisis Documental", 105, 22, { align: "center" });
    doc.text("Unidad Judicial de Tráfico", 105, 26, { align: "center" });
    
    doc.setFont("helvetica", "normal");
    doc.text("Av. Julián Besteiro 15", 105, 30, { align: "center" });
    doc.setTextColor(30, 64, 175);
    doc.text("Email: policia.gad@alicante.es", 105, 34, { align: "center" });
    doc.setTextColor(0, 0, 0);
    doc.text("TEL: +34629111387 - Central PL 965107200", 105, 38, { align: "center" });
    doc.line(14, 42, 196, 42);

    // 4. TÍTULO DEL LOTE Y FECHA
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`Registro GAD - Placas del ${lotName}`, 14, 49);
    
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    const today = new Date();
    const formattedDate = today.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    doc.text(`Generado el: ${formattedDate} - Total Placas: ${platesArray.length}`, 14, 54);

    // 5. PREPARACIÓN DE DATOS A 3 COLUMNAS
    const bodyData = [];
    for (let i = 0; i < platesArray.length; i += 3) {
        const row = [];
        for (let j = 0; j < 3; j++) {
            if (i + j < platesArray.length) {
                const p = platesArray[i + j];
                row.push(i + j + 1, p.PAIS || '', p.PLACA || '');
            } else {
                row.push('', '', ''); // Rellenos vacíos para cuadrar columnas
            }
        }
        bodyData.push(row);
    }

    // 6. TABLA COMPACTA DE 3 COLUMNAS
    doc.autoTable({
        startY: 58,
        head: [['#', 'PAÍS', 'PLACA', '#', 'PAÍS', 'PLACA', '#', 'PAÍS', 'PLACA']],
        body: bodyData,
        theme: 'grid',
        headStyles: { fillColor: [220, 38, 38], fontSize: 8, halign: 'center' }, 
        styles: { fontSize: 8, cellPadding: 1 }, 
        columnStyles: {
            0: { cellWidth: 8, halign: 'center' }, 1: { cellWidth: 25 }, 2: { cellWidth: 25, fontStyle: 'bold', textColor: [220, 38, 38] },
            3: { cellWidth: 8, halign: 'center' }, 4: { cellWidth: 25 }, 5: { cellWidth: 25, fontStyle: 'bold', textColor: [220, 38, 38] },
            6: { cellWidth: 8, halign: 'center' }, 7: { cellWidth: 25 }, 8: { cellWidth: 25, fontStyle: 'bold', textColor: [220, 38, 38] }
        },
        margin: { left: 14, right: 14, bottom: 20 }
    });
    
    // 7. ESPACIO PARA FIRMAS Y SELLO AL FINAL DEL DOCUMENTO
    let finalY = doc.lastAutoTable.finalY || 58;
    if (finalY > 240) { doc.addPage(); finalY = 20; } else { finalY += 15; }

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Firma del receptor y Sello:", 14, finalY);
    doc.setDrawColor(0, 0, 0); 
    doc.rect(14, finalY + 3, 100, 35); 

    doc.save(`Placas_${lotName.replace(/\s+/g, '_')}.pdf`);
}

function handleExportToExcel() {
    if (currentPlatesInConsultedLot.length === 0) return alert("No hay datos para exportar.");
    let csv = "PAIS,PLACA\n";
    currentPlatesInConsultedLot.forEach(p => csv += `"${p.PAIS || ''}","${p.PLACA || ''}"\n`);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = `Placas_${currentConsultedLotName.replace(/\s+/g, '_')}.csv`;
    link.click();
}

// --- EDICIÓN Y ANULACIÓN ---
function handleEditPlate(id) {
    const paisTd = document.getElementById(`pais-${id}`);
    const placaTd = document.getElementById(`placa-${id}`);
    const oldPais = paisTd.textContent, oldPlaca = placaTd.textContent;
    paisTd.innerHTML = `<input type="text" value="${oldPais}" class="inline-edit-input" id="edit-pais-${id}">`;
    placaTd.innerHTML = `<input type="text" value="${oldPlaca}" class="inline-edit-input" id="edit-placa-${id}">`;
    document.getElementById(`edit-pais-${id}`).focus();
    
    const save = async () => {
        const nPais = document.getElementById(`edit-pais-${id}`).value.trim().toUpperCase();
        const nPlaca = document.getElementById(`edit-placa-${id}`).value.trim().toUpperCase();
        if (nPais && nPlaca && (nPais !== oldPais || nPlaca !== oldPlaca)) {
            await update(ref(database, `placas_destruccion/${id}`), { PAIS: nPais, PLACA: nPlaca });
            paisTd.textContent = nPais; placaTd.textContent = nPlaca;
            const idx = allPlatesData.findIndex(p => p.id === id);
            if(idx > -1) { allPlatesData[idx].PAIS = nPais; allPlatesData[idx].PLACA = nPlaca; }
        } else { paisTd.textContent = oldPais; placaTd.textContent = oldPlaca; }
    };
    
    document.getElementById(`edit-pais-${id}`).addEventListener('blur', save);
    document.getElementById(`edit-placa-${id}`).addEventListener('blur', save);
    document.getElementById(`edit-placa-${id}`).addEventListener('keypress', (e) => { if(e.key === 'Enter') save(); });
}

async function handleAnularPlate(placa) {
    if (confirm(`¿Mover la placa ${placa.PLACA} a Devolución?`)) {
        await update(ref(database, `placas_anuladas/${placa.id}`), { PAIS: placa.PAIS, PLACA: placa.PLACA, FECHA_ANULACION: new Date().toISOString() });
        await remove(ref(database, `placas_destruccion/${placa.id}`));
        loadPlates();
    }
}

async function handleSaveNewPlate() {
    const pais = document.getElementById('newPlateCountry').value.trim().toUpperCase();
    const placa = document.getElementById('newPlateNumber').value.trim().toUpperCase();
    if (!pais || !placa) return alert("Completa País y Placa.");
    if (allPlatesData.some(p => p.PLACA === placa && p.PAIS === pais)) return alert("Placa duplicada.");
    
    await push(ref(database, 'placas_destruccion'), { PAIS: pais, PLACA: placa, FECHA_AGREGADA: new Date().toISOString(), LoteDestruccion: "" });
    document.getElementById('newPlateCountry').value = ''; document.getElementById('newPlateNumber').value = '';
    document.getElementById('modal-overlay').style.display = 'none'; document.getElementById('newPlateModal').style.display = 'none';
    loadPlates();
}

function renderAnuladasModal() {
    const tbody = document.getElementById('anuladasListBody');
    tbody.innerHTML = '';
    if(anuladasData.length === 0) { tbody.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-gray-500">No hay placas devueltas.</td></tr>'; return; }
    anuladasData.forEach(p => {
        tbody.innerHTML += `
            <tr class="hover:bg-slate-800 transition">
                <td class="p-3">${p.PAIS}</td><td class="p-3 text-red-400 font-bold">${p.PLACA}</td><td class="p-3 text-gray-400">${new Date(p.FECHA_ANULACION).toLocaleDateString()}</td>
                <td class="p-3 text-center">
                    <button class="text-emerald-500 hover:text-emerald-400 mr-3" onclick="window.restorePlate('${p.id}')"><i class="fas fa-trash-restore"></i></button>
                    <button class="text-red-500 hover:text-red-400" onclick="window.deleteAnulada('${p.id}')"><i class="fas fa-times"></i></button>
                </td>
            </tr>`;
    });
}

window.restorePlate = async (id) => {
    const p = anuladasData.find(x => x.id === id);
    if(confirm(`¿Restaurar ${p.PLACA}?`)) {
        await update(ref(database, `placas_destruccion/${id}`), { PAIS: p.PAIS, PLACA: p.PLACA, FECHA_AGREGADA: new Date().toISOString(), LoteDestruccion: "" });
        await remove(ref(database, `placas_anuladas/${id}`));
        loadPlates(); document.getElementById('closeAnuladasModal').click();
    }
};

window.deleteAnulada = async (id) => {
    if(confirm("¿Eliminar PERMANENTEMENTE?")) { await remove(ref(database, `placas_anuladas/${id}`)); loadAnuladas(); renderAnuladasModal(); }
};
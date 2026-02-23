import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { getDatabase, ref, get, update, push, remove } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-database.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";

// --- CONFIGURACIÓN FIREBASE V4 ---
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
let lotEurocopData = {}; 
let currentPlatesInConsultedLot = [];
let knownCountries = []; 
let isUserAuthenticated = false;

// --- AUTO LOGIN (Para Live Server) ---
const currentHost = window.location.hostname;
const isLocal = (currentHost === '127.0.0.1' || currentHost === 'localhost');

if (isLocal) {
    // IMPORTANTE: Pon aquí un correo y contraseña de tu Firebase que tenga permisos de lectura/escritura
    signInWithEmailAndPassword(auth, "tu_correo@gad.com", "TuContraseña")
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
    
    // Sort Headers
    document.querySelectorAll('.sort-header').forEach(header => {
        header.addEventListener('click', () => { handleSort(header.dataset.sortBy); });
    });
    updateSortIcons();
    
    // Filtro de Búsqueda Dinámico (Reparado)
    document.getElementById('searchPlate').addEventListener('input', handleSearchPlate);
    
    // Botón Generar Lote
    document.getElementById('generateLotButton').addEventListener('click', handleGenerateLot);

    // Checkbox Maestro (Seleccionar Todos)
    document.getElementById('selectAllCheckbox').addEventListener('change', function() {
        const checkboxes = document.querySelectorAll('.plate-checkbox:not(:disabled)');
        checkboxes.forEach(cb => { cb.checked = this.checked; });
        updateLotButton();
    });

    // Modales: Abrir y Cerrar
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
    
    // Exportaciones
    document.getElementById('exportLotToExcelButton').addEventListener('click', handleExportToExcel);
    document.getElementById('exportLotToPDFButton').addEventListener('click', handleExportToPDF);

    // Cerrar modales haciendo click fuera
    window.addEventListener('click', (e) => {
        if (e.target === overlay) {
            toggleModal('newPlateModal', false);
            toggleModal('anuladasModal', false);
            toggleModal('consultLotModal', false);
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
        
        // Renderizar (Aplica filtro si hay texto en el buscador)
        handleSearchPlate(); 
        loadLotAdministrationPanel(); 
        
    } catch (error) {
        console.error("ERROR carga:", error);
        document.getElementById('platesTableBody').innerHTML = '<tr><td colspan="7" class="text-center p-6 text-red-500">Error conectando con la base de datos.</td></tr>';
    }
}

async function loadLotMetadata() {
    const snapshot = await get(ref(database, 'lotes'));
    lotEurocopData = {}; 
    if (snapshot.exists()) {
        Object.entries(snapshot.val()).forEach(([lotNumber, metadata]) => {
            if (metadata && metadata.eurocop !== undefined) lotEurocopData[lotNumber] = metadata.eurocop;
        });
    }
}

async function loadAnuladas() {
    const snapshot = await get(ref(database, 'placas_anuladas'));
    anuladasData = []; 
    if (snapshot.exists()) {
        anuladasData = Object.entries(snapshot.val()).map(([key, value]) => ({ id: key, ...value }));
    }
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

// --- FILTRO DE BÚSQUEDA ---
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

// --- ORDENACIÓN ---
function handleSort(column) {
    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = 'asc';
    }
    updateSortIcons();
    handleSearchPlate(); // Re-renderiza manteniendo el filtro
}

function updateSortIcons() {
    document.querySelectorAll('.sort-icon').forEach(icon => icon.innerHTML = '');
    const currentIcon = document.getElementById(`sortIcon${currentSort.column}`);
    if (currentIcon) {
        currentIcon.innerHTML = currentSort.direction === 'asc' ? '<i class="fas fa-sort-up ml-1 text-blue-400"></i>' : '<i class="fas fa-sort-down ml-1 text-blue-400"></i>';
    }
}

// --- RENDERIZAR TABLA PRINCIPAL ---
function renderPlates(platesToRender) {
    const tableBody = document.getElementById('platesTableBody');
    tableBody.innerHTML = '';
    
    // Ordenar los datos antes de pintar
    platesToRender.sort((a, b) => {
        const isADestroyed = !!a.LoteDestruccion && a.LoteDestruccion.trim() !== "";
        const isBDestroyed = !!b.LoteDestruccion && b.LoteDestruccion.trim() !== "";
        if (isADestroyed !== isBDestroyed) return isADestroyed ? 1 : -1; 
        
        let aVal = a[currentSort.column] || '';
        let bVal = b[currentSort.column] || '';
        
        if (currentSort.column === 'FECHA_AGREGADA') {
            aVal = aVal ? new Date(aVal).getTime() : 0;
            bVal = bVal ? new Date(bVal).getTime() : 0;
        } else {
            aVal = String(aVal).toUpperCase();
            bVal = String(bVal).toUpperCase();
        }
        
        if (aVal < bVal) return currentSort.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
    });

    if (platesToRender.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center p-6 text-gray-500">No hay resultados.</td></tr>';
        return;
    }

    platesToRender.forEach((placa, i) => {
        const isDestroyed = placa.LoteDestruccion && placa.LoteDestruccion.trim() !== "";
        const rowClass = isDestroyed ? 'bg-emerald-900 bg-opacity-20 text-gray-400' : 'hover:bg-slate-800 transition';
        const fechaFormat = placa.FECHA_AGREGADA ? new Date(placa.FECHA_AGREGADA).toLocaleDateString('es-ES') : '';

        const row = document.createElement('tr');
        row.className = rowClass;
        
        row.innerHTML = `
            <td class="p-3 text-center">
                <input type="checkbox" data-plate-id="${placa.id}" ${isDestroyed ? 'disabled hidden' : ''} class="plate-checkbox w-4 h-4 accent-red-500 cursor-pointer">
            </td>
            <td class="p-3 text-gray-500 font-bold">${platesToRender.length - i}</td>
            <td class="p-3 font-bold" id="pais-${placa.id}">${placa.PAIS || ''}</td>
            <td class="p-3 font-bold text-red-400 text-base" id="placa-${placa.id}">${placa.PLACA || ''}</td>
            <td class="p-3 text-gray-400">${fechaFormat}</td>
            <td class="p-3 font-bold ${isDestroyed ? 'text-emerald-500' : 'text-gray-500'}">
                ${isDestroyed ? `<i class="fas fa-check-circle mr-1"></i>${placa.LoteDestruccion}` : 'PENDIENTE'}
            </td>
            <td class="p-3 text-center">
                ${!isDestroyed ? `
                    <i class="fas fa-edit action-icon text-blue-400 hover:text-blue-300 mr-3" data-plate-id="${placa.id}" title="Editar"></i>
                    <i class="fas fa-times-circle action-icon text-red-500 hover:text-red-400" data-plate-id="${placa.id}" title="Anular"></i>
                ` : ''}
            </td>
        `;
        tableBody.appendChild(row);

        // Añadir listeners a los iconos generados
        if (!isDestroyed) {
            row.querySelector('.fa-times-circle').addEventListener('click', () => handleAnularPlate(placa));
            row.querySelector('.fa-edit').addEventListener('click', () => handleEditPlate(placa.id));
        }
    });

    // Re-enlazar listeners de los checkboxes para habilitar botón Generar
    document.querySelectorAll('.plate-checkbox').forEach(cb => { 
        cb.addEventListener('change', updateLotButton); 
    });
    updateLotButton();
}

// --- GENERACIÓN DE LOTES ---
function updateLotButton() {
    const count = document.querySelectorAll('.plate-checkbox:checked').length;
    document.getElementById('selectedCount').textContent = `(${count})`;
    document.getElementById('generateLotButton').disabled = count === 0;
}

async function handleGenerateLot() {
    const selected = Array.from(document.querySelectorAll('.plate-checkbox:checked')).map(cb => cb.dataset.plateId);
    if (selected.length === 0) return;
    
    const lotName = document.getElementById('lotNumber').value;
    
    if (confirm(`¿Generar ${lotName} con ${selected.length} placas?`)) {
        try {
            const updates = {};
            selected.forEach(id => updates[`placas_destruccion/${id}/LoteDestruccion`] = lotName);
            updates[`lotes/${lotName}`] = { fechaCreacion: new Date().toLocaleDateString('es-ES'), totalPlacas: selected.length, eurocop: "" };
            
            await update(ref(database), updates);
            
            document.getElementById('selectAllCheckbox').checked = false;
            await loadPlates(); 
            alert(`✅ ${lotName} generado correctamente.`);
        } catch (error) {
            console.error("Error generando lote:", error);
            alert("Error al generar lote.");
        }
    }
}

// --- ADMINISTRACIÓN DE LOTES Y EXPORTACIÓN ---
function loadLotAdministrationPanel() {
    const tbody = document.getElementById('lotAdminBody');
    tbody.innerHTML = '';
    
    const sortedLots = Object.keys(uniqueLots).sort((a, b) => {
        return parseInt((b.match(/\d+/) || [0])[0]) - parseInt((a.match(/\d+/) || [0])[0]);
    });

    if (sortedLots.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-gray-500">Aún no se ha generado ningún lote.</td></tr>'; 
        return;
    }

    sortedLots.forEach(lotName => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-slate-800 transition';
        const dateMatch = lotName.match(/\((.*?)\)/);
        
        row.innerHTML = `
            <td class="p-3 font-bold text-gray-300">${lotName.replace(/\s*\([^)]*\)/, '')}</td>
            <td class="p-3">
                <input type="text" value="${lotLotDataEurocop(lotName)}" data-lot="${lotName}" placeholder="Nº Eurocop" class="bg-gadBg border border-gadBorder text-white px-2 py-1 rounded w-28 outline-none focus:border-blue-500">
            </td>
            <td class="p-3 font-bold">${uniqueLots[lotName].length}</td>
            <td class="p-3 text-gray-400">${dateMatch ? dateMatch[1] : 'N/A'}</td>
            <td class="p-3">
                <button class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded text-xs font-bold mr-2" onclick="window.consultLot('${lotName}')"><i class="fas fa-search"></i> Consultar</button>
                <button class="bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded text-xs font-bold" onclick="window.undoLot('${lotName}')"><i class="fas fa-undo"></i> Deshacer</button>
            </td>
        `;
        tbody.appendChild(row);
        
        row.querySelector('input').addEventListener('change', async (e) => {
            await update(ref(database, `lotes/${lotName}`), { eurocop: e.target.value });
            e.target.style.borderColor = '#10b981';
            setTimeout(() => e.target.style.borderColor = '', 1000);
        });
    });
}

function lotLotDataEurocop(lotName) {
    const raw = lotName.replace(/\s*\([^)]*\)/, '');
    return lotEurocopData[raw] || '';
}

window.consultLot = (lotName) => {
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
    if (confirm(`¿Estás seguro de deshacer el ${lotName}? Las placas volverán a estar pendientes.`)) {
        const updates = {};
        uniqueLots[lotName].forEach(id => updates[`placas_destruccion/${id}/LoteDestruccion`] = "");
        await remove(ref(database, `lotes/${lotName}`));
        await update(ref(database), updates);
        loadPlates();
    }
};

// --- PDF Y EXCEL (Reparados) ---
function handleExportToPDF() {
    if (currentPlatesInConsultedLot.length === 0) return alert("No hay datos para exportar.");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const title = document.getElementById('consultLotTitle').textContent;
    
    doc.setFontSize(16);
    doc.text(`Registro GAD - ${title}`, 14, 20);
    
    doc.autoTable({
        startY: 30,
        head: [['#', 'PAÍS', 'PLACA']],
        body: currentPlatesInConsultedLot.map((p, i) => [i + 1, p.PAIS || '', p.PLACA || '']),
        theme: 'grid',
        headStyles: { fillColor: [220, 38, 38] } // Rojo Tailwind (red-600)
    });
    
    doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
}

function handleExportToExcel() {
    if (currentPlatesInConsultedLot.length === 0) return alert("No hay datos para exportar.");
    let csv = "PAIS,PLACA\n";
    currentPlatesInConsultedLot.forEach(p => csv += `"${p.PAIS || ''}","${p.PLACA || ''}"\n`);
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${document.getElementById('consultLotTitle').textContent.replace(/\s+/g, '_')}.csv`;
    link.click();
}

// --- EDICIÓN Y ANULACIÓN DE PLACAS INDIVIDUALES ---
function handleEditPlate(id) {
    const paisTd = document.getElementById(`pais-${id}`);
    const placaTd = document.getElementById(`placa-${id}`);
    const oldPais = paisTd.textContent;
    const oldPlaca = placaTd.textContent;
    
    paisTd.innerHTML = `<input type="text" value="${oldPais}" class="inline-edit-input" id="edit-pais-${id}">`;
    placaTd.innerHTML = `<input type="text" value="${oldPlaca}" class="inline-edit-input" id="edit-placa-${id}">`;
    document.getElementById(`edit-pais-${id}`).focus();
    
    const save = async () => {
        const nPais = document.getElementById(`edit-pais-${id}`).value.trim().toUpperCase();
        const nPlaca = document.getElementById(`edit-placa-${id}`).value.trim().toUpperCase();
        
        if (nPais && nPlaca && (nPais !== oldPais || nPlaca !== oldPlaca)) {
            await update(ref(database, `placas_destruccion/${id}`), { PAIS: nPais, PLACA: nPlaca });
            paisTd.textContent = nPais;
            placaTd.textContent = nPlaca;
            const idx = allPlatesData.findIndex(p => p.id === id);
            if(idx > -1) { allPlatesData[idx].PAIS = nPais; allPlatesData[idx].PLACA = nPlaca; }
        } else {
            paisTd.textContent = oldPais;
            placaTd.textContent = oldPlaca;
        }
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

// --- NUEVA PLACA ---
async function handleSaveNewPlate() {
    const pais = document.getElementById('newPlateCountry').value.trim().toUpperCase();
    const placa = document.getElementById('newPlateNumber').value.trim().toUpperCase();
    
    if (!pais || !placa) return alert("Completa País y Placa.");
    if (allPlatesData.some(p => p.PLACA === placa && p.PAIS === pais)) return alert("Placa duplicada.");
    
    await push(ref(database, 'placas_destruccion'), { PAIS: pais, PLACA: placa, FECHA_AGREGADA: new Date().toISOString(), LoteDestruccion: "" });
    
    document.getElementById('newPlateCountry').value = '';
    document.getElementById('newPlateNumber').value = '';
    document.getElementById('modal-overlay').style.display = 'none';
    document.getElementById('newPlateModal').style.display = 'none';
    loadPlates();
}

// --- MODAL ANULADAS ---
function renderAnuladasModal() {
    const tbody = document.getElementById('anuladasListBody');
    tbody.innerHTML = '';
    if(anuladasData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-gray-500">No hay placas devueltas.</td></tr>';
        return;
    }
    anuladasData.forEach(p => {
        tbody.innerHTML += `
            <tr class="hover:bg-slate-800 transition">
                <td class="p-3">${p.PAIS}</td>
                <td class="p-3 text-red-400 font-bold">${p.PLACA}</td>
                <td class="p-3 text-gray-400">${new Date(p.FECHA_ANULACION).toLocaleDateString()}</td>
                <td class="p-3 text-center">
                    <button class="text-emerald-500 hover:text-emerald-400 mr-3" onclick="window.restorePlate('${p.id}')"><i class="fas fa-trash-restore"></i></button>
                    <button class="text-red-500 hover:text-red-400" onclick="window.deleteAnulada('${p.id}')"><i class="fas fa-times"></i></button>
                </td>
            </tr>
        `;
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
    if(confirm("¿Eliminar PERMANENTEMENTE?")) {
        await remove(ref(database, `placas_anuladas/${id}`));
        loadAnuladas(); renderAnuladasModal();
    }
};
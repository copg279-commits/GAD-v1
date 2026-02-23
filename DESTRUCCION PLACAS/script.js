import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { getDatabase, ref, get, update, push, remove } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-database.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";

// --- CONFIGURACIÓN V4 ---
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

// --- VARIABLES GLOBALES (Declaradas al inicio para evitar errores ReferenceError) ---
let allPlatesData = []; 
let anuladasData = []; 
let uniqueLots = {}; 
let currentSort = { column: 'FECHA_AGREGADA', direction: 'desc' };
let lotEurocopData = {}; 
let currentPlatesInConsultedLot = [];
let knownCountries = []; 
let isUserAuthenticated = false;

// --- SISTEMA DE AUTENTICACIÓN INTELIGENTE ---
const currentHost = window.location.hostname;
const isLocal = (currentHost === '127.0.0.1' || currentHost === 'localhost');

if (isLocal) {
    console.warn("⚠️ Entorno local detectado. Ejecutando Auto-login...");
    // IMPORTANTE: Sustituye este correo y contraseña por UNO QUE SÍ TENGA PERMISOS en tu Firebase original
    signInWithEmailAndPassword(auth, "test@gad.com", "123456")
        .catch(error => console.error("Error al forzar login local:", error));
}

// Única fuente de verdad para saber si estamos conectados (funciona tanto para auto-login como para GitHub)
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Usuario autenticado correctamente:", user.email);
        isUserAuthenticated = true;
        document.getElementById('auth-loading-screen').style.display = 'none';
        document.getElementById('main-app-content').style.display = 'block';
        initApp(); // Arranca la app SOLO cuando estamos 100% verificados
    } else {
        isUserAuthenticated = false;
        if (!isLocal) {
            document.getElementById('auth-loading-screen').innerHTML = 
                "<div class='text-center text-red-500'><i class='fas fa-lock fa-3x mb-3'></i><br>ACCESO DENEGADO<br><span class='text-sm text-gray-300'>Inicia sesión en el Menú Principal</span></div>";
        }
    }
});

// --- INICIALIZACIÓN DE LA APP ---
function initApp() {
    loadPlates();
    
    document.querySelectorAll('.sort-header').forEach(header => {
        header.addEventListener('click', () => { handleSort(header.dataset.sortBy); });
    });
    updateSortIcons();
    
    // Listeners Modales
// --- Listeners Modales ---
    const overlay = document.getElementById('modal-overlay');

    // 1. Modal Nueva Placa
    document.getElementById('openNewPlateModal').addEventListener('click', () => {
        overlay.style.display = 'block';
        document.getElementById('newPlateModal').style.display = 'block';
    });
    document.getElementById('closeNewPlateModal').addEventListener('click', () => {
        overlay.style.display = 'none';
        document.getElementById('newPlateModal').style.display = 'none';
    });
    document.getElementById('saveNewPlateButton').addEventListener('click', handleSaveNewPlate);
    
    // 2. Modal Devolución (Anuladas)
    document.getElementById('openAnuladasModal').addEventListener('click', () => { 
        renderAnuladasModal(); 
        overlay.style.display = 'block';
        document.getElementById('anuladasModal').style.display = 'block'; 
    });
    document.getElementById('closeAnuladasModal').addEventListener('click', () => { 
        overlay.style.display = 'none';
        document.getElementById('anuladasModal').style.display = 'none'; 
    });
    
    // 3. Botón cerrar del Modal Consultar Lote
    document.getElementById('closeConsultLotModal').addEventListener('click', () => { 
        overlay.style.display = 'none';
        document.getElementById('consultLotModal').style.display = 'none'; 
    });
    
    // 4. Cerrar ventanas si el usuario hace clic en el fondo oscuro
    window.addEventListener('click', function(event) {
        if (event.target === overlay) {
            overlay.style.display = 'none';
            document.getElementById('newPlateModal').style.display = 'none';
            document.getElementById('anuladasModal').style.display = 'none';
            document.getElementById('consultLotModal').style.display = 'none';
        }
    });
    
    window.addEventListener('click', function(event) {
        const newPlateModal = document.getElementById('newPlateModal');
        const anuladasModal = document.getElementById('anuladasModal');
        const consultLotModal = document.getElementById('consultLotModal');
        if (event.target === newPlateModal) newPlateModal.style.display = 'none';
        if (event.target === anuladasModal) anuladasModal.style.display = 'none';
        if (event.target === consultLotModal) consultLotModal.style.display = 'none';
    });
    
    document.getElementById('newPlateCountry').addEventListener('keypress', function(e) { if (e.key === 'Enter') document.getElementById('newPlateNumber').focus(); });
    document.getElementById('newPlateNumber').addEventListener('keypress', function(e) { if (e.key === 'Enter') handleSaveNewPlate(); });
}

async function loadLotMetadata() {
    try {
        const dbRef = ref(database, 'lotes');
        const snapshot = await get(dbRef);
        lotEurocopData = {}; 
        if (snapshot.exists()) {
            const data = snapshot.val();
            Object.entries(data).forEach(([lotNumber, metadata]) => {
                if (metadata && metadata.eurocop !== undefined) lotEurocopData[lotNumber] = metadata.eurocop;
            });
        }
    } catch (error) { console.error("Error EUROCOP:", error); }
}

window.saveEurocopValue = async function(inputElement) {
    if(!isUserAuthenticated) return alert("No autorizado.");
    const lotNumber = inputElement.dataset.lotNumber; 
    const value = inputElement.value.trim();
    if (lotEurocopData[lotNumber] === value) return;
    lotEurocopData[lotNumber] = value;
    try {
        const lotRef = ref(database, `lotes/${lotNumber}`);
        await update(lotRef, { eurocop: value });
        inputElement.style.borderColor = '#10b981'; 
        setTimeout(() => { inputElement.style.borderColor = ''; }, 1000);
    } catch (error) { console.error(`Error save EUROCOP:`, error); inputElement.style.borderColor = '#ef4444'; }
}

async function loadPlates() {
    const tableBody = document.getElementById('platesTableBody');
    tableBody.innerHTML = '<tr id="loadingRow"><td colspan="7" class="text-center py-6 text-gray-400"><i class="fas fa-spinner fa-spin"></i> Cargando datos...</td></tr>';
    document.getElementById('lotAdminBody').innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-400"><i class="fas fa-spinner fa-spin"></i> Cargando lotes...</td></tr>'; 

    try {
        await loadLotMetadata(); 
        await loadAnuladas(); 
        
        const dbRef = ref(database, 'placas_destruccion');
        const snapshot = await get(dbRef);

        tableBody.innerHTML = ''; 
        allPlatesData = []; 
        uniqueLots = {}; 

        if (snapshot.exists()) {
            const data = snapshot.val(); 
            allPlatesData = Object.entries(data).map(([key, value]) => {
                if (value.LoteDestruccion && value.LoteDestruccion.trim() !== "") {
                    const lotName = value.LoteDestruccion;
                    if (!uniqueLots[lotName]) uniqueLots[lotName] = [];
                    uniqueLots[lotName].push(key);
                }
                return { id: key, ...value };
            });
            await getNextLotNumber();
            document.getElementById('plateCounter').textContent = allPlatesData.length; 
            extractAndRenderCountries(); 
            renderPlates(allPlatesData);
            loadLotAdministrationPanel(); 
        } else {
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-6 text-yellow-500">❌ Base de datos vacía.</td></tr>';
            document.getElementById('plateCounter').textContent = '0';
            loadLotAdministrationPanel(); 
        }
    } catch (error) {
        console.error("🚨 ERROR carga:", error);
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-6 text-red-500">Error de conexión V4. Verifica tus permisos de base de datos.</td></tr>';
    }
}

function extractAndRenderCountries() {
    const uniqueCountriesSet = new Set();
    allPlatesData.forEach(placa => { if (placa.PAIS && placa.PAIS.trim() !== "") uniqueCountriesSet.add(placa.PAIS.trim().toUpperCase()); });
    knownCountries = Array.from(uniqueCountriesSet).sort();
    const datalist = document.getElementById('countryDatalist');
    datalist.innerHTML = ''; 
    knownCountries.forEach(country => { const option = document.createElement('option'); option.value = country; datalist.appendChild(option); });
}

async function loadAnuladas() {
    try {
        const dbRef = ref(database, 'placas_anuladas');
        const snapshot = await get(dbRef);
        anuladasData = []; 
        if (snapshot.exists()) {
            const data = snapshot.val(); 
            anuladasData = Object.entries(data).map(([key, value]) => ({ id: key, ...value }));
        }
        document.getElementById('anuladasCount').textContent = anuladasData.length;
    } catch (error) { console.error("Error anuladas:", error); }
}

async function getNextLotNumber() {
    try {
        let maxLotNumber = 0;
        allPlatesData.forEach(placa => {
            if (placa.LoteDestruccion) {
                const match = placa.LoteDestruccion.match(/LOTE (\d+)/i);
                if (match) {
                    const currentLotNum = parseInt(match[1]);
                    if (currentLotNum > maxLotNumber) maxLotNumber = currentLotNum;
                }
            }
        });
        const nextLotNum = maxLotNumber + 1;
        const lotName = `LOTE ${nextLotNum}`;
        document.getElementById('lotNumber').value = lotName;
        return lotName;
    } catch (error) { console.error("Error next lot:", error); document.getElementById('lotNumber').value = 'LOTE 1'; return 'LOTE 1'; }
}

function renderPlates(platesToRender) {
    const tableBody = document.getElementById('platesTableBody');
    tableBody.innerHTML = '';
    
    if (document.getElementById('searchPlate').value.trim() === "") {
        platesToRender.sort((a, b) => {
            const isADestroyed = !!a.LoteDestruccion && a.LoteDestruccion.trim() !== "";
            const isBDestroyed = !!b.LoteDestruccion && b.LoteDestruccion.trim() !== "";
            if (isADestroyed !== isBDestroyed) return isADestroyed ? 1 : -1; 
            let aVal, bVal;
            if (currentSort.column === 'FECHA_AGREGADA') {
                aVal = a.FECHA_AGREGADA ? new Date(a.FECHA_AGREGADA).getTime() : 0;
                bVal = b.FECHA_AGREGADA ? new Date(b.FECHA_AGREGADA).getTime() : 0;
            } else {
                aVal = String(a[currentSort.column] || '').toUpperCase();
                bVal = String(b[currentSort.column] || '').toUpperCase();
            }
            if (aVal < bVal) return currentSort.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return currentSort.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }
    
    let totalPlates = platesToRender.length; 
    if (platesToRender.length === 0) { tableBody.innerHTML = '<tr><td colspan="7" class="text-center py-6 text-gray-400">No se encontraron placas que coincidan con la búsqueda.</td></tr>'; }

    platesToRender.forEach((placa, i) => {
        const key = placa.id;
        const isDestroyed = placa.LoteDestruccion && placa.LoteDestruccion.trim() !== "";
        const rowClass = i % 2 === 0 ? 'table-row-even' : 'table-row-odd';
        let fechaFormateada = '';
        if (placa.FECHA_AGREGADA) { const fecha = new Date(placa.FECHA_AGREGADA); fechaFormateada = fecha.toLocaleDateString('es-ES'); }
        
        const row = document.createElement('tr');
        row.classList.add(rowClass, 'hover:bg-gray-700', 'transition', 'duration-150');
        if (isDestroyed) {
            row.classList.remove('table-row-even', 'table-row-odd', 'hover:bg-gray-700');
            row.classList.add('bg-green-900', 'bg-opacity-20', 'hover:bg-opacity-30');
        }

        row.innerHTML = `
            <td data-label="Seleccionar" class="px-4 py-4 whitespace-nowrap text-sm text-gray-300">
                <input type="checkbox" data-plate-id="${key}" ${isDestroyed ? 'disabled' : ''} class="plate-checkbox rounded bg-gray-700 border-gray-600 text-red-500 focus:ring-red-500">
            </td>
            <td data-label="#" class="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-300">${totalPlates - i}</td> 
            <td id="pais-${key}" data-label="País" class="px-4 py-4 whitespace-nowrap text-sm text-gray-300 font-bold">${placa.PAIS || ''}</td>
            <td id="placa-${key}" data-label="Placa" class="px-4 py-4 whitespace-nowrap text-base font-bold text-red-500">${placa.PLACA || ''}</td>
            <td data-label="Fecha Agregada" class="px-4 py-4 whitespace-nowrap text-sm text-gray-400">${fechaFormateada}</td>
            <td data-label="Estado / Lote" class="px-4 py-4 whitespace-nowrap text-sm font-semibold ${isDestroyed ? 'text-green-400' : 'text-gray-500'}">
                ${isDestroyed ? `<i class="fas fa-check-circle"></i> ${placa.LoteDestruccion}` : 'PENDIENTE'}
            </td>
            <td data-label="Acción" class="px-4 py-4 whitespace-nowrap text-center text-sm font-medium flex justify-center items-center space-x-4">
                ${isDestroyed ? '' : `<i class="fas fa-edit edit-icon text-blue-400 hover:text-blue-300 cursor-pointer" data-plate-id="${key}" title="Editar País/Placa"></i>`}
                <i class="fas fa-times-circle delete-icon" data-plate-id="${key}" title="Anular placa y mover a sección 'Devolución'"></i>
            </td>
        `;
        tableBody.appendChild(row);
        
        row.querySelector('.delete-icon').addEventListener('click', handleAnularPlate);
        const editIcon = row.querySelector('.edit-icon');
        if(editIcon) editIcon.addEventListener('click', handleEditPlate);
    });
    
    document.querySelectorAll('.plate-checkbox').forEach(cb => { cb.addEventListener('change', updateLotButton); });
    updateLotButton(); 
}

function loadLotAdministrationPanel() {
    const lotAdminBody = document.getElementById('lotAdminBody');
    lotAdminBody.innerHTML = '';
    
    const sortedLots = Object.keys(uniqueLots).sort((a, b) => {
        const numA = parseInt((a.match(/LOTE (\d+)/i) || [0, 0])[1]);
        const numB = parseInt((b.match(/LOTE (\d+)/i) || [0, 0])[1]);
        return numB - numA; 
    });

    if (sortedLots.length === 0) {
        lotAdminBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-gray-500">Aún no se ha generado ningún lote.</td></tr>'; 
        return;
    }

    sortedLots.forEach((lotName, i) => {
        const plateCount = uniqueLots[lotName].length;
        const row = document.createElement('tr');
        row.classList.add(i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750', 'hover:bg-gray-700');
        const lotNumberOnly = lotName.replace(/\s*\([^)]*\)/, '');
        const dateMatch = lotName.match(/\((.*?)\)/);
        const eurocopValue = lotEurocopData[lotNumberOnly] || ''; 

        row.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-200">${lotNumberOnly}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-400">
                <input type="text" value="${eurocopValue}" data-lot-number="${lotNumberOnly}" placeholder="Nº EUROCOP"
                       class="eurocop-input w-full bg-gray-700 border border-gray-600 text-white rounded-md p-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none">
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-300">${plateCount}</td>
            <td class="px-4 py-3 whitespace-nowrap text-xs text-gray-400">${dateMatch ? dateMatch[1] : 'Desconocida'}</td> 
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium flex flex-col sm:flex-row items-start sm:items-center justify-start space-y-2 sm:space-y-0 sm:space-x-3"> 
                <button data-lot-name="${lotName}" class="consult-lot-btn text-blue-400 hover:text-blue-300 font-bold text-xs whitespace-nowrap w-full sm:w-auto text-left"> 
                    <i class="fas fa-search-plus"></i> Consultar
                </button>
                <button data-lot-name="${lotName}" class="undo-lot-admin-btn text-red-500 hover:text-red-400 font-bold text-xs whitespace-nowrap w-full sm:w-auto text-left">
                    <i class="fas fa-undo"></i> Deshacer Lote
                </button>
            </td>
        `;
        lotAdminBody.appendChild(row);
        
        const eurocopInput = row.querySelector('.eurocop-input');
        eurocopInput.addEventListener('change', function() { window.saveEurocopValue(this); });
        
        row.querySelector('.consult-lot-btn').addEventListener('click', handleConsultLot);
        row.querySelector('.undo-lot-admin-btn').addEventListener('click', handleUndoLot);
    });
}

function renderAnuladasModal() {
    const anuladasListBody = document.getElementById('anuladasListBody');
    anuladasListBody.innerHTML = '';
    
    if (anuladasData.length === 0) {
        anuladasListBody.innerHTML = '<tr><td colspan="4" class="text-center py-6 text-gray-400">No hay placas anuladas.</td></tr>';
        return;
    }
    
    anuladasData.forEach((placa, i) => {
        const row = document.createElement('tr');
        row.classList.add(i % 2 === 0 ? 'bg-gray-800' : 'bg-gray-750', 'hover:bg-gray-700');
        
        let fechaDevolucionFormateada = '';
        if (placa.FECHA_ANULACION) {
            const fecha = new Date(placa.FECHA_ANULACION);
            fechaDevolucionFormateada = fecha.toLocaleDateString('es-ES');
        }
        
        row.innerHTML = `
            <td class="px-4 py-3 text-sm font-bold text-gray-300">${placa.PAIS || ''}</td>
            <td class="px-4 py-3 text-sm font-bold text-red-500">${placa.PLACA || ''}</td>
            <td class="px-4 py-3 text-sm text-gray-400">${fechaDevolucionFormateada}</td>
            <td class="px-4 py-3 text-center">
                <div class="flex justify-center items-center space-x-3">
                    <button data-plate-id="${placa.id}" class="restore-plate-btn text-green-500 hover:text-green-400 font-bold text-xs whitespace-nowrap">
                        <i class="fas fa-trash-restore"></i> Restaurar
                    </button>
                    <i class="fas fa-trash permanent-delete-icon text-red-500 hover:text-red-400" data-plate-id="${placa.id}" title="Eliminar permanentemente"></i>
                </div>
            </td>
        `;
        anuladasListBody.appendChild(row);
        
        row.querySelector('.restore-plate-btn').addEventListener('click', handleRestorePlate);
        row.querySelector('.permanent-delete-icon').addEventListener('click', handlePermanentDelete);
    });
}

function handleEditPlate(event) {
    const plateId = event.currentTarget.dataset.plateId;
    const paisCell = document.getElementById(`pais-${plateId}`);
    const placaCell = document.getElementById(`placa-${plateId}`);
    const currentPais = paisCell.textContent;
    const currentPlaca = placaCell.textContent;
    
    paisCell.innerHTML = `<input type="text" value="${currentPais}" class="inline-edit-input" id="edit-pais-${plateId}" list="countryDatalist">`;
    placaCell.innerHTML = `<input type="text" value="${currentPlaca}" class="inline-edit-input" id="edit-placa-${plateId}">`;
    
    const editPaisInput = document.getElementById(`edit-pais-${plateId}`);
    const editPlacaInput = document.getElementById(`edit-placa-${plateId}`);
    
    editPaisInput.focus();
    
    const saveEdit = () => {
        const newPais = editPaisInput.value.trim().toUpperCase();
        const newPlaca = editPlacaInput.value.trim().toUpperCase();
        if (newPais && newPlaca) updatePlateInDatabase(plateId, newPais, newPlaca);
        else { paisCell.textContent = currentPais; placaCell.textContent = currentPlaca; }
    };
    
    editPaisInput.addEventListener('blur', saveEdit);
    editPlacaInput.addEventListener('blur', saveEdit);
    editPaisInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') saveEdit(); });
    editPlacaInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') saveEdit(); });
}

async function updatePlateInDatabase(plateId, newPais, newPlaca) {
    if(!isUserAuthenticated) return alert("No autorizado.");
    try {
        const plateRef = ref(database, `placas_destruccion/${plateId}`);
        await update(plateRef, { PAIS: newPais, PLACA: newPlaca });
        
        const paisCell = document.getElementById(`pais-${plateId}`);
        const placaCell = document.getElementById(`placa-${plateId}`);
        if(paisCell) paisCell.textContent = newPais;
        if(placaCell) placaCell.textContent = newPlaca;
        
        const plateIndex = allPlatesData.findIndex(p => p.id === plateId);
        if (plateIndex !== -1) { allPlatesData[plateIndex].PAIS = newPais; allPlatesData[plateIndex].PLACA = newPlaca; }
    } catch (error) { console.error("Error update:", error); alert("Error al actualizar."); }
}

function handleAnularPlate(event) {
    if(!isUserAuthenticated) return alert("No autorizado.");
    const plateId = event.currentTarget.dataset.plateId;
    const plate = allPlatesData.find(p => p.id === plateId);
    if (!plate) return alert("Error: Placa no encontrada.");
    if (confirm(`¿Anular la placa ${plate.PLACA} (${plate.PAIS}) y moverla a "Devolución"?`)) anularPlate(plateId, plate);
}

async function anularPlate(plateId, plateData) {
    try {
        const anuladasRef = ref(database, `placas_anuladas/${plateId}`);
        await update(anuladasRef, { PAIS: plateData.PAIS, PLACA: plateData.PLACA, FECHA_ANULACION: new Date().toISOString() });
        const plateRef = ref(database, `placas_destruccion/${plateId}`);
        await remove(plateRef);
        await loadPlates(); await loadAnuladas(); 
    } catch (error) { console.error("Error anular:", error); alert("Error al anular."); }
}

function handleRestorePlate(event) {
    if(!isUserAuthenticated) return alert("No autorizado.");
    const plateId = event.currentTarget.dataset.plateId;
    const plate = anuladasData.find(p => p.id === plateId);
    if (!plate) return alert("Error: Placa no encontrada.");
    if (confirm(`¿Restaurar la placa ${plate.PLACA} (${plate.PAIS})?`)) restorePlate(plateId, plate);
}

async function restorePlate(plateId, plateData) {
    try {
        const plateRef = ref(database, `placas_destruccion/${plateId}`);
        await update(plateRef, { PAIS: plateData.PAIS, PLACA: plateData.PLACA, FECHA_AGREGADA: new Date().toISOString() });
        const anuladasRef = ref(database, `placas_anuladas/${plateId}`);
        await remove(anuladasRef);
        await loadPlates(); await loadAnuladas(); renderAnuladasModal(); 
    } catch (error) { console.error("Error restaurar:", error); alert("Error al restaurar."); }
}

function handlePermanentDelete(event) {
    if(!isUserAuthenticated) return alert("No autorizado.");
    const plateId = event.currentTarget.dataset.plateId;
    const plate = anuladasData.find(p => p.id === plateId);
    if (!plate) return alert("Error: Placa no encontrada.");
    if (confirm(`¿ELIMINAR PERMANENTEMENTE ${plate.PLACA}?`)) permanentDeletePlate(plateId);
}

async function permanentDeletePlate(plateId) {
    try {
        const anuladasRef = ref(database, `placas_anuladas/${plateId}`);
        await remove(anuladasRef);
        await loadAnuladas(); renderAnuladasModal(); 
    } catch (error) { console.error("Error eliminar:", error); alert("Error al eliminar."); }
}

function handleConsultLot(event) {
    const lotName = event.currentTarget.dataset.lotName;
    const plateIds = uniqueLots[lotName] || [];
    document.getElementById('consultLotTitle').textContent = `Placas del ${lotName}`;
    const consultLotList = document.getElementById('consultLotList');
    consultLotList.innerHTML = '';
    currentPlatesInConsultedLot = [];
    
    if (plateIds.length === 0) consultLotList.innerHTML = '<li class="text-gray-500">No hay placas.</li>';
    else {
        plateIds.forEach(plateId => {
            const plate = allPlatesData.find(p => p.id === plateId);
            if (plate) {
                currentPlatesInConsultedLot.push(plate);
                const li = document.createElement('li');
                li.className = 'flex justify-between items-center py-2 px-3 hover:bg-gray-800 rounded border-b border-gray-700 last:border-0';
                li.innerHTML = `<span class="font-semibold text-gray-300">${plate.PAIS || 'N/A'}</span><span class="font-bold text-red-500">${plate.PLACA || 'N/A'}</span>`;
                consultLotList.appendChild(li);
            }
        });
    }
    document.getElementById('consultLotModal').style.display = 'flex';
}

function handleUndoLot(event) {
    if(!isUserAuthenticated) return alert("No autorizado.");
    const lotName = event.currentTarget.dataset.lotName;
    const plateIds = uniqueLots[lotName] || [];
    if (plateIds.length === 0) return alert("No hay placas en este lote.");
    if (confirm(`¿Deshacer ${lotName}?`)) undoLot(lotName, plateIds);
}

async function undoLot(lotName, plateIds) {
    try {
        const updates = {};
        plateIds.forEach(plateId => { updates[`placas_destruccion/${plateId}/LoteDestruccion`] = ""; });
        const lotRef = ref(database, `lotes/${lotName}`);
        await remove(lotRef);
        await update(ref(database), updates);
        alert(`Lote ${lotName} deshecho.`);
        await loadPlates(); 
    } catch (error) { console.error("Error deshacer:", error); alert("Error al deshacer lote."); }
}

function updateLotButton() {
    const selectedCount = document.querySelectorAll('.plate-checkbox:checked').length;
    document.getElementById('selectedCount').textContent = `(${selectedCount})`;
    document.getElementById('generateLotButton').disabled = selectedCount === 0;
}

async function handleGenerateLot() {
    if(!isUserAuthenticated) return alert("No autorizado.");
    const selectedCheckboxes = document.querySelectorAll('.plate-checkbox:checked');
    const selectedPlateIds = Array.from(selectedCheckboxes).map(cb => cb.dataset.plateId);
    if (selectedPlateIds.length === 0) return alert("No hay placas seleccionadas.");
    
    const lotName = document.getElementById('lotNumber').value;
    const currentDate = new Date().toLocaleDateString('es-ES');
    
    if (confirm(`¿Generar ${lotName}?`)) {
        await generateLot(selectedPlateIds, lotName, currentDate);
    }
}

async function generateLot(plateIds, lotName, currentDate) {
    try {
        const updates = {};
        plateIds.forEach(plateId => { updates[`placas_destruccion/${plateId}/LoteDestruccion`] = lotName; });
        updates[`lotes/${lotName}`] = { fechaCreacion: currentDate, totalPlacas: plateIds.length, eurocop: "" };
        await update(ref(database), updates);
        
        // Obtener datos de las placas seleccionadas para el PDF
        const lotPlates = plateIds.map(id => allPlatesData.find(p => p.id === id));
        
        if (confirm(`✅ ${lotName} generado correctamente.\n\n¿Deseas descargar el documento PDF ahora?`)) {
            downloadPDF(lotPlates, lotName);
        }

        await loadPlates(); 
    } catch (error) { console.error("Error generar lote:", error); alert("Error al generar."); }
}

function handleSearchPlate() {
    const searchTerm = document.getElementById('searchPlate').value.trim().toUpperCase();
    if (searchTerm === "") { renderPlates(allPlatesData); return; }
    const filteredPlates = allPlatesData.filter(placa => (placa.PLACA && placa.PLACA.toUpperCase().includes(searchTerm)) || (placa.PAIS && placa.PAIS.toUpperCase().includes(searchTerm)));
    renderPlates(filteredPlates);
}

function handleSort(column) {
    if (currentSort.column === column) { currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc'; } 
    else { currentSort.column = column; currentSort.direction = 'asc'; }
    updateSortIcons(); renderPlates(allPlatesData);
}

function updateSortIcons() {
    document.querySelectorAll('.sort-icon').forEach(icon => icon.innerHTML = '');
    const currentIcon = document.getElementById(`sortIcon${currentSort.column}`);
    if (currentIcon) currentIcon.innerHTML = currentSort.direction === 'asc' ? '<i class="fas fa-sort-up"></i>' : '<i class="fas fa-sort-down"></i>';
}

async function handleSaveNewPlate() {
    if(!isUserAuthenticated) return alert("No autorizado.");
    const country = document.getElementById('newPlateCountry').value.trim().toUpperCase();
    const plateNumber = document.getElementById('newPlateNumber').value.trim().toUpperCase();
    if (!country || !plateNumber) return alert("Completa ambos campos.");
    const plateExists = allPlatesData.some(placa => placa.PLACA === plateNumber && placa.PAIS === country);
    if (plateExists) return alert("Esta placa ya existe.");
    
    try {
        const newPlateRef = push(ref(database, 'placas_destruccion'));
        await update(newPlateRef, { PAIS: country, PLACA: plateNumber, FECHA_AGREGADA: new Date().toISOString(), LoteDestruccion: "" });
        document.getElementById('newPlateCountry').value = '';
        document.getElementById('newPlateNumber').value = '';
        document.getElementById('newPlateModal').style.display = 'none';
        await loadPlates();
    } catch (error) { console.error("Error guardar placa:", error); alert("Error al guardar."); }
}

function handleExportToExcel() {
    if (currentPlatesInConsultedLot.length === 0) return alert("No hay datos.");
    let csvContent = "PAIS,PLACA\n";
    currentPlatesInConsultedLot.forEach(plate => { csvContent += `"${plate.PAIS || ''}","${plate.PLACA || ''}"\n`; });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${document.getElementById('consultLotTitle').textContent.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function handleExportToPDF() {
    if (currentPlatesInConsultedLot.length === 0) return alert("No hay datos para exportar.");
    const title = document.getElementById('consultLotTitle').textContent;
    downloadPDF(currentPlatesInConsultedLot, title);
}

function downloadPDF(platesArray, documentTitle) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text(`Registro de Destrucción - ${documentTitle}`, 14, 20);
    
    const tableData = platesArray.map((p, index) => [
        index + 1,
        p.PAIS || 'N/A',
        p.PLACA || 'N/A'
    ]);

    doc.autoTable({
        startY: 30,
        head: [['#', 'PAÍS', 'NÚMERO DE PLACA']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [220, 38, 38] }, 
        styles: { fontSize: 11, cellPadding: 4 }
    });
    
    doc.save(`${documentTitle.replace(/\s+/g, '_')}.pdf`);
}
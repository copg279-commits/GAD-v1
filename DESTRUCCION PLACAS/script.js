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
let lotMetadataGlobal = {}; 
let currentPlatesInConsultedLot = [];
let currentConsultedLotName = "";

// Variables para el previsualizador PDF
let currentPdfDoc = null;
let previewLotName = "";
let previewPlatesArray = [];
let previewCols = 3; 

const currentHost = window.location.hostname;
const isLocal = (currentHost === '127.0.0.1' || currentHost === 'localhost');

// --- AUTO LOGIN MEMORIZADO ---
if (isLocal) {
    signInWithEmailAndPassword(auth, "test@gad.com", "123456") 
        .catch(error => console.error("Error Auto-login:", error));
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('auth-loading-screen').style.display = 'none';
        document.getElementById('main-app-content').style.display = 'block';
        initApp();
    } else {
        if (!isLocal) {
            document.getElementById('auth-loading-screen').innerHTML = 
                "<div class='text-center text-red-500'><i class='fas fa-lock fa-3x mb-3'></i><br>ACCESO DENEGADO<br><span class='text-sm text-gray-300'>Inicia sesión en el Menú Principal</span></div>";
        }
    }
});

function initApp() {
    loadPlates();
    
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
    document.getElementById('exportLotToExcelButton').addEventListener('click', handleExportToExcel);

    // Botones Lotes
    document.getElementById('generateLotMainBtn').addEventListener('click', () => {
        const lotName = document.getElementById('lotNumber').value;
        document.getElementById('modalNextLotName').textContent = lotName;
        document.getElementById('countPendingAuto').textContent = allPlatesData.filter(p => !p.LoteDestruccion || p.LoteDestruccion.trim() === "").length;
        document.getElementById('countSelectedManual').textContent = document.querySelectorAll('.plate-checkbox:checked').length;
        toggleModal('generateLotModal', true);
    });
    document.getElementById('closeGenerateLotModal').addEventListener('click', () => toggleModal('generateLotModal', false));
    
    document.getElementById('btnGenAuto').addEventListener('click', () => {
        const pendingIds = allPlatesData.filter(p => !p.LoteDestruccion || p.LoteDestruccion.trim() === "").map(p => p.id);
        if(pendingIds.length === 0) return alert("No hay placas pendientes.");
        executeGenerateLot(pendingIds); toggleModal('generateLotModal', false);
    });

    document.getElementById('btnGenManual').addEventListener('click', () => {
        const selectedIds = Array.from(document.querySelectorAll('.plate-checkbox:checked')).map(cb => cb.dataset.plateId);
        if(selectedIds.length === 0) { alert("⚠️ Selecciona manualmente placas primero."); toggleModal('generateLotModal', false); return; }
        executeGenerateLot(selectedIds); toggleModal('generateLotModal', false);
    });

    document.getElementById('closePdfPreviewModal').addEventListener('click', () => {
        document.getElementById('pdfPreviewFrame').src = ''; 
        toggleModal('pdfPreviewModal', false);
    });

    document.getElementById('btn2Cols').addEventListener('click', () => { previewCols = 2; updatePdfPreviewBtns(); renderPdfPreview(); });
    document.getElementById('btn3Cols').addEventListener('click', () => { previewCols = 3; updatePdfPreviewBtns(); renderPdfPreview(); });

    document.getElementById('downloadPdfBtn').addEventListener('click', () => {
        if(currentPdfDoc) currentPdfDoc.save(`Placas_${previewLotName.replace(/\s+/g, '_')}.pdf`);
        toggleModal('pdfPreviewModal', false);
    });

    window.addEventListener('click', (e) => {
        if (e.target === overlay) {
            toggleModal('newPlateModal', false); toggleModal('anuladasModal', false); 
            toggleModal('consultLotModal', false); toggleModal('generateLotModal', false);
            toggleModal('pdfPreviewModal', false);
        }
    });
}

// --- DATOS Y ORDENACIÓN ---
async function loadPlates() {
    try {
        await loadLotMetadata(); await loadAnuladas(); 
        const snapshot = await get(ref(database, 'placas_destruccion'));
        allPlatesData = []; uniqueLots = {}; 
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
        handleSearchPlate(); loadLotAdministrationPanel(); 
    } catch (error) { console.error(error); }
}

async function loadLotMetadata() {
    const snapshot = await get(ref(database, 'lotes'));
    lotMetadataGlobal = snapshot.exists() ? snapshot.val() : {};
}

async function loadAnuladas() {
    const snapshot = await get(ref(database, 'placas_anuladas'));
    anuladasData = snapshot.exists() ? Object.entries(snapshot.val()).map(([key, value]) => ({ id: key, ...value })) : [];
    document.getElementById('anuladasCount').textContent = anuladasData.length;
}

async function getNextLotNumber() {
    let max = 0;
    allPlatesData.forEach(p => { if (p.LoteDestruccion) { const m = p.LoteDestruccion.match(/LOTE (\d+)/i); if (m) max = Math.max(max, parseInt(m[1])); }});
    document.getElementById('lotNumber').value = `LOTE ${max + 1}`;
}

function handleSearchPlate() {
    const term = document.getElementById('searchPlate').value.trim().toUpperCase();
    let filtered = allPlatesData;
    if (term !== "") filtered = allPlatesData.filter(p => (p.PLACA && p.PLACA.toUpperCase().includes(term)) || (p.PAIS && p.PAIS.toUpperCase().includes(term)));
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
    if (currentIcon) currentIcon.innerHTML = currentSort.direction === 'asc' ? '<i class="fas fa-sort-up ml-1 text-blue-400"></i>' : '<i class="fas fa-sort-down ml-1 text-blue-400"></i>';
}

function renderPlates(platesToRender) {
    const tableBody = document.getElementById('platesTableBody');
    tableBody.innerHTML = '';
    
    platesToRender.sort((a, b) => {
        if (currentSort.column === 'FECHA_AGREGADA') {
            const isADestroyed = !!a.LoteDestruccion && a.LoteDestruccion.trim() !== "";
            const isBDestroyed = !!b.LoteDestruccion && b.LoteDestruccion.trim() !== "";
            if (isADestroyed !== isBDestroyed) return isADestroyed ? 1 : -1; 
            const aVal = a.FECHA_AGREGADA ? new Date(a.FECHA_AGREGADA).getTime() : 0;
            const bVal = b.FECHA_AGREGADA ? new Date(b.FECHA_AGREGADA).getTime() : 0;
            if (aVal < bVal) return currentSort.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return currentSort.direction === 'asc' ? 1 : -1;
            return 0;
        } else {
            const aVal = a[currentSort.column] || '';
            const bVal = b[currentSort.column] || '';
            const cmp = String(aVal).localeCompare(String(bVal), 'es', { sensitivity: 'base' });
            if (cmp !== 0) return currentSort.direction === 'asc' ? cmp : -cmp;
            const fallback = currentSort.column === 'PAIS' ? 'PLACA' : 'PAIS';
            const cmp2 = String(a[fallback]||'').localeCompare(String(b[fallback]||''), 'es', { sensitivity: 'base' });
            return currentSort.direction === 'asc' ? cmp2 : -cmp2;
        }
    });

    platesToRender.forEach((placa, i) => {
        const isAssigned = placa.LoteDestruccion && placa.LoteDestruccion.trim() !== "";
        const lotName = isAssigned ? placa.LoteDestruccion.trim() : "";
        const isLocked = isAssigned && lotMetadataGlobal[lotName]?.estado === 'destruidas';
        const rowClass = isAssigned ? (isLocked ? 'bg-red-900 bg-opacity-10 text-gray-400' : 'bg-emerald-900 bg-opacity-20 text-gray-400') : 'hover:bg-slate-800 transition';
        const row = document.createElement('tr');
        row.className = rowClass;
        row.innerHTML = `
            <td class="p-3 text-center"><input type="checkbox" data-plate-id="${placa.id}" ${isAssigned ? 'disabled hidden' : ''} class="plate-checkbox w-4 h-4 accent-red-500 cursor-pointer"></td>
            <td class="p-3 text-gray-500 font-bold">${platesToRender.length - i}</td>
            <td class="p-3 font-bold" id="pais-${placa.id}">${placa.PAIS || ''}</td>
            <td class="p-3 font-bold text-red-400 text-base" id="placa-${placa.id}">${placa.PLACA || ''}</td>
            <td class="p-3 text-gray-400">${placa.FECHA_AGREGADA ? new Date(placa.FECHA_AGREGADA).toLocaleDateString('es-ES') : ''}</td>
            <td class="p-3 font-bold ${isAssigned ? (isLocked ? 'text-red-500' : 'text-emerald-500') : 'text-gray-500'}">
                ${isAssigned ? (isLocked ? `<i class="fas fa-lock mr-1"></i>${lotName}` : `<i class="fas fa-check-circle mr-1"></i>${lotName}`) : 'PENDIENTE'}</td>
            <td class="p-3 text-center">
                ${!isAssigned ? `<i class="fas fa-edit action-icon text-blue-400 hover:text-blue-300 mr-3" data-plate-id="${placa.id}"></i><i class="fas fa-times-circle action-icon text-red-500 hover:text-red-400" data-plate-id="${placa.id}"></i>` : ''}
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

function updateLotButton() { document.getElementById('selectedCount').textContent = `(${document.querySelectorAll('.plate-checkbox:checked').length})`; }

async function executeGenerateLot(plateIdsArray) {
    const lotName = document.getElementById('lotNumber').value;
    try {
        const updates = {};
        plateIdsArray.forEach(id => updates[`placas_destruccion/${id}/LoteDestruccion`] = lotName);
        updates[`lotes/${lotName}`] = { fechaCreacion: new Date().toLocaleDateString('es-ES'), totalPlacas: plateIdsArray.length, eurocop: "", estado: "pendiente" };
        await update(ref(database), updates);
        document.getElementById('selectAllCheckbox').checked = false;
        await loadPlates(); alert(`✅ ${lotName} generado correctamente.`);
    } catch (error) { console.error(error); alert("Error al generar."); }
}

function loadLotAdministrationPanel() {
    const tbody = document.getElementById('lotAdminBody'); tbody.innerHTML = '';
    const sortedLots = Object.keys(uniqueLots).sort((a, b) => parseInt((b.match(/\d+/) || [0])[0]) - parseInt((a.match(/\d+/) || [0])[0]));
    if (sortedLots.length === 0) return tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-gray-500">Aún no se ha generado ningún lote.</td></tr>'; 

    sortedLots.forEach(lotName => {
        const row = document.createElement('tr'); row.className = 'hover:bg-slate-800 transition';
        const metadata = lotMetadataGlobal[lotName] || {};
        const isLocked = metadata.estado === 'destruidas';
        const dateMatch = lotName.match(/\((.*?)\)/);
        
        row.innerHTML = `
            <td class="p-3 font-bold ${isLocked ? 'text-red-400' : 'text-gray-300'}">${lotName.replace(/\s*\([^)]*\)/, '')}</td>
            <td class="p-3"><input type="text" value="${metadata.eurocop || ''}" data-lot="${lotName}" placeholder="Nº Eurocop" class="border border-gadBorder px-2 py-1.5 rounded w-28 outline-none focus:border-blue-500 ${isLocked ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gadBg text-white'}" ${isLocked ? 'disabled' : ''}></td>
            <td class="p-3 font-bold">${uniqueLots[lotName].length}</td>
            <td class="p-3 text-gray-400">${dateMatch ? dateMatch[1] : 'N/A'}</td>
            <td class="p-3">
                <div class="flex flex-wrap gap-2 items-center">
                    ${isLocked ? `
                        <span class="bg-red-900/40 text-red-400 border border-red-800 px-3 py-1.5 rounded text-xs font-bold mr-2"><i class="fas fa-lock mr-1"></i> DESTRUIDAS</span>
                        <button class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-bold shadow-md" onclick="window.consultLot('${lotName}')"><i class="fas fa-search"></i></button>
                        <button class="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded text-xs font-bold shadow-md" onclick="window.preparePDFPreview('${lotName}')"><i class="fas fa-file-pdf"></i></button>
                        <button class="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1.5 rounded text-xs font-bold shadow-md" onclick="window.unlockLot('${lotName}')"><i class="fas fa-lock-open"></i> Abrir</button>
                    ` : `
                        <button class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-xs font-bold shadow-md" onclick="window.consultLot('${lotName}')"><i class="fas fa-search"></i> Consultar</button>
                        <button class="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded text-xs font-bold shadow-md" onclick="window.preparePDFPreview('${lotName}')"><i class="fas fa-file-pdf"></i> PDF</button>
                        <button class="bg-orange-600 hover:bg-orange-500 text-white px-3 py-1.5 rounded text-xs font-bold shadow-md" onclick="window.undoLot('${lotName}')"><i class="fas fa-undo"></i> Deshacer</button>
                        <button class="bg-red-700 hover:bg-red-600 text-white px-3 py-1.5 rounded text-xs font-bold shadow-md" onclick="window.destroyLot('${lotName}')"><i class="fas fa-lock"></i> Destruir</button>
                    `}
                </div>
            </td>
        `;
        tbody.appendChild(row);
        if(!isLocked) { row.querySelector('input').addEventListener('change', async (e) => { await update(ref(database, `lotes/${lotName}`), { eurocop: e.target.value }); e.target.style.borderColor = '#10b981'; setTimeout(() => e.target.style.borderColor = '', 1000); }); }
    });
}

window.destroyLot = async (lotName) => { if(confirm(`⚠️ Activar candado del ${lotName}?`)) { await update(ref(database, `lotes/${lotName}`), { estado: 'destruidas' }); await loadPlates(); }};
window.unlockLot = async (lotName) => { if(confirm(`🔓 Quitar candado del ${lotName}?`)) { await update(ref(database, `lotes/${lotName}`), { estado: 'pendiente' }); await loadPlates(); }};

window.consultLot = (lotName) => {
    currentConsultedLotName = lotName; 
    document.getElementById('consultLotTitle').textContent = `Placas del ${lotName}`;
    const list = document.getElementById('consultLotList'); list.innerHTML = '';
    currentPlatesInConsultedLot = uniqueLots[lotName].map(id => allPlatesData.find(p => p.id === id)).filter(Boolean);
    currentPlatesInConsultedLot.forEach((p, idx) => { list.innerHTML += `<li class="p-2 border-b border-gadBorder last:border-0 flex justify-between"><span class="text-gray-400">${idx+1}. ${p.PAIS}</span> <span class="text-red-400 font-bold">${p.PLACA}</span></li>`; });
    document.getElementById('modal-overlay').style.display = 'block'; document.getElementById('consultLotModal').style.display = 'flex';
};

window.undoLot = async (lotName) => {
    if (lotMetadataGlobal[lotName]?.estado === 'destruidas') return alert("Lote blindado.");
    if (confirm(`¿Deshacer ${lotName}?`)) {
        const updates = {}; uniqueLots[lotName].forEach(id => updates[`placas_destruccion/${id}/LoteDestruccion`] = "");
        await remove(ref(database, `lotes/${lotName}`)); await update(ref(database), updates); loadPlates();
    }
};

// --- MOTOR PDF ---
async function getBase64ImageFromUrl(imageUrl) {
    return new Promise((resolve) => {
        const img = new Image(); img.crossOrigin = 'Anonymous';
        img.onload = () => { const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height; canvas.getContext('2d').drawImage(img, 0, 0); resolve(canvas.toDataURL('image/png')); };
        img.onerror = () => resolve(null); img.src = imageUrl;
    });
}

function updatePdfPreviewBtns() {
    document.getElementById('btn2Cols').className = previewCols === 2 ? "bg-blue-600 text-white px-6 py-2 rounded-lg font-bold transition ring-2 ring-blue-300" : "bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-bold transition";
    document.getElementById('btn3Cols').className = previewCols === 3 ? "bg-blue-600 text-white px-6 py-2 rounded-lg font-bold transition ring-2 ring-blue-300" : "bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-bold transition";
}

window.preparePDFPreview = async (lotName) => {
    previewLotName = lotName;
    previewPlatesArray = uniqueLots[lotName].map(id => allPlatesData.find(p => p.id === id)).filter(Boolean);
    previewPlatesArray.sort((a, b) => {
        const cmp = (a.PAIS||'').localeCompare((b.PAIS||''), 'es', { sensitivity: 'base' });
        if (cmp !== 0) return cmp;
        return (a.PLACA||'').localeCompare((b.PLACA||''), 'es', { sensitivity: 'base' });
    });
    previewCols = 3; 
    updatePdfPreviewBtns();
    document.getElementById('modal-overlay').style.display = 'block';
    document.getElementById('pdfPreviewModal').style.display = 'flex';
    await renderPdfPreview();
};

async function renderPdfPreview() {
    document.getElementById('pdfLoadingSpinner').style.display = 'block';
    currentPdfDoc = await buildPDFDocument(previewLotName, previewPlatesArray, previewCols);
    const pdfBlob = currentPdfDoc.output('blob');
    document.getElementById('pdfPreviewFrame').src = URL.createObjectURL(pdfBlob) + "#view=Fit";
    document.getElementById('pdfLoadingSpinner').style.display = 'none';
}

async function buildPDFDocument(lotName, platesArray, columns) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // RUTAS CORREGIDAS PARA SALIR DE CARPETA (../ASSETS/)
    const logoIzquierda = await getBase64ImageFromUrl('../ASSETS/judicial.png'); 
    const logoDerecha = await getBase64ImageFromUrl('../ASSETS/logogad.png');

    if(logoIzquierda) doc.addImage(logoIzquierda, 'PNG', 14, 10, 25, 25);
    if(logoDerecha) doc.addImage(logoDerecha, 'PNG', 171, 10, 25, 25);

    doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text("EXCMO. AYUNTAMIENTO DE ALICANTE", 105, 12, { align: "center" });
    doc.text("POLICÍA LOCAL", 105, 17, { align: "center" });
    doc.setFontSize(9);
    doc.text("Grupo de Análisis Documental", 105, 22, { align: "center" });
    doc.text("Unidad Judicial de Tráfico", 105, 26, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.text("Av. Julián Besteiro 15", 105, 30, { align: "center" });
    doc.setTextColor(30, 64, 175); doc.text("Email: policia.gad@alicante.es", 105, 34, { align: "center" });
    doc.setTextColor(0, 0, 0); doc.text("TEL: +34629111387 - Central PL 965107200", 105, 38, { align: "center" });
    doc.line(14, 42, 196, 42);

    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text(`Registro GAD - Placas del ${lotName}`, 14, 49);
    doc.setFontSize(9); doc.setFont("helvetica", "italic");
    doc.text(`Generado el: ${new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, 14, 54);

    const bodyData = [];
    for (let i = 0; i < platesArray.length; i += columns) {
        const row = [];
        for (let j = 0; j < columns; j++) {
            if (i + j < platesArray.length) {
                row.push(i + j + 1, platesArray[i + j].PAIS || '', platesArray[i + j].PLACA || '');
            } else row.push('', '', ''); 
        }
        bodyData.push(row);
    }

    let headRow = columns === 3 ? ['#', 'PAÍS', 'PLACA', '#', 'PAÍS', 'PLACA', '#', 'PAÍS', 'PLACA'] : ['#', 'PAÍS', 'PLACA', '#', 'PAÍS', 'PLACA'];
    
    doc.autoTable({
        startY: 58,
        head: [headRow], body: bodyData, theme: 'grid',
        headStyles: { fillColor: [220, 38, 38], fontSize: 8, halign: 'center' }, 
        styles: { fontSize: 8, cellPadding: 1.5 }, margin: { left: 14, right: 14, bottom: 20 }
    });
    
    let finalY = doc.lastAutoTable.finalY || 58;
    if (finalY > 240) { doc.addPage(); finalY = 20; } else { finalY += 15; }
    doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text("Firma del receptor y Sello:", 14, finalY);
    doc.setDrawColor(0, 0, 0); doc.rect(14, finalY + 3, 100, 35); 

    return doc;
}

// RESTO DE FUNCIONES (Edición, Anulación, Excel...)
function handleExportToExcel() {
    if (currentPlatesInConsultedLot.length === 0) return alert("No hay datos.");
    let csv = "PAIS,PLACA\n"; currentPlatesInConsultedLot.forEach(p => csv += `"${p.PAIS || ''}","${p.PLACA || ''}"\n`);
    const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    link.download = `Placas_${currentConsultedLotName.replace(/\s+/g, '_')}.csv`; link.click();
}

function handleEditPlate(id) {
    const paisTd = document.getElementById(`pais-${id}`); const placaTd = document.getElementById(`placa-${id}`);
    const oldPais = paisTd.textContent, oldPlaca = placaTd.textContent;
    paisTd.innerHTML = `<input type="text" value="${oldPais}" class="inline-edit-input" id="edit-pais-${id}">`;
    placaTd.innerHTML = `<input type="text" value="${oldPlaca}" class="inline-edit-input" id="edit-placa-${id}">`;
    document.getElementById(`edit-pais-${id}`).focus();
    const save = async () => {
        const nPais = document.getElementById(`edit-pais-${id}`).value.trim().toUpperCase(), nPlaca = document.getElementById(`edit-placa-${id}`).value.trim().toUpperCase();
        if (nPais && nPlaca && (nPais !== oldPais || nPlaca !== oldPlaca)) {
            await update(ref(database, `placas_destruccion/${id}`), { PAIS: nPais, PLACA: nPlaca });
            paisTd.textContent = nPais; placaTd.textContent = nPlaca;
            const idx = allPlatesData.findIndex(p => p.id === id); if(idx > -1) { allPlatesData[idx].PAIS = nPais; allPlatesData[idx].PLACA = nPlaca; }
        } else { paisTd.textContent = oldPais; placaTd.textContent = oldPlaca; }
    };
    document.getElementById(`edit-pais-${id}`).addEventListener('blur', save); document.getElementById(`edit-placa-${id}`).addEventListener('blur', save);
    document.getElementById(`edit-placa-${id}`).addEventListener('keypress', (e) => { if(e.key === 'Enter') save(); });
}

async function handleAnularPlate(placa) { if (confirm(`¿Mover la placa ${placa.PLACA} a Devolución?`)) { await update(ref(database, `placas_anuladas/${placa.id}`), { PAIS: placa.PAIS, PLACA: placa.PLACA, FECHA_ANULACION: new Date().toISOString() }); await remove(ref(database, `placas_destruccion/${placa.id}`)); loadPlates(); } }

async function handleSaveNewPlate() {
    const pais = document.getElementById('newPlateCountry').value.trim().toUpperCase(), placa = document.getElementById('newPlateNumber').value.trim().toUpperCase();
    if (!pais || !placa) return alert("Completa campos.");
    await push(ref(database, 'placas_destruccion'), { PAIS: pais, PLACA: placa, FECHA_AGREGADA: new Date().toISOString(), LoteDestruccion: "" });
    document.getElementById('newPlateCountry').value = ''; document.getElementById('newPlateNumber').value = '';
    document.getElementById('modal-overlay').style.display = 'none'; document.getElementById('newPlateModal').style.display = 'none'; loadPlates();
}

function renderAnuladasModal() {
    const tbody = document.getElementById('anuladasListBody'); tbody.innerHTML = '';
    anuladasData.forEach(p => {
        tbody.innerHTML += `<tr class="hover:bg-slate-800 transition"><td class="p-3">${p.PAIS}</td><td class="p-3 text-red-400 font-bold">${p.PLACA}</td><td class="p-3 text-gray-400">${new Date(p.FECHA_ANULACION).toLocaleDateString()}</td><td class="p-3 text-center"><button class="text-emerald-500 hover:text-emerald-400 mr-3" onclick="window.restorePlate('${p.id}')"><i class="fas fa-trash-restore"></i></button><button class="text-red-500 hover:text-red-400" onclick="window.deleteAnulada('${p.id}')"><i class="fas fa-times"></i></button></td></tr>`;
    });
}
window.restorePlate = async (id) => { const p = anuladasData.find(x => x.id === id); if(confirm(`¿Restaurar ${p.PLACA}?`)) { await update(ref(database, `placas_destruccion/${id}`), { PAIS: p.PAIS, PLACA: p.PLACA, FECHA_AGREGADA: new Date().toISOString(), LoteDestruccion: "" }); await remove(ref(database, `placas_anuladas/${id}`)); loadPlates(); document.getElementById('closeAnuladasModal').click(); }};
window.deleteAnulada = async (id) => { if(confirm("¿Eliminar PERMANENTEMENTE?")) { await remove(ref(database, `placas_anuladas/${id}`)); loadAnuladas(); renderAnuladasModal(); }};
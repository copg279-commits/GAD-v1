window.addEventListener('load', function () {
    const video = document.getElementById('video');
    const videoWrapper = document.getElementById('videoWrapper');
    const startCameraBtn = document.getElementById('startCamera');
    const stopCameraBtn = document.getElementById('stopCamera');
    const fileInput = document.getElementById('fileInput');
    const resultBox = document.getElementById('resultBox');
    const rawOutput = document.getElementById('rawOutput');
    const decodedOutput = document.getElementById('decodedOutput');
    const statusMsg = document.getElementById('status');
    const copyBtn = document.getElementById('copyBtn');

    const cameraControls = document.getElementById('cameraControls');
    const zoomSlider = document.getElementById('zoomSlider');
    const guideWidthSlider = document.getElementById('guideWidth');
    const guideHeightSlider = document.getElementById('guideHeight');
    const scannerGuide = document.getElementById('scannerGuide');
    const manualCaptureBtn = document.getElementById('manualCaptureBtn');
    
    const cropperContainer = document.getElementById('cropperContainer');
    const imageToCrop = document.getElementById('imageToCrop');
    const cropAndReadBtn = document.getElementById('cropAndReadBtn');
    
    const nativeAppBtn = document.getElementById('nativeAppBtn');
    const appSelector = document.getElementById('appSelector');
    const clearBtn = document.getElementById('clearBtn');

    let cropper = null;
    let currentZoom = 1;
    let autoReadTimeout = null;

    // ==========================================
    // 1. SISTEMA DE LIMPIEZA
    // ==========================================
    clearBtn.addEventListener('click', () => {
        stopCamera();
        resultBox.style.display = 'none';
        cropperContainer.style.display = 'none';
        cameraControls.style.display = 'none';
        if (cropper) { cropper.destroy(); cropper = null; }
        fileInput.value = '';
        rawOutput.textContent = '-';
        decodedOutput.textContent = '-';
        window.history.replaceState({}, document.title, window.location.pathname);
        statusMsg.textContent = "Búsqueda limpiada. Esperando acción...";
    });

    // ==========================================
    // 2. RECEPCIÓN DE DATOS Y ENLACE DINÁMICO DE APP
    // ==========================================
    const urlParams = new URLSearchParams(window.location.search);
    const codigoDesdeApp = urlParams.get('codigo_escaneado');

    if (codigoDesdeApp) {
        window.history.replaceState({}, document.title, window.location.pathname);
        statusMsg.textContent = "¡Código recibido desde la App externa!";
        setTimeout(() => processSuccess(codigoDesdeApp), 500); 
    }

    // Cargar la app favorita guardada en memoria
    const savedApp = localStorage.getItem('preferredScannerApp');
    if (savedApp !== null) {
        appSelector.value = savedApp;
    }

    // Función que actualiza el botón azul según lo que elijas
    function updateIntentUrl() {
        if (!nativeAppBtn) return;
        const currentUrl = window.location.href.split('?')[0]; 
        const returnUrl = encodeURIComponent(currentUrl + '?codigo_escaneado={CODE}');
        const pkg = appSelector.value;
        const pkgString = pkg ? `package=${pkg};` : '';
        const fallbackUrl = pkg ? encodeURIComponent(`https://play.google.com/store/apps/details?id=${pkg}`) : encodeURIComponent('https://play.google.com/store/search?q=scanner&c=apps');
        
        const intentUrl = `intent://scan/#Intent;action=com.google.zxing.client.android.SCAN;${pkgString}S.SCAN_FORMATS=PDF_417;S.RET_URL=${returnUrl};S.browser_fallback_url=${fallbackUrl};end`;
        
        if (nativeAppBtn.tagName.toLowerCase() === 'a') {
            nativeAppBtn.href = intentUrl;
        }
    }

    // Actualizar enlace al inicio y cada vez que el usuario cambie el desplegable
    updateIntentUrl();
    appSelector.addEventListener('change', (e) => {
        localStorage.setItem('preferredScannerApp', e.target.value);
        updateIntentUrl();
        statusMsg.textContent = "Preferencias de app guardadas.";
    });

    // ==========================================
    // 3. NÚCLEO LECTOR Y SIMULACIÓN DE TARJETA
    // ==========================================
    const hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.PDF_417]);
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
    const codeReader = new ZXing.BrowserMultiFormatReader(hints);

    function playBeep() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            gain.gain.setValueAtTime(0.5, ctx.currentTime);
            osc.start();
            osc.stop(ctx.currentTime + 0.15);
        } catch (e) {}
    }

    function decodeBase64ToText(base64Str) {
        try {
            const clean = base64Str.replace(/\s/g, '');
            const bin = atob(clean);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            return new TextDecoder('utf-8').decode(bytes);
        } catch (e) {
            return "Error al decodificar Base64.";
        }
    }

    function formatDate(dateStr) {
        if (!dateStr || dateStr.length !== 8) return dateStr;
        return `${dateStr.substring(6, 8)}.${dateStr.substring(4, 6)}.${dateStr.substring(0, 4)}`;
    }

    function populateVirtualCard(decodedText) {
        const parts = decodedText.split('|');
        document.getElementById('field5').textContent = parts[0] || '';
        document.getElementById('field4a').textContent = formatDate(parts[1]);
        document.getElementById('field4b').textContent = formatDate(parts[2]);
        document.getElementById('field1').textContent = parts[3] ? parts[3].trim().replace(/\s+/g, ' ') : '';
        const fName = parts[4] ? parts[4].trim().replace(/\s+/g, ' ') : '';
        const pat = parts[5] ? parts[5].trim().replace(/\s+/g, ' ') : '';
        document.getElementById('field2').textContent = `${fName} ${pat}`.trim();
        document.getElementById('field3').textContent = formatDate(parts[6]);
        document.getElementById('field9').textContent = parts[7] || '';
        document.getElementById('field4c').textContent = parts[8] || '';
        document.getElementById('field8').textContent = ''; 
    }

    function processSuccess(rawText) {
        playBeep();
        rawOutput.textContent = rawText;
        const decodedText = decodeBase64ToText(rawText);
        decodedOutput.textContent = decodedText;
        populateVirtualCard(decodedText);
        
        resultBox.style.display = 'block';
        cropperContainer.style.display = 'none';
        if (cropper) { cropper.destroy(); cropper = null; } // Limpiamos el cropper al tener éxito
        statusMsg.textContent = "¡Código detectado con éxito!";
        stopCamera();
        resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function handleResult(result) {
        if (result && result.text) processSuccess(result.text);
    }

    // ==========================================
    // 4. LECTURA AUTOMÁTICA EN RECORTADOR
    // ==========================================
    function attemptAutoReadFromCropper() {
        if (!cropper) return;
        statusMsg.textContent = "Analizando encuadre automáticamente...";
        const sourceCanvas = cropper.getCroppedCanvas();
        
        const scale = 2; 
        const margin = 100; 
        const paddedCanvas = document.createElement('canvas');
        paddedCanvas.width = (sourceCanvas.width * scale) + (margin * 2);
        paddedCanvas.height = (sourceCanvas.height * scale) + (margin * 2);
        const ctx = paddedCanvas.getContext('2d');
        
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, paddedCanvas.width, paddedCanvas.height);
        ctx.drawImage(sourceCanvas, 0, 0, sourceCanvas.width, sourceCanvas.height, margin, margin, sourceCanvas.width * scale, sourceCanvas.height * scale);

        const img = new Image();
        img.onload = () => {
            codeReader.decodeFromImageElement(img)
                .then(handleResult)
                .catch(() => {
                    // Intento rotado en segundo plano
                    const rotCanv = document.createElement('canvas');
                    rotCanv.width = paddedCanvas.height; rotCanv.height = paddedCanvas.width;
                    const cR = rotCanv.getContext('2d');
                    cR.fillStyle = '#FFFFFF'; cR.fillRect(0, 0, rotCanv.width, rotCanv.height);
                    cR.translate(rotCanv.width/2, rotCanv.height/2); cR.rotate(90 * Math.PI/180);
                    cR.drawImage(paddedCanvas, -paddedCanvas.width/2, -paddedCanvas.height/2);

                    const rImg = new Image();
                    rImg.onload = () => {
                        codeReader.decodeFromImageElement(rImg)
                            .then(handleResult)
                            .catch(() => statusMsg.textContent = "Mueve o ajusta el marco para enfocar el código negro...");
                    };
                    rImg.src = rotCanv.toDataURL("image/jpeg", 1.0);
                });
        };
        img.src = paddedCanvas.toDataURL("image/jpeg", 1.0);
    }

    function scheduleAutoRead() {
        clearTimeout(autoReadTimeout);
        // Esperamos 400ms después de que el usuario deje de mover el dedo para no colapsar el móvil
        autoReadTimeout = setTimeout(attemptAutoReadFromCropper, 400); 
    }

    // Botón manual (por si falla el auto-read)
    cropAndReadBtn.addEventListener('click', attemptAutoReadFromCropper);

    fileInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files.length) {
            stopCamera();
            resultBox.style.display = 'none';
            cameraControls.style.display = 'none';
            cropperContainer.style.display = 'none'; 
            statusMsg.textContent = "Buscando código en toda la imagen...";

            const file = e.target.files[0];
            const reader = new FileReader();
            
            reader.onload = (event) => {
                const img = new Image();
                img.onload = async () => {
                    let detected = false;

                    // Intento 1: IA Nativa
                    if ('BarcodeDetector' in window) {
                        try {
                            const detector = new BarcodeDetector({ formats: ['pdf417'] });
                            const barcodes = await detector.detect(img);
                            if (barcodes.length > 0) {
                                processSuccess(barcodes[0].rawValue);
                                detected = true;
                                return;
                            }
                        } catch (err) {}
                    }

                    // Intento 2: ZXing Genérico
                    if (!detected) {
                        try {
                            const result = await codeReader.decodeFromImageElement(img);
                            processSuccess(result.text);
                            detected = true;
                        } catch (err) {}
                    }

                    // Intento 3: Recorte Auto-Mágico
                    if (!detected) {
                        statusMsg.textContent = "Ajusta el recuadro. Se leerá automáticamente.";
                        imageToCrop.src = event.target.result;
                        cropperContainer.style.display = 'block';

                        if (cropper) cropper.destroy();
                        cropper = new Cropper(imageToCrop, {
                            viewMode: 1, dragMode: 'move', autoCropArea: 0.8,
                            restore: false, guides: true, zoomable: true, movable: true, background: true,
                            ready: scheduleAutoRead, // Dispara al abrirse
                            cropend: scheduleAutoRead, // Dispara al soltar el dedo tras mover
                            zoom: scheduleAutoRead     // Dispara al hacer zoom
                        });
                    }
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    // ==========================================
    // 5. CÁMARA INTERNA DE LA WEB
    // ==========================================
    zoomSlider.addEventListener('input', (e) => {
        currentZoom = parseFloat(e.target.value);
        video.style.transform = `scale(${currentZoom})`;
    });
    guideWidthSlider.addEventListener('input', (e) => { scannerGuide.style.width = `${e.target.value}%`; });
    guideHeightSlider.addEventListener('input', (e) => { scannerGuide.style.height = `${e.target.value}%`; });

    manualCaptureBtn.addEventListener('click', () => {
        statusMsg.textContent = "Analizando captura...";
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const img = new Image();
        img.onload = () => {
            codeReader.decodeFromImageElement(img)
                .then(handleResult)
                .catch(() => statusMsg.textContent = "No detectado. Ajusta el código en el recuadro.");
        };
        img.src = canvas.toDataURL();
    });

    startCameraBtn.addEventListener('click', () => {
        resultBox.style.display = 'none';
        cropperContainer.style.display = 'none';
        videoWrapper.style.display = 'block';
        cameraControls.style.display = 'flex';
        startCameraBtn.style.display = 'none';
        stopCameraBtn.style.display = 'block';
        statusMsg.textContent = "Ajusta el marco y escanea o pulsa Capturar.";

        currentZoom = 1; zoomSlider.value = 1; video.style.transform = `scale(1)`;
        scannerGuide.style.width = '80%'; scannerGuide.style.height = '30%';
        guideWidthSlider.value = 80; guideHeightSlider.value = 30;

        const constraints = { video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 }, advanced: [{ focusMode: "continuous" }] } };
        codeReader.decodeFromConstraints(constraints, 'video', (result, err) => {
            if (result) handleResult(result);
        }).catch(() => statusMsg.textContent = "Error iniciando la cámara.");
    });

    function stopCamera() {
        codeReader.reset();
        videoWrapper.style.display = 'none';
        cameraControls.style.display = 'none';
        startCameraBtn.style.display = 'block';
        stopCameraBtn.style.display = 'none';
        if(statusMsg.textContent.includes("Ajusta el marco")) statusMsg.textContent = "Cámara detenida.";
    }

    stopCameraBtn.addEventListener('click', stopCamera);

    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(decodedOutput.textContent).then(() => {
            const orig = copyBtn.textContent;
            copyBtn.textContent = "¡Copiado!";
            setTimeout(() => copyBtn.textContent = orig, 2000);
        });
    });
});
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
    
    // El nuevo botón de la App
    const nativeAppBtn = document.getElementById('nativeAppBtn');

    let cropper = null;
    let currentZoom = 1;

    // ==========================================
    // 1. RECEPCIÓN DE DATOS DE LA APP EXTERNA
    // ==========================================
    const urlParams = new URLSearchParams(window.location.search);
    const codigoDesdeApp = urlParams.get('codigo_escaneado');

    if (codigoDesdeApp) {
        // Limpiamos la URL para no procesarlo dos veces y mostramos el resultado
        window.history.replaceState({}, document.title, window.location.pathname);
        statusMsg.textContent = "¡Código recibido desde la App externa!";
        // Llamamos a la función que procesa y pinta la tarjeta
        setTimeout(() => processSuccess(codigoDesdeApp), 500); 
    }

// ==========================================
    // 2. BOTÓN PARA ABRIR LA APP EXTERNA (PDF417)
    // ==========================================
    if (nativeAppBtn) {
        nativeAppBtn.addEventListener('click', () => {
            const currentUrl = window.location.href.split('?')[0]; 
            const returnUrl = encodeURIComponent(currentUrl + '?codigo_escaneado={CODE}');
            
            // Enlace a la Play Store por si el usuario no tiene la app instalada
            const fallbackUrl = encodeURIComponent('https://play.google.com/store/apps/details?id=com.google.zxing.client.android');
            
            // Intent de Android CON red de seguridad (browser_fallback_url)
            const intentUrl = `intent://scan/#Intent;scheme=zxing;package=com.google.zxing.client.android;S.SCAN_FORMATS=PDF_417;S.RET_URL=${returnUrl};S.browser_fallback_url=${fallbackUrl};end`;
            
            window.location.href = intentUrl;
        });
    }

    // Configuración de la librería interna
    const hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.PDF_417]);
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
    const codeReader = new ZXing.BrowserMultiFormatReader(hints);

    function playBeep() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const ctx = new AudioContext();
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
            const cleanBase64 = base64Str.replace(/\s/g, '');
            const binaryString = atob(cleanBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return new TextDecoder('utf-8').decode(bytes);
        } catch (e) {
            return "Error: El texto leído no parece ser un Base64 válido.";
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
        
        const surnames = parts[3] ? parts[3].trim().replace(/\s+/g, ' ') : '';
        const firstName = parts[4] ? parts[4].trim().replace(/\s+/g, ' ') : '';
        const patronymic = parts[5] ? parts[5].trim().replace(/\s+/g, ' ') : '';
        
        document.getElementById('field1').textContent = surnames;
        document.getElementById('field2').textContent = `${firstName} ${patronymic}`.trim();
        document.getElementById('field3').textContent = formatDate(parts[6]);
        document.getElementById('field9').textContent = parts[7] || '';
        document.getElementById('field4c').textContent = parts[8] || '';
        document.getElementById('field8').textContent = ''; 
    }

    // Función principal que pinta los resultados en pantalla
    function processSuccess(rawText) {
        playBeep();
        rawOutput.textContent = rawText;
        const decodedText = decodeBase64ToText(rawText);
        decodedOutput.textContent = decodedText;
        populateVirtualCard(decodedText);
        
        resultBox.style.display = 'block';
        cropperContainer.style.display = 'none';
        statusMsg.textContent = "¡Código detectado con éxito!";
        stopCamera();
        resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function handleResult(result) {
        if (result && result.text) {
            processSuccess(result.text);
        }
    }

    // ==========================================
    // CÁMARA INTERNA DE LA WEB
    // ==========================================
    zoomSlider.addEventListener('input', (e) => {
        currentZoom = parseFloat(e.target.value);
        video.style.transform = `scale(${currentZoom})`;
    });
    guideWidthSlider.addEventListener('input', (e) => { scannerGuide.style.width = `${e.target.value}%`; });
    guideHeightSlider.addEventListener('input', (e) => { scannerGuide.style.height = `${e.target.value}%`; });

    manualCaptureBtn.addEventListener('click', () => {
        statusMsg.textContent = "Analizando captura manual...";
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
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

        currentZoom = 1;
        zoomSlider.value = 1;
        video.style.transform = `scale(1)`;
        scannerGuide.style.width = '80%';
        scannerGuide.style.height = '30%';
        guideWidthSlider.value = 80;
        guideHeightSlider.value = 30;

        const constraints = {
            video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 }, advanced: [{ focusMode: "continuous" }] }
        };

        codeReader.decodeFromConstraints(constraints, 'video', (result, err) => {
            if (result) handleResult(result);
        }).catch((err) => {
            statusMsg.textContent = "Error iniciando la cámara en alta resolución.";
        });
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

    // ==========================================
    // SUBIDA DE FOTOS (IA NATIVA Y RECORTADOR HD)
    // ==========================================
    fileInput.addEventListener('change', async (e) => {
        if (e.target.files && e.target.files.length) {
            stopCamera();
            resultBox.style.display = 'none';
            cameraControls.style.display = 'none';
            cropperContainer.style.display = 'none'; 
            statusMsg.textContent = "Buscando código automáticamente en la imagen...";

            const file = e.target.files[0];
            const reader = new FileReader();
            
            reader.onload = (event) => {
                const img = new Image();
                img.onload = async () => {
                    let detected = false;

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

                    if (!detected) {
                        try {
                            const result = await codeReader.decodeFromImageElement(img);
                            processSuccess(result.text);
                            detected = true;
                        } catch (err) {}
                    }

                    if (!detected) {
                        statusMsg.textContent = "Por favor, recorta el código a mano dejando un borde ajustado.";
                        imageToCrop.src = event.target.result;
                        cropperContainer.style.display = 'block';

                        if (cropper) cropper.destroy();
                        cropper = new Cropper(imageToCrop, {
                            viewMode: 1, dragMode: 'move', autoCropArea: 0.8,
                            restore: false, guides: true, zoomable: true, movable: true, background: true
                        });
                    }
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    cropAndReadBtn.addEventListener('click', () => {
        if (cropper) {
            statusMsg.textContent = "Analizando recorte HD...";
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
                        const rotatedCanvas = document.createElement('canvas');
                        rotatedCanvas.width = paddedCanvas.height;
                        rotatedCanvas.height = paddedCanvas.width;
                        const ctxRot = rotatedCanvas.getContext('2d');
                        ctxRot.fillStyle = '#FFFFFF';
                        ctxRot.fillRect(0, 0, rotatedCanvas.width, rotatedCanvas.height);
                        ctxRot.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
                        ctxRot.rotate(90 * Math.PI / 180);
                        ctxRot.drawImage(paddedCanvas, -paddedCanvas.width / 2, -paddedCanvas.height / 2);

                        const rotatedImg = new Image();
                        rotatedImg.onload = () => {
                            codeReader.decodeFromImageElement(rotatedImg)
                                .then(handleResult)
                                .catch(() => {
                                    statusMsg.textContent = "No detectado. Intenta que la foto sea más nítida.";
                                });
                        };
                        rotatedImg.src = rotatedCanvas.toDataURL("image/jpeg", 1.0);
                    });
            };
            img.src = paddedCanvas.toDataURL("image/jpeg", 1.0);
        }
    });

    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(decodedOutput.textContent).then(() => {
            const orig = copyBtn.textContent;
            copyBtn.textContent = "¡Copiado!";
            setTimeout(() => copyBtn.textContent = orig, 2000);
        });
    });
});
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

    let cropper = null;
    let currentZoom = 1;

    // Configuración para forzar la máxima sensibilidad
    const hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.PDF_417]);
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
    const codeReader = new ZXing.BrowserMultiFormatReader(hints);

    // FUNCIÓN DEL SONIDO (BEEP)
    function playBeep() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine'; // Tono suave
            osc.frequency.setValueAtTime(880, ctx.currentTime); // Frecuencia del Beep
            gain.gain.setValueAtTime(0.5, ctx.currentTime); // Volumen
            osc.start();
            osc.stop(ctx.currentTime + 0.15); // Duración corta
        } catch (e) {
            console.warn("El navegador no soporta el sonido automático.");
        }
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

    // Se ejecuta cuando el código se lee correctamente
    function handleResult(result) {
        if (result) {
            playBeep(); // Suena el escáner
            
            const rawText = result.text;
            rawOutput.textContent = rawText;
            const decodedText = decodeBase64ToText(rawText);
            decodedOutput.textContent = decodedText;
            populateVirtualCard(decodedText);
            
            resultBox.style.display = 'block';
            cropperContainer.style.display = 'none';
            statusMsg.textContent = "¡Código decodificado con éxito!";
            stopCamera();
            
            resultBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

function decodeCanvasWithRotationFallback(sourceCanvas) {
        const margin = 50; 
        const paddedCanvas = document.createElement('canvas');
        paddedCanvas.width = sourceCanvas.width + (margin * 2);
        paddedCanvas.height = sourceCanvas.height + (margin * 2);
        const ctx = paddedCanvas.getContext('2d');
        
        // 1. Fondo súper blanco
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, paddedCanvas.width, paddedCanvas.height);
        ctx.drawImage(sourceCanvas, margin, margin);

        // 2. FILTRO EXTREMO DE BLANCO Y NEGRO (Binarización)
        // Esto elimina sombras y reflejos del plástico que ciegan al lector
        const imageData = ctx.getImageData(0, 0, paddedCanvas.width, paddedCanvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            // Fórmula de luminancia para escala de grises
            const gray = (r * 0.299) + (g * 0.587) + (b * 0.114);
            // Si el píxel es oscurito, lo forzamos a negro puro. Si es claro, a blanco puro.
            const color = gray < 130 ? 0 : 255; 
            data[i] = color;     // R
            data[i+1] = color;   // G
            data[i+2] = color;   // B
        }
        ctx.putImageData(imageData, 0, 0);

        // 3. Ahora sí, intentamos leer la imagen purificada
        const img = new Image();
        img.onload = () => {
            codeReader.decodeFromImageElement(img)
                .then(handleResult)
                .catch(() => {
                    // Si falla, rotamos la imagen purificada 90 grados
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
                                statusMsg.textContent = "Sigue sin detectarlo. La foto original necesita estar 100% nítida y sin brillos.";
                            });
                    };
                    rotatedImg.src = rotatedCanvas.toDataURL("image/png");
                });
        };
        img.src = paddedCanvas.toDataURL("image/png");
    }

    // Controles de la Guía y Zoom
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
        decodeCanvasWithRotationFallback(canvas);
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

        // FORZAR ALTA RESOLUCIÓN Y AUTOENFOQUE EN LA CÁMARA
        const constraints = {
            video: {
                facingMode: 'environment',
                width: { ideal: 1920 },  // Exigir Full HD para mejorar la lectura de PDF417
                height: { ideal: 1080 },
                advanced: [{ focusMode: "continuous" }] // Pedir autoenfoque al dispositivo
            }
        };

        codeReader.decodeFromConstraints(constraints, 'video', (result, err) => {
            if (result) handleResult(result);
        }).catch((err) => {
            console.error(err);
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

    // LÓGICA DE SUBIDA DE IMAGEN CON ARRASTRE LIBRE (DRAG MODE)
    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length) {
            stopCamera();
            resultBox.style.display = 'none';
            cameraControls.style.display = 'none';
            
            const file = e.target.files[0];
            const reader = new FileReader();
            
            reader.onload = (event) => {
                imageToCrop.src = event.target.result;
                cropperContainer.style.display = 'block';
                statusMsg.textContent = "Usa tus dedos/ratón para hacer zoom y arrastrar la imagen.";

                if (cropper) cropper.destroy();
                cropper = new Cropper(imageToCrop, {
                    viewMode: 1,
                    dragMode: 'move', // ESTA LÍNEA ES LA MAGIA: Permite arrastrar la foto mientras haces zoom
                    autoCropArea: 0.8,
                    restore: false,
                    guides: true,
                    zoomable: true,
                    movable: true,
                    background: true
                });
            };
            reader.readAsDataURL(file);
        }
    });

    cropAndReadBtn.addEventListener('click', () => {
        if (cropper) {
            statusMsg.textContent = "Analizando recorte...";
            const canvas = cropper.getCroppedCanvas();
            decodeCanvasWithRotationFallback(canvas);
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
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

    // Nuevos controles
    const cameraControls = document.getElementById('cameraControls');
    const zoomSlider = document.getElementById('zoomSlider');
    const manualCaptureBtn = document.getElementById('manualCaptureBtn');
    const cropperContainer = document.getElementById('cropperContainer');
    const imageToCrop = document.getElementById('imageToCrop');
    const cropAndReadBtn = document.getElementById('cropAndReadBtn');

    let cropper = null;
    let currentZoom = 1;

    const hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.PDF_417]);
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
    const codeReader = new ZXing.BrowserMultiFormatReader(hints);

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
        document.getElementById('field1').textContent = parts[3] || '';
        document.getElementById('field2').textContent = `${parts[4] || ''} ${parts[5] || ''}`.trim();
        document.getElementById('field3').textContent = formatDate(parts[6]);
        document.getElementById('field9').textContent = parts[7] || '';
        document.getElementById('field4c').textContent = parts[8] || '';
        document.getElementById('field8').textContent = ''; 
    }

    function handleResult(result) {
        if (result) {
            const rawText = result.text;
            rawOutput.textContent = rawText;
            const decodedText = decodeBase64ToText(rawText);
            decodedOutput.textContent = decodedText;
            populateVirtualCard(decodedText);
            
            resultBox.style.display = 'block';
            cropperContainer.style.display = 'none';
            statusMsg.textContent = "¡Código decodificado con éxito!";
            stopCamera();
        }
    }

    // LÓGICA DE ROTACIÓN: Si falla normal, intenta girar el lienzo 90 grados (soluciona códigos verticales)
    function decodeCanvasWithRotationFallback(canvas) {
        codeReader.decodeFromCanvas(canvas)
            .then(handleResult)
            .catch(() => {
                // Si falla, creamos un canvas girado
                const rotatedCanvas = document.createElement('canvas');
                rotatedCanvas.width = canvas.height;
                rotatedCanvas.height = canvas.width;
                const ctx = rotatedCanvas.getContext('2d');
                ctx.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
                ctx.rotate(90 * Math.PI / 180);
                ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);

                codeReader.decodeFromCanvas(rotatedCanvas)
                    .then(handleResult)
                    .catch(() => {
                        statusMsg.textContent = "No se detectó código. Asegúrate de encuadrar solo el PDF417.";
                    });
            });
    }

    // Control de ZOOM del visor
    zoomSlider.addEventListener('input', (e) => {
        currentZoom = parseFloat(e.target.value);
        video.style.transform = `scale(${currentZoom})`;
    });

    // CAPTURA MANUAL CON CÁMARA APLICANDO EL ZOOM DIGITAL
    manualCaptureBtn.addEventListener('click', () => {
        statusMsg.textContent = "Analizando captura manual...";
        const canvas = document.createElement('canvas');
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        canvas.width = vw;
        canvas.height = vh;
        
        const ctx = canvas.getContext('2d');
        // Calculamos el recorte interno basándonos en el nivel de zoom
        const cropWidth = vw / currentZoom;
        const cropHeight = vh / currentZoom;
        const cropX = (vw - cropWidth) / 2;
        const cropY = (vh - cropHeight) / 2;
        
        ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
        decodeCanvasWithRotationFallback(canvas);
    });

    startCameraBtn.addEventListener('click', () => {
        resultBox.style.display = 'none';
        cropperContainer.style.display = 'none';
        videoWrapper.style.display = 'block';
        cameraControls.style.display = 'block';
        startCameraBtn.style.display = 'none';
        stopCameraBtn.style.display = 'block';
        statusMsg.textContent = "Cámara activa. El código se leerá automáticamente o pulsa Capturar.";

        // Reiniciar zoom visual
        currentZoom = 1;
        zoomSlider.value = 1;
        video.style.transform = `scale(1)`;

        codeReader.decodeFromVideoDevice(null, 'video', (result, err) => {
            if (result) handleResult(result);
        }).catch(console.error);
    });

    function stopCamera() {
        codeReader.reset();
        videoWrapper.style.display = 'none';
        cameraControls.style.display = 'none';
        startCameraBtn.style.display = 'block';
        stopCameraBtn.style.display = 'none';
        if(statusMsg.textContent.includes("Cámara activa")) statusMsg.textContent = "Cámara detenida.";
    }

    stopCameraBtn.addEventListener('click', stopCamera);

    // LÓGICA DE SUBIDA Y RECORTE DE IMAGEN
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
                statusMsg.textContent = "Ajusta las esquinas para encuadrar SOLO el código de barras.";

                if (cropper) cropper.destroy();
                cropper = new Cropper(imageToCrop, {
                    viewMode: 1,
                    autoCropArea: 0.8,
                    guides: true,
                    background: false
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
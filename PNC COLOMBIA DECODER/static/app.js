window.addEventListener('load', function () {
    const mainButtons = document.getElementById('mainButtons');
    const video = document.getElementById('video');
    const videoWrapper = document.getElementById('videoWrapper');
    const startCameraBtn = document.getElementById('startCamera');
    const fileInput = document.getElementById('fileInput');
    const resultBox = document.getElementById('resultBox');
    const rawOutput = document.getElementById('rawOutput');
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
    const clearBtn = document.getElementById('clearBtn');
    const appModal = document.getElementById('appModal');
    const closeAppModal = document.getElementById('closeAppModal');
    const appSelector = document.getElementById('appSelector');
    const nativeAppBtn = document.getElementById('nativeAppBtn');

    let cropper = null;
    let currentZoom = 1;
    let scanInterval = null;

    const hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.PDF_417]);
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
    const codeReader = new ZXing.BrowserMultiFormatReader(hints);

    // --- LÓGICA DE DATOS COLOMBIA ---
    function populateVirtualCard(rawText) {
        if (!rawText) return;
        let delimiter = rawText.includes('|') ? '|' : (rawText.includes(';') ? ';' : ',');
        const parts = rawText.split(delimiter).map(p => p.trim());
        const setTxt = (id, text) => { const el = document.getElementById(id); if(el) el.textContent = text; };

        setTxt('f_licencia', parts[0] || '---');
        setTxt('f_documento', parts[1] || '---');
        setTxt('f_nombres', parts[2] || '---');
        setTxt('f_apellidos', parts[3] || '---');
        setTxt('f_nacimiento', parts[4] || '---');
        setTxt('f_rh', parts[5] || '---');
        setTxt('f_tipo_doc', 'CC');
        setTxt('b_cat1', parts[6] || '---'); 
        setTxt('b_exp1', parts[7] || '---'); 
        setTxt('b_ven1', parts[8] || '---'); 
        setTxt('b_restricciones', parts[9] || '---');
        setTxt('b_organismo', parts[10] || '---');
    }

    function processSuccess(rawText) {
        if (rawOutput) rawOutput.textContent = rawText;
        populateVirtualCard(rawText);
        mainButtons.style.display = 'none'; 
        clearBtn.style.display = 'block'; 
        resultBox.style.display = 'block'; 
        cropperContainer.style.display = 'none';
        stopCamera();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // --- LA CLAVE: ESCANEAR SOLO LA ZONA DEL MARCO ---
    async function scanZone() {
        if (!video || video.paused || video.ended) return;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Calculamos la posición del marco respecto al video
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        const displayWidth = video.clientWidth;
        const displayHeight = video.clientHeight;

        const scaleX = videoWidth / displayWidth;
        const scaleY = videoHeight / displayHeight;

        // Dimensiones del marco guía
        const gw = scannerGuide.clientWidth * scaleX;
        const gh = scannerGuide.clientHeight * scaleY;
        const gx = (videoWidth - gw) / 2;
        const gy = (videoHeight - gh) / 2;

        canvas.width = gw;
        canvas.height = gh;

        // Dibujamos solo lo que está dentro del marco
        ctx.drawImage(video, gx, gy, gw, gh, 0, 0, gw, gh);

        try {
            const result = await codeReader.decodeFromCanvas(canvas);
            if (result) {
                processSuccess(result.text);
            }
        } catch (e) {
            // No detectado en este frame, reintentar
        }
    }

    if (startCameraBtn) {
        startCameraBtn.addEventListener('click', async () => {
            mainButtons.style.display = 'none'; 
            clearBtn.style.display = 'block';      
            videoWrapper.style.display = 'block';
            cameraControls.style.display = 'flex'; 
            statusMsg.textContent = "Pon el código DENTRO del marco. Evita brillos.";

            const constraints = { video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } };
            
            try {
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                video.srcObject = stream;
                video.play();
                // Iniciamos el escaneo de zona cada 400ms
                scanInterval = setInterval(scanZone, 400);
            } catch (err) {
                statusMsg.textContent = "Error al abrir cámara.";
            }
        });
    }

    function stopCamera() {
        if (scanInterval) clearInterval(scanInterval);
        if (video.srcObject) {
            video.srcObject.getTracks().forEach(track => track.stop());
        }
        videoWrapper.style.display = 'none';
        cameraControls.style.display = 'none';
    }

    // --- SUBIDA DE ARCHIVO Y RECORTADOR ---
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            mainButtons.style.display = 'none'; 
            clearBtn.style.display = 'block';
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = async () => {
                    try {
                        const result = await codeReader.decodeFromImageElement(img);
                        processSuccess(result.text);
                    } catch (err) {
                        // Si falla el automático, abrir Cropper
                        statusMsg.textContent = "No detectado. Recorta SOLO el código.";
                        imageToCrop.src = event.target.result;
                        cropperContainer.style.display = 'block';
                        if (cropper) cropper.destroy();
                        cropper = new Cropper(imageToCrop, { viewMode: 1, autoCropArea: 0.8 });
                    }
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    if (cropAndReadBtn) {
        cropAndReadBtn.addEventListener('click', async () => {
            const croppedCanvas = cropper.getCroppedCanvas();
            try {
                const result = await codeReader.decodeFromCanvas(croppedCanvas);
                processSuccess(result.text);
            } catch (e) {
                statusMsg.textContent = "Sigue sin detectarse. Intenta un recorte más limpio.";
            }
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => { location.reload(); });
    }
});
window.addEventListener('load', function () {
    const videoWrapper = document.getElementById('videoWrapper');
    const startCameraBtn = document.getElementById('startCamera');
    const stopCameraBtn = document.getElementById('stopCamera');
    const fileInput = document.getElementById('fileInput');
    const resultBox = document.getElementById('resultBox');
    const rawOutput = document.getElementById('rawOutput');
    const decodedOutput = document.getElementById('decodedOutput');
    const statusMsg = document.getElementById('status');
    const copyBtn = document.getElementById('copyBtn');

    const hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.PDF_417]);
    hints.set(ZXing.DecodeHintType.TRY_HARDER, true);

    const codeReader = new ZXing.BrowserMultiFormatReader(hints);

    // Decodifica el Base64 en UTF-8
    function decodeBase64ToText(base64Str) {
        try {
            const cleanBase64 = base64Str.replace(/\s/g, '');
            const binaryString = atob(cleanBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const decoder = new TextDecoder('utf-8');
            return decoder.decode(bytes);
        } catch (e) {
            console.error(e);
            return "Error: El texto leído no parece ser un Base64 válido.";
        }
    }

    // Da la vuelta a las fechas de YYYYMMDD a DD.MM.YYYY
    function formatDate(dateStr) {
        if (!dateStr || dateStr.length !== 8) return dateStr;
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        return `${day}.${month}.${year}`;
    }

    // Mapea los datos separados por "|" a la tarjeta virtual
    function populateVirtualCard(decodedText) {
        const parts = decodedText.split('|');
        
        // Según las instrucciones proporcionadas:
        // parts[0] = 5. Número de documento
        document.getElementById('field5').textContent = parts[0] || '';
        
        // parts[1] = 4a. Fecha expedición (invertida)
        document.getElementById('field4a').textContent = formatDate(parts[1]);
        
        // parts[2] = 4b. Fecha caducidad (invertida)
        document.getElementById('field4b').textContent = formatDate(parts[2]);
        
        // parts[3] = 1. Apellido
        document.getElementById('field1').textContent = parts[3] || '';
        
        // parts[4] y parts[5] = 2. Nombre y Patronímico
        const firstName = parts[4] || '';
        const secondName = parts[5] || '';
        document.getElementById('field2').textContent = `${firstName} ${secondName}`.trim();
        
        // parts[6] = 3. Fecha nacimiento (invertida)
        document.getElementById('field3').textContent = formatDate(parts[6]);
        
        // parts[7] = 9. Categorías
        document.getElementById('field9').textContent = parts[7] || '';
        
        // parts[8] = 4c. Autoridad expedidora
        document.getElementById('field4c').textContent = parts[8] || '';

        // El campo 8 (Residencia) no suele venir en este string específico, lo dejamos en blanco
        document.getElementById('field8').textContent = ''; 
    }

    function handleResult(result) {
        if (result) {
            const rawText = result.text;
            rawOutput.textContent = rawText;
            
            const decodedText = decodeBase64ToText(rawText);
            decodedOutput.textContent = decodedText;

            // Rellenar la simulación de la tarjeta
            populateVirtualCard(decodedText);
            
            resultBox.style.display = 'block';
            statusMsg.textContent = "¡Código decodificado y mapeado con éxito!";
            
            stopCamera();
        }
    }

    startCameraBtn.addEventListener('click', () => {
        resultBox.style.display = 'none';
        videoWrapper.style.display = 'block';
        startCameraBtn.style.display = 'none';
        stopCameraBtn.style.display = 'block';
        statusMsg.textContent = "Encuadra el código en el recuadro y acerca la cámara...";

        codeReader.decodeFromVideoDevice(null, 'video', (result, err) => {
            if (result) {
                handleResult(result);
            }
            if (err && !(err instanceof ZXing.NotFoundException)) {
                console.error(err);
            }
        }).catch((err) => {
            statusMsg.textContent = "Error al acceder a la cámara.";
            console.error(err);
        });
    });

    function stopCamera() {
        codeReader.reset();
        videoWrapper.style.display = 'none';
        startCameraBtn.style.display = 'block';
        stopCameraBtn.style.display = 'none';
        statusMsg.textContent = "Cámara detenida.";
    }

    stopCameraBtn.addEventListener('click', stopCamera);

    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length) {
            stopCamera();
            statusMsg.textContent = "Analizando imagen de forma exhaustiva...";
            resultBox.style.display = 'none';
            
            const file = e.target.files[0];
            const reader = new FileReader();
            
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    codeReader.decodeFromImageElement(img)
                        .then(result => {
                            handleResult(result);
                        })
                        .catch(err => {
                            statusMsg.textContent = "Error: No se encontró código PDF417.";
                            console.error("Fallo lectura imagen:", err);
                        });
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    copyBtn.addEventListener('click', () => {
        const textToCopy = decodedOutput.textContent;
        navigator.clipboard.writeText(textToCopy).then(() => {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = "¡Copiado!";
            setTimeout(() => copyBtn.textContent = originalText, 2000);
        }).catch(err => {
            console.error('Error al copiar: ', err);
            alert("No se pudo copiar al portapapeles.");
        });
    });
});
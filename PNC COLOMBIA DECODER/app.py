from flask import Flask, render_template, request, jsonify
from pdf417decoder import PDF417Decoder
import cv2
import numpy as np
import base64
import os

app = Flask(__name__)

@app.route('/')
def index():
    # Renderiza tu HTML desde la carpeta /templates
    return render_template('index.html')

@app.route('/decode', methods=['POST'])
def decode():
    try:
        data = request.json
        # Convertimos la foto que manda el móvil a algo que Python entienda
        img_data = base64.b64decode(data['image'].split(",")[1])
        nparr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        # Filtro mágico: Blanco y negro para resaltar el PDF417
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        processed_img = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]

        decoder = PDF417Decoder(processed_img)
        if decoder.decode() > 0:
            decoded_text = decoder.barcode_data_index_to_str(0)
            return jsonify({"success": True, "code": decoded_text})
        else:
            return jsonify({"success": False, "message": "No se detectó el código"})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
// Nombre de la tabla/documento a gestionar
const DB_REF = 'denuncias_global_ORA-RADAR';

// Configuración de tu proyecto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCY8V_P7m8lZUvGbMVlGaa-GVhbmyikmag",
  authDomain: "gad-alicante-v4.firebaseapp.com",
  databaseURL: "https://gad-alicante-v4-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "gad-alicante-v4",
  storageBucket: "gad-alicante-v4.firebasestorage.app",
  messagingSenderId: "119727545224",
  appId: "1:119727545224:web:36880c50d196c456cdb83d"
};

// Inicializar la aplicación
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
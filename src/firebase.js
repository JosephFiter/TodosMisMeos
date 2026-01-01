// src/firebase.js

// Importamos las funciones necesarias
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// IMPORTANTE: Agregamos estas líneas para la autenticación
import { getAuth, GoogleAuthProvider } from "firebase/auth";


import { getFirestore } from "firebase/firestore";

// Tu configuración de Firebase (tal cual me la pasaste)
const firebaseConfig = {
  apiKey: "AIzaSyBz2ej32vWDztNDlOf_NqYRb8EGg1qv9i8",
  authDomain: "apdemeos.firebaseapp.com",
  projectId: "apdemeos",
  storageBucket: "apdemeos.firebasestorage.app",
  messagingSenderId: "1066145272382",
  appId: "1:1066145272382:web:1a8db17196a535eabef76f",
  measurementId: "G-H3TVRB4C19"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// --- EXPORTAR AUTENTICACIÓN ---
// Esto es lo que necesita tu App.jsx para funcionar
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();


export const db = getFirestore(app);
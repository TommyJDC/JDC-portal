import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyADAy8ySvJsUP5diMyR9eIUgtPFimpydcA",
  authDomain: "sap-jdc.firebaseapp.com",
  databaseURL: "https://sap-jdc-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "sap-jdc",
  storageBucket: "sap-jdc.appspot.com",
  messagingSenderId: "1079234336489",
  appId: "1:1079234336489:web:2428621b62a393068ec278",
  measurementId: "G-PRWSK0TEFZ"
};

// Configuration spécifique pour l'authentification
export const authConfig = {
  google: {
    providerId: 'google.com',
    scopes: ['profile', 'email'],
    customParameters: {
      prompt: 'select_account'
    }
  }
};

// Google OAuth config
// Déterminer le baseUrl dynamiquement en fonction de l'environnement
const VITE_APP_BASE_URL = typeof import.meta.env !== 'undefined' ? import.meta.env.VITE_APP_BASE_URL : undefined;
const APP_BASE_URL_ENV = typeof process !== 'undefined' ? process.env.APP_BASE_URL : undefined;
const NODE_ENV = typeof process !== 'undefined' ? process.env.NODE_ENV : 'development';

let determinedBaseUrl: string;
if (NODE_ENV === 'production') {
  determinedBaseUrl = APP_BASE_URL_ENV || "https://sap-jdc.web.app"; // URL de production par défaut
} else {
  // En développement, prioriser VITE_APP_BASE_URL, puis APP_BASE_URL_ENV, puis localhost
  determinedBaseUrl = VITE_APP_BASE_URL || APP_BASE_URL_ENV || "http://localhost:5173";
}
console.log(`[firebase.config.ts] Determined baseUrl for Google OAuth: ${determinedBaseUrl}`);

export const googleConfig = {
  clientId: "1079234336489-rkeiomsnsejcfb670qt1riph0gvcpv62.apps.googleusercontent.com", // Assurez-vous que c'est le bon Client ID
  clientSecret: "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", // Assurez-vous que c'est le bon Client Secret
  baseUrl: determinedBaseUrl // Utiliser le baseUrl déterminé dynamiquement
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };

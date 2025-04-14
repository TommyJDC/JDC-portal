import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore"; // Import Firestore
// Storage n'est plus initialisé ici

// Your web app's Firebase configuration (Keep using environment variables in production)
const firebaseConfig = {
  apiKey: "AIzaSyADAy8ySvJsUP5diMyR9eIUgtPFimpydcA", // Replace with env var process.env.REACT_APP_FIREBASE_API_KEY
  authDomain: "sap-jdc.firebaseapp.com", // Replace with env var
  databaseURL: "https://sap-jdc-default-rtdb.europe-west1.firebasedatabase.app", // Replace with env var if using RTDB
  projectId: "sap-jdc", // Replace with env var
  storageBucket: "sap-jdc.appspot.com", // Corrected based on your example
  messagingSenderId: "1079234336489", // Replace with env var
  appId: "1:1079234336489:web:2428621b62a393068ec278", // Replace with env var
  measurementId: "G-PRWSK0TEFZ" // Optional, replace with env var
};

// Initialize Firebase only if it hasn't been initialized yet
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

// Initialize Firestore using the standard method
const db = getFirestore(app);
// Cloud Storage n'est plus initialisé ici

// const analytics = getAnalytics(app); // Optional

export { app, auth, db }; // Ne plus exporter storage

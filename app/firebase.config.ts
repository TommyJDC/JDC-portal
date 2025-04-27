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

// Google OAuth config
export const googleConfig = {
  clientId: "1079234336489-rkeiomsnsejcfb670qt1riph0gvcpv62.apps.googleusercontent.com",
  clientSecret: "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",
  baseUrl: "https://sap-jdc.web.app"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };

import { getAuth } from "firebase-admin/auth";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let db: FirebaseFirestore.Firestore;

export async function initializeFirebaseAdmin() {
  try {
    const app = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
      storageBucket: '' // Explicitement vide pour éviter toute initialisation de Storage
    });
    
    db = getFirestore(app);
    return db;
  } catch (error: any) {
    if (error.code === 'app/duplicate-app') {
      const apps = getApps();
      const app = apps.length ? apps[0] : null;
      if (app) {
        db = getFirestore(app);
        return db;
      }
    }
    console.error('Firebase Admin initialization error:', error);
    throw error;
  }
}

export const getDb = (): FirebaseFirestore.Firestore => {
  if (!db) {
    throw new Error('Firebase Admin not initialized. Call initializeFirebaseAdmin() first.');
  }
  return db;
};

export const auth = () => {
  if (getApps().length === 0) {
    throw new Error('Firebase Admin not initialized. Call initializeFirebaseAdmin() first.');
  }
  return getAuth();
};

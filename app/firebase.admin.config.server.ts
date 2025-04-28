import { getAuth } from "firebase-admin/auth";
import { initializeApp, cert, getApps, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage, Storage } from "firebase-admin/storage";

let db: FirebaseFirestore.Firestore;
let storage: Storage;
let firebaseAdminApp: App;

export async function initializeFirebaseAdmin() {
  try {
    const apps = getApps();
    if (apps.length === 0) {
      console.log('FIREBASE_STORAGE_BUCKET value during Admin SDK init:', process.env.FIREBASE_STORAGE_BUCKET); // Add this log
      firebaseAdminApp = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET // Use the env var
      });
    } else {
      firebaseAdminApp = apps[0];
    }

    db = getFirestore(firebaseAdminApp);
    // Ne configurer les paramètres que si c'est la première initialisation
    if (apps.length === 0) {
      db.settings({ ignoreUndefinedProperties: true });
    }
    storage = getStorage(firebaseAdminApp); // Initialiser Storage
    return db; // Retourner db comme avant, ou l'app si nécessaire
  } catch (error: any) {
    console.error('Firebase Admin initialization error:', error);
    throw error;
  }
}

export const getDb = (): FirebaseFirestore.Firestore => {
  if (!db) {
    throw new Error('Firebase Admin Firestore not initialized. Call initializeFirebaseAdmin() first.');
  }
  return db;
};

export const getStorageInstance = (): Storage => {
  if (!storage) {
    throw new Error('Firebase Admin Storage not initialized. Call initializeFirebaseAdmin() first.');
  }
  return storage;
};


export const auth = () => {
  if (!firebaseAdminApp) {
    throw new Error('Firebase Admin not initialized. Call initializeFirebaseAdmin() first.');
  }
  return getAuth(firebaseAdminApp);
};

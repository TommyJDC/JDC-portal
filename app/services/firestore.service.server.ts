import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import type { 
  UserProfile, 
  SapTicket, 
  Shipment, 
  StatsSnapshot, 
  Installation, 
  InstallationStatus,
  InstallationFilters,
  Notification,
  Article
} from "~/types/firestore.types";
import type * as admin from 'firebase-admin';
import fetch from 'node-fetch';
import FormData from 'form-data';

let db: FirebaseFirestore.Firestore;
let installationsCollection: admin.firestore.CollectionReference;
let storageBucket: import('@google-cloud/storage').Bucket;

export async function initializeFirebaseAdmin() {
  try {
    const app = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
    
    db = getFirestore(app);
    installationsCollection = db.collection('installations');
    storageBucket = getStorage(app).bucket();
    return db;
  } catch (error: any) {
    if (error.code === 'app/duplicate-app') {
      const apps = getApps();
      const app = apps.length ? apps[0] : null;
      if (app) {
        db = getFirestore(app);
        installationsCollection = db.collection('installations');
        storageBucket = getStorage(app).bucket();
        return db;
      }
    }
    console.error('Firebase Admin initialization error:', error);
    throw error;
  }
}

// Fonction pour sauvegarder un fichier dans Firebase Storage
export async function saveFileToStorage(
  buffer: Buffer | Uint8Array,
  path: string,
  contentType: string
): Promise<string> {
  try {
    if (!storageBucket) {
      await initializeFirebaseAdmin();
    }

    const file = storageBucket.file(path);
    await file.save(buffer, {
      metadata: {
        contentType,
      },
    });

    // Rendre le fichier public
    await file.makePublic();

    // Retourner l'URL publique
    return `https://storage.googleapis.com/${storageBucket.name}/${path}`;
  } catch (error) {
    console.error('Error saving file to storage:', error);
    throw error;
  }
}

// ... [le reste du fichier existant reste inchangé]

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import type { 
  UserProfile, 
  SapTicket, 
  Shipment, 
  StatsSnapshot, 
  Installation, 
  InstallationStatus,
  InstallationFilters,
  Notification,
  Article,
  InstallationsSnapshot
} from "~/types/firestore.types";
import type * as admin from 'firebase-admin';
import fetch from 'node-fetch';
import FormData from 'form-data';

let db: FirebaseFirestore.Firestore;
let installationsCollection: admin.firestore.CollectionReference;

export async function initializeFirebaseAdmin() {
  try {
    const app = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      })
    });
    
    db = getFirestore(app);
    installationsCollection = db.collection('installations');
    return db;
  } catch (error: any) {
    if (error.code === 'app/duplicate-app') {
      const apps = getApps();
      const app = apps.length ? apps[0] : null;
      if (app) {
        db = getFirestore(app);
        installationsCollection = db.collection('installations');
        return db;
      }
    }
    console.error('Firebase Admin initialization error:', error);
    throw error;
  }
}

export async function getUserProfileSdk(uid: string): Promise<UserProfile | undefined> {
  if (!db) await initializeFirebaseAdmin();
  const userRef = db.collection('users').doc(uid);
  const doc = await userRef.get();
  if (!doc.exists) {
    return undefined;
  }
  const data = doc.data();
  // Ensure the document has required fields and add uid if missing
  return {
    uid: data?.uid || uid, // Use existing uid or fallback to doc id
    email: data?.email || '',
    role: data?.role || '',
    secteurs: data?.secteurs || [],
    displayName: data?.displayName || '',
    nom: data?.nom || '',
    password: data?.password || '',
    ...data // Include all other fields
  } as UserProfile;
}

export async function createUserProfileSdk(profileData: UserProfile): Promise<UserProfile> {
  if (!db) await initializeFirebaseAdmin();
  await db.collection('users').doc(profileData.uid).set(profileData);
  return profileData;
}

export async function updateUserProfileSdk(uid: string, updates: Partial<UserProfile>): Promise<void> {
  if (!db) await initializeFirebaseAdmin();
  const userRef = db.collection('users').doc(uid);
  await userRef.update(updates);
}

export async function updateInstallation(id: string, updates: Partial<Installation>): Promise<void> {
  if (!db) await initializeFirebaseAdmin();
  const installationRef = db.collection('installations').doc(id);
  await installationRef.update(updates);
}

export async function getInstallationsBySector(sector: string, filters?: InstallationFilters): Promise<Installation[]> {
  if (!db) await initializeFirebaseAdmin();
  let query: admin.firestore.CollectionReference | admin.firestore.Query = db.collection(sector);

  if (filters) {
    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }
    // Add more filters here if needed (dateRange, commercial, technicien, ville, searchTerm)
  }

  const snapshot = await query.get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), secteur: sector })) as unknown[] as Installation[];
}

export async function getClientCodesWithShipment(sector: string): Promise<Set<string>> {
  if (!db) await initializeFirebaseAdmin();
  
  // Récupérer tous les envois
  const shipments = await getAllShipments();
  
  // Créer un Set des codeClient/secteur uniques
  const clientCodes = new Set<string>();
  
  shipments.forEach(shipment => {
    if (shipment.secteur && shipment.secteur === sector && shipment.codeClient) {
      clientCodes.add(shipment.codeClient);
    }
  });
  
  return clientCodes;
}

export async function getAllTicketsForSectorsSdk() {
  if (!db) await initializeFirebaseAdmin();
  const sectors = ['CHR', 'HACCP', 'Kezia', 'Tabac']; // Using uppercase sector names
  let allTickets: SapTicket[] = [];
  for (const sector of sectors) {
    const snapshot = await db.collection(sector).get();
    const sectorTickets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), secteur: sector })) as unknown[] as SapTicket[]; // Add sector info
    allTickets = [...allTickets, ...sectorTickets];
  }
  return allTickets;
}

export async function updateSAPTICKET(ticketId: string, updates: Partial<SapTicket>): Promise<void> {
  if (!db) await initializeFirebaseAdmin();
  const ticketRef = db.collection('tickets').doc(ticketId);
  await ticketRef.update(updates);
}

export async function getAllShipments() {
  if (!db) await initializeFirebaseAdmin();
  const snapshot = await db.collection('Envoi').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as unknown[] as Shipment[]; // Adjust type if needed
}

export async function deleteShipmentSdk(shipmentId: string): Promise<void> {
  if (!db) await initializeFirebaseAdmin();
  await db.collection('shipments').doc(shipmentId).delete();
}

export async function getAllUserProfilesSdk(): Promise<UserProfile[]> {
  if (!db) await initializeFirebaseAdmin();
  const snapshot = await db.collection('users').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as unknown[] as UserProfile[];
}

export async function getTotalTicketCountSdk(sectors: string[]): Promise<number> {
  if (!db) await initializeFirebaseAdmin();
  let totalCount = 0;
  
  for (const sector of sectors) {
    const snapshot = await db.collection(sector).count().get();
    totalCount += snapshot.data().count;
  }
  
  return totalCount;
}

export async function getRecentTicketsForSectors(sectors: string[], limit: number): Promise<SapTicket[]> {
  if (!db) await initializeFirebaseAdmin();
  let allTickets: SapTicket[] = [];
  
  for (const sector of sectors) {
    const snapshot = await db.collection(sector)
      .orderBy('date', 'desc')
      .limit(limit)
      .get();
      
    const sectorTickets = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data(),
      secteur: sector 
    })) as SapTicket[];
    
    allTickets = [...allTickets, ...sectorTickets];
  }
  
  // Sort all tickets by date and return top N
  return allTickets
    .sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date.getTime() : 
                   a.date?.seconds ? a.date.seconds * 1000 : 0;
      const dateB = b.date instanceof Date ? b.date.getTime() : 
                   b.date?.seconds ? b.date.seconds * 1000 : 0;
      return dateB - dateA;
    })
    .slice(0, limit);
}

export async function getDistinctClientCountFromEnvoiSdk(userProfile: UserProfile): Promise<number> {
  if (!db) await initializeFirebaseAdmin();
  
  const sectors = userProfile.role === 'Admin' 
    ? ['CHR', 'HACCP', 'Kezia', 'Tabac']
    : userProfile.secteurs;
  
  const clientCodes = new Set<string>();
  
  for (const sector of sectors) {
    const snapshot = await db.collection('Envoi')
      .where('secteur', '==', sector)
      .get();
      
    snapshot.docs.forEach(doc => {
      const shipment = doc.data() as Shipment;
      if (shipment.codeClient) {
        clientCodes.add(shipment.codeClient);
      }
    });
  }
  
  return clientCodes.size;
}

export async function getInstallationsSnapshot(userProfile: UserProfile): Promise<InstallationsSnapshot> {
  if (!db) await initializeFirebaseAdmin();
  
  const sectors = userProfile.role === 'Admin' 
    ? ['CHR', 'HACCP', 'Kezia', 'Tabac']
    : userProfile.secteurs;
  
  const snapshot: InstallationsSnapshot = {
    total: 0,
    byStatus: {
      'rendez-vous à prendre': 0,
      'rendez-vous pris': 0, 
      'installation terminée': 0
    },
    bySector: {}
  };

  for (const sector of sectors) {
    snapshot.bySector[sector] = {
      total: 0,
      byStatus: {
        'rendez-vous à prendre': 0,
        'rendez-vous pris': 0,
        'installation terminée': 0
      }
    };
    
    const statusSnapshot = await db.collection(sector)
      .select('status')
      .get();
      
    statusSnapshot.docs.forEach(doc => {
      const status = doc.get('status') as InstallationStatus;
      snapshot.total++;
      snapshot.byStatus[status]++;
      
      snapshot.bySector[sector].total++;
      snapshot.bySector[sector].byStatus[status]++;
    });
  }
  
  return snapshot;
}

export async function getLatestStatsSnapshotsSdk(): Promise<StatsSnapshot[]> {
  if (!db) await initializeFirebaseAdmin();
  const snapshot = await db.collection('dailyStatsSnapshots')
    .orderBy('timestamp', 'desc')
    .limit(30) // Retourne les 30 derniers snapshots
    .get();
    
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as StatsSnapshot[];
}

export async function getGeocodeFromCache(address: string): Promise<{ lat: number; lng: number } | undefined> {
  if (!db) await initializeFirebaseAdmin();
  const geocodeCacheRef = db.collection('geocodeCache').doc(address);
  const doc = await geocodeCacheRef.get();
  if (!doc.exists) {
    return undefined;
  }
  return doc.data() as { lat: number; lng: number };
}

export async function setGeocodeToCache(address: string, geocode: { lat: number; lng: number }): Promise<void> {
  if (!db) await initializeFirebaseAdmin();
  const geocodeCacheRef = db.collection('geocodeCache').doc(address);
  await geocodeCacheRef.set(geocode);
}


// Fonction pour sauvegarder un fichier dans Firebase Storage
// Cloudinary configuration
const cloudinaryConfig = {
  cloudName: 'dkeqzl54y',
  apiKey: '725561566214411',
  apiSecret: process.env.CLOUDINARY_API_SECRET || 'cJQOY_KSc0gkmLFx2nT496VbBVY',
  uploadPreset: 'articles_images'
};

/**
 * Uploads an image to Cloudinary
 */
export async function uploadImageToCloudinary(buffer: Buffer, filename: string): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('file', buffer, { filename });
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    formData.append('cloud_name', cloudinaryConfig.cloudName);
    formData.append('api_key', cloudinaryConfig.apiKey);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`,
      {
        method: 'POST',
        body: formData
      }
    );

    if (!response.ok) {
      throw new Error(`Cloudinary upload failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.secure_url;
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw error;
  }
}

/**
 * Adds an image URL to an article's imageUrls array
 */
export async function addArticleImageUrl(articleId: string, imageUrl: string): Promise<void> {
  if (!db) await initializeFirebaseAdmin();
  const articleRef = db.collection('articles').doc(articleId);
  await articleRef.update({
    imageUrls: FieldValue.arrayUnion(imageUrl)
  });
}

/**
 * Removes an image URL from an article's imageUrls array
 */
export async function deleteArticleImageUrl(articleId: string, imageUrl: string): Promise<void> {
  if (!db) await initializeFirebaseAdmin();
  const articleRef = db.collection('articles').doc(articleId);
  await articleRef.update({
    imageUrls: FieldValue.arrayRemove(imageUrl)
  });
}

/**
 * Search articles by code and/or name
 */
export async function searchArticles({ code, nom }: { code: string; nom: string }): Promise<Article[]> {
  if (!db) await initializeFirebaseAdmin();
  
  let query: FirebaseFirestore.Query = db.collection('articles');

  if (code) {
    query = query.where('code', '==', code);
  }

  if (nom) {
    query = query.where('nom', '>=', nom)
                 .where('nom', '<=', nom + '\uf8ff');
  }

  const snapshot = await query.get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Article[];
}

// ... [le reste du fichier existant reste inchangé]

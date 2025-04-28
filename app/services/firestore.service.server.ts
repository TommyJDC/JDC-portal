import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'; // Import Timestamp here
import { convertFirestoreDate } from "~/utils/dateUtils"; // Import ajouté
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
  InstallationsSnapshot,
  SAPArchive // Import SAPArchive here
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
  let query: admin.firestore.CollectionReference | admin.firestore.Query = db.collection('installations')
    .where('secteur', '==', sector);

  if (filters) {
    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }
    // Add more filters here if needed (dateRange, commercial, technicien, ville, searchTerm)
  }

  const snapshot = await query.get();
  return snapshot.docs.map(doc => {
    const data = doc.data();
    // Les données sont déjà mappées correctement dans Firestore par api.sync-installations
    // Nous nous assurons simplement que les champs principaux sont présents et typés correctement
    const installation: Installation = {
      ...data, // Inclure toutes les données brutes de Firestore
      id: doc.id, // Surcharger avec l'ID du document
      secteur: sector, // Surcharger avec le secteur

      // Surcharger les champs principaux pour assurer leur présence et leur type
      codeClient: data.codeClient || '',
      nom: data.nom || '',
      ville: data.ville || '',
      contact: data.contact || '',
      telephone: data.telephone || '', // Le champ telephone devrait être correct grâce à la synchronisation
      commercial: data.commercial || '',
      dateInstall: data.dateInstall || undefined, // Le formatage sera fait dans le loader de la route
      tech: data.tech || '',
      status: (data.status as InstallationStatus) || 'rendez-vous à prendre', // Assurer le type correct et une valeur par défaut
      commentaire: data.commentaire || '',

      // Les autres champs spécifiques aux secteurs seront inclus via le spread ...data
    };
    return installation;
  }) as Installation[];
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

export async function getAllTicketsForSectorsSdk(sectors: string[]) { // Accept sectors array as parameter
  if (!db) await initializeFirebaseAdmin();
  // const sectors = ['CHR', 'HACCP', 'Kezia', 'Tabac']; // Removed hardcoded sectors
  let allTickets: SapTicket[] = [];
  if (!sectors || sectors.length === 0) {
      console.warn("getAllTicketsForSectorsSdk called with empty or null sectors array.");
      return []; // Return empty array if no sectors are provided
  }
  for (const sector of sectors) {
    // Ensure sector name is valid before querying
    const validSectors = ['CHR', 'HACCP', 'Kezia', 'Tabac'];
    if (!validSectors.includes(sector)) {
        console.warn(`getAllTicketsForSectorsSdk: Invalid sector name provided: ${sector}. Skipping.`);
        continue; // Skip invalid sectors
    }
    const snapshot = await db.collection(sector).get();
    const sectorTickets = snapshot.docs.map(doc => {
      const data = doc.data();
      // Convertir la date en utilisant la fonction utilitaire
      const date = convertFirestoreDate(data.date);

      // Add logging here to inspect the raw status value from Firestore
      console.log(`Raw status from Firestore for ticket ${doc.id} in sector ${sector}:`, data.statut, `Type:`, typeof data.statut);

      // Process status: ensure it's in { stringValue: string } format or undefined
      let statut: { stringValue: string } | undefined;
      // Corrected field name from data.statut to data.status
      const rawStatut = data.status;
      if (typeof rawStatut === 'string') {
          statut = { stringValue: rawStatut };
      } else if (typeof rawStatut === 'object' && rawStatut !== null && 'stringValue' in rawStatut && typeof rawStatut.stringValue === 'string') {
          statut = rawStatut as { stringValue: string };
      } else {
          // Default status if missing or invalid format
          statut = { stringValue: 'Inconnu' };
      }


      return {
        id: doc.id,
        ...data, // Include other raw data
        date, // Use the processed date
        secteur: sector, // Ensure sector is set
        statut // Use the processed status
      } as SapTicket;
    });
    allTickets = [...allTickets, ...sectorTickets];
  }
  return allTickets;
}

export async function updateSAPTICKET(sectorId: string, ticketId: string, updates: Partial<SapTicket>): Promise<void> {
  if (!db) await initializeFirebaseAdmin();
  // Use the sectorId to get the correct collection
  const ticketRef = db.collection(sectorId).doc(ticketId);
  await ticketRef.update(updates);
}

export async function getAllShipments() {
  if (!db) await initializeFirebaseAdmin();
  const snapshot = await db.collection('Envoi').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as unknown[] as Shipment[]; // Adjust type if needed
}

export async function deleteShipmentSdk(shipmentId: string): Promise<void> {
  if (!db) await initializeFirebaseAdmin();
  await db.collection('Envoi').doc(shipmentId).delete();
}

export async function getAllUserProfilesSdk(): Promise<UserProfile[]> {
  if (!db) await initializeFirebaseAdmin();
  const snapshot = await db.collection('users').get();
  return snapshot.docs.map(doc => ({
    uid: doc.id, // Use document ID as fallback uid
    ...doc.data(),
    // Ensure required fields have defaults
    email: doc.data().email || '',
    role: doc.data().role || '',
    secteurs: doc.data().secteurs || [],
    displayName: doc.data().displayName || '',
    nom: doc.data().nom || '',
    password: doc.data().password || ''
  })) as UserProfile[];
}

/**
 * Gets the total count of SAP tickets for each specified sector.
 * @param sectors - An array of sector names (e.g., ['CHR', 'HACCP']).
 * @returns A promise that resolves to an object with sector names as keys and ticket counts as values.
 */
export async function getSapTicketCountBySectorSdk(sectors: string[]): Promise<Record<string, number>> {
  if (!db) await initializeFirebaseAdmin();
  const ticketCounts: Record<string, number> = {};

  for (const sector of sectors) {
    try {
      const snapshot = await db.collection(sector).count().get();
      ticketCounts[sector] = snapshot.data().count;
    } catch (error) {
      console.error(`Error fetching ticket count for sector ${sector}:`, error);
      ticketCounts[sector] = 0; // Default to 0 in case of error
    }
  }

  return ticketCounts;
}

export async function getRecentTicketsForSectors(sectors: string[], limit: number): Promise<SapTicket[]> {
  if (!db) await initializeFirebaseAdmin();
  let allTickets: SapTicket[] = [];

  for (const sector of sectors) {
    const snapshot = await db.collection(sector)
      .orderBy('date', 'desc')
      .limit(limit)
      .get();

    const sectorTickets = snapshot.docs.map(doc => {
      const data = doc.data();
      // Convertir la date en utilisant la fonction utilitaire
      const date = convertFirestoreDate(data.date);
      return {
        id: doc.id,
        ...data,
        date,
        secteur: sector
      } as SapTicket;
    });

    allTickets = [...allTickets, ...sectorTickets];
  }

  // Sort all tickets by date and return top N
  return allTickets
    .sort((a, b) => {
      const dateA = a.date?.getTime() || 0;
      const dateB = b.date?.getTime() || 0;
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

export async function getAllInstallations(): Promise<Installation[]> {
  if (!db) await initializeFirebaseAdmin();
  const snapshot = await db.collection('installations').get();
  return snapshot.docs.map(doc => {
    const data = doc.data();
    const installation: Installation = {
      ...data,
      id: doc.id,
      secteur: data.secteur || '',
      codeClient: data.codeClient || '',
      nom: data.nom || '',
      ville: data.ville || '',
      contact: data.contact || '',
      telephone: data.telephone || '',
      commercial: data.commercial || '',
      dateInstall: data.dateInstall || undefined,
      tech: data.tech || '',
      status: (data.status as InstallationStatus) || 'rendez-vous à prendre',
      commentaire: data.commentaire || '',
    };
    return installation;
  }) as Installation[];
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
  let articles: Article[] = [];

  // Convert input to uppercase for case-insensitive search against uppercase data in Firestore
  const upperCode = code.toUpperCase();
  const upperNom = nom.toUpperCase();

  if (upperCode) {
    // Prioritize exact code search if provided
    console.log("[searchArticles] Searching by code (uppercase):", upperCode);
    query = query.where('Code', '==', upperCode); // Use 'Code' field name as per Article type
    const snapshot = await query.get();
    articles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Article[];
  } else if (upperNom) {
    // If no code, search by name prefix
    console.log("[searchArticles] Searching by nom (uppercase):", upperNom);
    query = query.where('Désignation', '>=', upperNom) // Use 'Désignation' field name as per Article type
                 .where('Désignation', '<=', upperNom + '\uf8ff');
    const snapshot = await query.get();
    articles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Article[];
  } else {
    // If neither is provided, return empty array (loader handles this too, but good practice here)
    console.log("[searchArticles] No search criteria provided.");
    articles = [];
  }

  return articles;
}

/**
 * Safely extracts the string value from a ticket property, handling both { stringValue: string } and simple string formats.
 * @param prop The ticket property.
 * @param defaultValue The default value to return if the property is null, undefined, or not in the expected format.
 * @returns The string value of the property or the default value.
 */
function getSafeStringValue(prop: { stringValue: string } | string | undefined | null, defaultValue: string = ''): string {
  if (prop === undefined || prop === null) {
    return defaultValue;
  }
  if (typeof prop === 'string') {
    return prop;
  }
  if (typeof prop === 'object' && prop !== null && 'stringValue' in prop && typeof prop.stringValue === 'string') {
    return prop.stringValue;
  }
  return defaultValue;
}

/**
 * Archives a SAP ticket by moving it to the 'sap-archive' collection and deleting the original.
 * @param ticket - The SapTicket object to archive.
 * @param technicianNotes - Optional notes from the technician regarding the closure.
 * @param technicianName - The name of the technician performing the archive.
 */
export async function archiveSapTicket(ticket: SapTicket, technicianNotes: string | undefined, technicianName: string): Promise<void> {
  if (!db) await initializeFirebaseAdmin();

  // Safely extract string values from the ticket object
  const clientValue = getSafeStringValue(ticket.client, getSafeStringValue(ticket.raisonSociale, 'Client inconnu'));
  const raisonSocialeValue = getSafeStringValue(ticket.raisonSociale);
  const descriptionValue = getSafeStringValue(ticket.description, getSafeStringValue(ticket.descriptionProbleme));
  const numeroSAPValue = getSafeStringValue(ticket.numeroSAP);

  // Prepare archive data, ensuring fields are in { stringValue: string } format or simple strings as per SAPArchive type
  // Based on SAPArchive type, some fields are { stringValue: string } | undefined, others are string.
  const archiveData: SAPArchive = {
    originalTicketId: ticket.id,
    archivedDate: FieldValue.serverTimestamp() as any, // Firestore handles Timestamp
    closureReason: ticket.status === 'closed' ? 'resolved' : 'no-response', // Corrected type
    technicianNotes: technicianNotes || 'Aucune note fournie', // Ensure string, add default
    technician: technicianName, // Use the actual technician name
    // Store as { stringValue: string } if the type expects it, using extracted values
    client: { stringValue: clientValue },
    raisonSociale: { stringValue: raisonSocialeValue },
    description: { stringValue: descriptionValue },
    secteur: ticket.secteur as 'CHR' | 'HACCP' | 'Kezia' | 'Tabac', // Assurer le type correct
    numeroSAP: { stringValue: numeroSAPValue },
    mailId: ticket.mailId, // mailId is a simple string
    documents: [], // Add documents field
  };

  try {
    // First create the archive document
    const archiveRef = await db.collection('sap-archive').add(archiveData);
    console.log(`Ticket ${ticket.id} archived successfully to ${archiveRef.id}`);

    // Then delete the original ticket
    await db.collection(ticket.secteur).doc(ticket.id).delete();
    console.log(`Original ticket ${ticket.id} deleted from ${ticket.secteur}`);
  } catch (error) {
    console.error(`Error archiving ticket ${ticket.id}:`, error);
    throw error;
  }
}

// Définition du type pour les brouillons de déclaration d'heures
export interface HeuresDraft {
  userId: string;
  fileId: string; // ID du fichier Google Sheet
  data: any; // Données du formulaire
  createdAt: Timestamp; // Utiliser Timestamp de firebase-admin
}

/**
 * Sauvegarde un brouillon de déclaration d'heures dans Firestore.
 * @param draftData - Les données du brouillon à sauvegarder.
 * @returns Promise<void>
 */
export async function saveHeuresDraft(draftData: Omit<HeuresDraft, 'createdAt'>): Promise<void> {
  if (!db) await initializeFirebaseAdmin();
  // Utiliser l'ID utilisateur et l'ID fichier comme identifiant unique pour le brouillon
  const docId = `${draftData.userId}_${draftData.fileId}`;
  await db.collection('heuresDrafts').doc(docId).set({
    ...draftData,
    createdAt: FieldValue.serverTimestamp() // Utiliser le timestamp du serveur
  });
}

/**
 * Récupère un brouillon de déclaration d'heures depuis Firestore.
 * @param userId - L'ID de l'utilisateur.
 * @param fileId - L'ID du fichier Google Sheet.
 * @returns Promise<HeuresDraft | undefined>
 */
export async function getHeuresDraft(userId: string, fileId: string): Promise<HeuresDraft | undefined> {
  if (!db) await initializeFirebaseAdmin();
  const docId = `${userId}_${fileId}`;
  const doc = await db.collection('heuresDrafts').doc(docId).get();
  if (!doc.exists) {
    return undefined;
  }
  const data = doc.data() as HeuresDraft;
  // Convertir le Timestamp en Date si nécessaire côté client,
  // mais ici on retourne le type Firestore tel quel.
  return data;
}


/**
 * Supprime définitivement un ticket SAP de Firestore
 * @param sectorId - Secteur du ticket (ex: 'CHR', 'HACCP', 'Kezia', 'Tabac')
 * @param ticketId - ID du ticket à supprimer
 * @returns Promise<{ success: boolean; message: string }>
 */
export async function deleteSapTicket(
  sectorId: string, 
  ticketId: string
): Promise<{ success: boolean; message: string }> {
  try {
    if (!sectorId || !ticketId) {
      throw new Error('Paramètres sectorId et ticketId requis');
    }
    
    if (!db) await initializeFirebaseAdmin();
    
    const validSectors = ['CHR', 'HACCP', 'Kezia', 'Tabac'];
    if (!validSectors.includes(sectorId)) {
      throw new Error(`Secteur invalide: ${sectorId}`);
    }

    const docRef = db.collection(sectorId).doc(ticketId);
    const docExists = (await docRef.get()).exists;

    if (!docExists) {
      return { 
        success: false,
        message: `Ticket ${ticketId} introuvable dans le secteur ${sectorId}`
      };
    }

    await docRef.delete();
    
    return {
      success: true,
      message: `Ticket ${ticketId} supprimé avec succès du secteur ${sectorId}`
    };
    
  } catch (error) {
    console.error(`Erreur suppression ticket ${ticketId} (${sectorId}) :`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erreur inconnue lors de la suppression'
    };
  }
}

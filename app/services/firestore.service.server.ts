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
  Article
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

// Fonctions de gestion des utilisateurs
export const getUserProfileSdk = async (userId: string): Promise<UserProfile | null> => {
  try {
    if (!db) {
      db = await initializeFirebaseAdmin();
    }
    const doc = await db.collection('users').doc(userId).get();
    return doc.exists ? (doc.data() as UserProfile) : null;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
};

export const getAllUserProfilesSdk = async (): Promise<UserProfile[]> => {
  try {
    if (!db) {
      db = await initializeFirebaseAdmin();
    }
    const snapshot = await db.collection('users').get();
    return snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile));
  } catch (error) {
    console.error("Error fetching all user profiles:", error);
    return [];
  }
};

export const updateUserProfileSdk = async (userId: string, updates: Partial<UserProfile>): Promise<void> => {
  try {
    if (!db) {
      db = await initializeFirebaseAdmin();
    }
    await db.collection('users').doc(userId).update(updates);
  } catch (error) {
    console.error("Error updating user profile:", error);
    throw error;
  }
};

export const createUserProfileSdk = async (profile: UserProfile): Promise<void> => {
  try {
    if (!db) {
      db = await initializeFirebaseAdmin();
    }
    await db.collection('users').doc(profile.uid).set(profile);
  } catch (error) {
    console.error("Error creating user profile:", error);
    throw error;
  }
};

// Fonctions de gestion des tickets et envois
export const getRecentTicketsForSectors = async (sectors: string[], limit: number): Promise<SapTicket[]> => {
  try {
    if (!db) {
      db = await initializeFirebaseAdmin();
    }
    if (!sectors || sectors.length === 0) {
      console.warn("No sectors provided to getRecentTicketsForSectors");
      return [];
    }

    // Normaliser les secteurs en minuscules
    const normalizedSectors = sectors.map(s => s.toLowerCase());
    console.log("Secteurs normalisés:", normalizedSectors);

    // Vérifier l'existence des collections
    const collections = await db.listCollections();
    const collectionIds = collections.map(col => col.id);
    const existingSectors = normalizedSectors.filter(sector => collectionIds.includes(sector));

    if (existingSectors.length === 0) {
      console.warn("Aucun des secteurs fournis n'existe comme collection");
      return [];
    }

    // Créer une requête pour chaque secteur existant et fusionner les résultats
    const queries = existingSectors.map(sector => 
      db.collection(sector)
        .orderBy('date', 'desc')
        .limit(limit)
        .get()
    );

    const snapshots = await Promise.all(queries);
    const allDocs = snapshots.flatMap(snapshot => snapshot.docs);
    
    // Trier tous les documents par date
    allDocs.sort((a, b) => {
      const dateA = a.data().date?.toDate?.() || a.data().date || a.data().dateCreation?.toDate?.() || a.data().dateCreation;
      const dateB = b.data().date?.toDate?.() || b.data().date || b.data().dateCreation?.toDate?.() || b.data().dateCreation;
      return dateB.getTime() - dateA.getTime();
    });

    // Prendre les 'limit' premiers résultats
    const limitedDocs = allDocs.slice(0, limit);

    // Convertir en SapTicket[]
    return limitedDocs.map(doc => {
      const data = doc.data();
      console.log(`Document ${doc.id} - secteur: ${data.secteur}`);
      return {
        id: doc.id,
        date: data.dateCreation?.toDate?.() || data.dateCreation,
        client: data.nomClient || '',
        description: data.description || '',
        statut: data.statutExpedition || '',
        secteur: data.secteur || '',
        ...data
      } as SapTicket;
    });
  } catch (error) {
    console.error("Error fetching recent shipments:", error);
    return [];
  }
};

export const getTotalTicketCountSdk = async (sectors: string[]): Promise<number> => {
  try {
    if (!db) {
      db = await initializeFirebaseAdmin();
    }
    if (!sectors || sectors.length === 0) {
      return 0;
    }

    // Vérifier l'existence des collections
    const collections = await db.listCollections();
    const collectionIds = collections.map(col => col.id);
    const existingSectors = sectors.filter(sector => collectionIds.includes(sector));

    if (existingSectors.length === 0) {
      return 0;
    }

    // Compter les documents dans chaque collection de secteur
    const countPromises = existingSectors.map(sector => 
      db.collection(sector).count().get()
    );

    const snapshots = await Promise.all(countPromises);
    const total = snapshots.reduce((sum, snap) => sum + snap.data().count, 0);
    
    return total;
  } catch (error) {
    console.error("Error getting total ticket count:", error);
    return 0;
  }
};

export const getDistinctClientCountFromEnvoiSdk = async (userProfile: UserProfile): Promise<number> => {
  try {
    if (!db) {
      db = await initializeFirebaseAdmin();
    }
    const snapshot = await db.collection('Envoi')
      .where('secteur', 'in', userProfile.secteurs)
      .get();
    const uniqueClients = new Set(snapshot.docs.map(doc => doc.data().codeClient));
    return uniqueClients.size;
  } catch (error) {
    console.error("Error getting distinct client count:", error);
    return 0;
  }
};

export const getLatestStatsSnapshotsSdk = async (limit: number): Promise<StatsSnapshot[]> => {
  try {
    if (!db) {
      db = await initializeFirebaseAdmin();
    }
    const snapshot = await db.collection('statsSnapshots')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    return snapshot.docs.map(doc => doc.data() as StatsSnapshot);
  } catch (error) {
    console.error("Error getting latest stats snapshots:", error);
    return [];
  }
};


// --- Installation Functions ---

/**
 * Get installations for a specific sector, optionally filtered by user's allowed sectors.
 */
export const getInstallationsBySector = async (
  sector: string,
  userSectors?: string[],
  isAdmin?: boolean,
  filters?: InstallationFilters
): Promise<Installation[]> => {
  try {
    if (!db) {
      db = await initializeFirebaseAdmin();
    }
    let query: admin.firestore.Query = installationsCollection.where('secteur', '==', sector);

    // Appliquer les filtres supplémentaires
    if (filters?.status) {
      query = query.where('status', '==', filters.status);
    }
    if (filters?.commercial) {
      query = query.where('commercial', '==', filters.commercial);
    }
    if (filters?.ville) {
      query = query.where('ville', '>=', filters.ville).where('ville', '<=', filters.ville + '\uf8ff');
    }
    if (filters?.dateRange) {
      query = query.where('createdAt', '>=', filters.dateRange.start)
                   .where('createdAt', '<=', filters.dateRange.end);
    }

    const snapshot = await query.orderBy('nom', 'asc').get();
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        // Convertir explicitement les dates
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : 
                 data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000) : 
                 new Date(),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : 
                 data.updatedAt?.seconds ? new Date(data.updatedAt.seconds * 1000) : 
                 new Date(),
        dateCdeMateriel: data.dateCdeMateriel?.toDate ? data.dateCdeMateriel.toDate() : 
                       data.dateCdeMateriel?.seconds ? new Date(data.dateCdeMateriel.seconds * 1000) : 
                       data.dateCdeMateriel,
        dateInstall: data.dateInstall?.toDate ? data.dateInstall.toDate() : 
                    data.dateInstall?.seconds ? new Date(data.dateInstall.seconds * 1000) : 
                    data.dateInstall
      } as Installation;
    });
  } catch (error) {
    console.error(`Error fetching installations for sector ${sector}:`, error);
    return [];
  }
};


/**
 * Add a new installation document to Firestore.
 * Expects data conforming to Installation type, excluding auto-generated fields.
 */
export const addInstallation = async (
  installationData: Omit<Installation, 'id' | 'createdAt' | 'updatedAt'>
): Promise<admin.firestore.DocumentReference> => {
  try {
    if (!db) {
      db = await initializeFirebaseAdmin();
    }
    const dataWithTimestamps = {
      ...installationData,
      // Ensure required fields have defaults if not provided
      status: installationData.status || 'rendez-vous à prendre', // Default status
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    const docRef = await installationsCollection.add(dataWithTimestamps);
    console.log(`Added installation with ID: ${docRef.id}`);
    return docRef;
  } catch (error) {
    console.error("Error adding installation:", error);
    throw error; // Re-throw to handle upstream
  }
};

/**
 * Update an existing installation document.
 */
export const updateInstallation = async (
  id: string,
  updates: Partial<Omit<Installation, 'id' | 'createdAt'>> // Exclude non-updatable fields
): Promise<void> => {
  try {
    if (!db) {
      db = await initializeFirebaseAdmin();
    }
    if (Object.keys(updates).length === 0) {
      console.warn(`Attempted to update installation ${id} with no changes.`);
      return;
    }
    const dataWithTimestamp = {
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
    };
    await installationsCollection.doc(id).update(dataWithTimestamp);
    console.log(`Updated installation ${id}`);
  } catch (error) {
    console.error(`Error updating installation ${id}:`, error);
    throw error; // Re-throw to handle upstream
  }
};

/**
 * Get a specific installation by its Firestore document ID.
 */
export const getInstallationById = async (id: string): Promise<Installation | null> => {
  try {
    if (!db) {
      db = await initializeFirebaseAdmin();
    }
    const doc = await installationsCollection.doc(id).get();
    if (!doc.exists) {
      console.log(`Installation with ID ${id} not found.`);
      return null;
    }
    return { id: doc.id, ...doc.data() } as Installation;
  } catch (error) {
    console.error(`Error fetching installation ${id}:`, error);
    return null; // Return null on error
  }
};


// --- Refactored Snapshot Function ---

export interface InstallationStats {
  total: number;
  enAttente: number;
  planifiees: number;
  terminees: number;
}

export interface InstallationsSnapshot {
  haccp: InstallationStats;
  chr: InstallationStats;
  tabac: InstallationStats;
  kezia: InstallationStats;
}

export const getInstallationsSnapshot = async (userProfile: UserProfile): Promise<InstallationsSnapshot> => {
  const defaultStats: InstallationStats = {
    total: 0,
    enAttente: 0, // Corresponds to 'rendez-vous à prendre'
    planifiees: 0, // Corresponds to 'rendez-vous pris'
    terminees: 0   // Corresponds to 'installation terminée'
  };

  // Initialize snapshot with all potential sectors
  const snapshotResult: InstallationsSnapshot = {
    haccp: { ...defaultStats },
    chr: { ...defaultStats },
    tabac: { ...defaultStats },
    kezia: { ...defaultStats }
  };

  try {
    if (!db) {
      db = await initializeFirebaseAdmin();
    }
    const userSectors = userProfile?.secteurs || [];
    const isAdmin = userProfile?.role === 'Admin';
    // Determine which sectors to query based on user role
    const sectorsToQuery = isAdmin ? ['haccp', 'chr', 'tabac', 'kezia'] : userSectors;

    if (sectorsToQuery.length === 0 && !isAdmin) {
      console.log("No sectors assigned to non-admin user:", userProfile.uid);
      return snapshotResult; // Return default if user has no sectors and is not admin
    }

    // Build the query on the single 'installations' collection
    let query: admin.firestore.Query = installationsCollection;

    // Filter by relevant sectors for non-admins
    // Handle Firestore 'in' query limitation (max 30 values currently)
    if (!isAdmin) {
        if (sectorsToQuery.length > 30) {
            console.warn(`Firestore 'in' query limited to 30 sectors. User ${userProfile.uid} has ${sectorsToQuery.length}. Querying first 30.`);
            query = query.where('secteur', 'in', sectorsToQuery.slice(0, 30));
        } else {
            query = query.where('secteur', 'in', sectorsToQuery);
        }
    }
     // For admins, no 'secteur' filter is applied, querying all documents across all sectors.

    const docsSnapshot = await query.get();

    // Process the results
    docsSnapshot.forEach(doc => {
      // Use 'as Installation' carefully, ensure data structure matches
      const data = doc.data() as Partial<Installation>; // Use Partial for safety
      const secteur = data.secteur as keyof InstallationsSnapshot | undefined; // Get the sector, could be undefined
      const status = data.status as InstallationStatus | undefined; // Get the status, could be undefined

      // Ensure the sector exists in our snapshot structure and is valid
      if (secteur && snapshotResult[secteur]) {
        snapshotResult[secteur].total++;

        // Increment based on the status field
        switch (status) {
          case 'rendez-vous à prendre':
            snapshotResult[secteur].enAttente++;
            break;
          case 'rendez-vous pris':
            snapshotResult[secteur].planifiees++;
            break;
          case 'installation terminée':
            snapshotResult[secteur].terminees++;
            break;
          default:
            // Log unexpected status for debugging
            console.warn(`Unexpected or missing installation status found: '${status}' for doc ${doc.id} in sector ${secteur}`);
            // Optionally count as 'enAttente' or a separate 'unknown' category if needed
            // snapshotResult[secteur].enAttente++; // Example: Treat unknown as 'enAttente'
            break;
        }
      } else {
         // Log documents with missing or unexpected sectors
         console.warn(`Document ${doc.id} has an unexpected or missing sector: '${secteur}'`);
      }
    });

    return snapshotResult;

  } catch (error) {
    console.error("Erreur lors de la récupération du snapshot des installations:", error);
    // Return the partially filled or default snapshot in case of error
    return snapshotResult;
  }
};

export const updateSAPTICKET = async (
  sector: string,
  ticketId: string, 
  updates: Partial<SapTicket>
): Promise<void> => {
  try {
    if (!db) {
      db = await initializeFirebaseAdmin();
    }
    if (Object.keys(updates).length === 0) {
      console.warn(`Tentative de mise à jour du ticket SAP ${ticketId} sans modifications`);
      return;
    }

    const dataWithTimestamp = {
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = db.collection(sector).doc(ticketId);
    await docRef.update(dataWithTimestamp);
    console.log(`Ticket SAP ${ticketId} mis à jour dans le secteur ${sector}`);
  } catch (error) {
    console.error(`Error updating SAP ticket ${ticketId}:`, error);
    throw error;
  }
};

// Fonctions de recherche d'articles
// Nouvelle signature : accepte { code, nom }
export const searchArticles = async (
  params: { code?: string; nom?: string },
  tags?: string[]
): Promise<Article[]> => {
  try {
    if (!db) {
      db = await initializeFirebaseAdmin();
    }
    let query: FirebaseFirestore.Query = db.collection('articles');
    if (tags?.length) {
      query = query.where('tags', 'array-contains', tags[0]);
    }
    const snapshot = await query.limit(1000).get();
    const articles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Article[];
    const code = (params.code || '').trim().toLowerCase();
    const nom = (params.nom || '').trim().toLowerCase();
    let filtered = articles;
    if (code) {
      filtered = filtered.filter(a =>
        typeof a.Code === 'string' && a.Code.toLowerCase().includes(code)
      );
    }
    if (nom) {
      filtered = filtered.filter(a =>
        typeof a.Désignation === 'string' && a.Désignation.toLowerCase().includes(nom)
      );
    }
    console.log('[searchArticles] Articles récupérés:', articles.length, '| code:', code, '| nom:', nom);
    console.log('[searchArticles] Articles après filtrage:', filtered.length);
    return filtered;
  } catch (error) {
    console.error("Erreur lors de la recherche d'articles :", error);
    return [];
  }
};

// Fonctions de cache géographique
export const getGeocodeFromCache = async (address: string): Promise<{ lat: number, lng: number } | null> => {
  try {
    if (!db) {
      db = await initializeFirebaseAdmin();
    }
    const doc = await db.collection('geocodes').doc(address).get();
    return doc.exists ? doc.data()?.coordinates : null;
  } catch (error) {
    console.error("Erreur de récupération du cache géo:", error);
    return null;
  }
};

export const setGeocodeToCache = async (address: string, coordinates: { lat: number, lng: number }): Promise<void> => {
  try {
    if (!db) {
      db = await initializeFirebaseAdmin();
    }
    await db.collection('geocodes').doc(address).set({
      coordinates,
      timestamp: FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error("Erreur de mise en cache géo:", error);
  }
};

// Ajout de la fonction pour stocker les URLs d'images d'articles
export const addArticleImageUrl = async (
  articleId: string,
  imageUrl: string
): Promise<void> => {
  try {
    if (!db) {
      db = await initializeFirebaseAdmin();
    }
    await db.collection('articles').doc(articleId).update({
      imageUrls: FieldValue.arrayUnion(imageUrl),
      updatedAt: FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error(`Erreur lors de l'ajout de l'URL d'image à l'article ${articleId}:`, error);
    throw error;
  }
};

export const deleteArticleImageUrl = async (
  articleId: string,
  imageUrl: string
): Promise<void> => {
  try {
    if (!db) {
      db = await initializeFirebaseAdmin();
    }
    await db.collection('articles').doc(articleId).update({
      imageUrls: FieldValue.arrayRemove(imageUrl),
      updatedAt: FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error(`Erreur lors de la suppression de l'URL d'image de l'article ${articleId}:`, error);
    throw error;
  }
};

// Function to get all tickets for multiple sectors without limit
export const getAllTicketsForSectorsSdk = async (sectors: string[]): Promise<SapTicket[]> => {
  try {
    if (!db) {
      db = await initializeFirebaseAdmin();
    }
    if (!sectors || sectors.length === 0) {
      console.warn("Aucun secteur fourni pour getAllTicketsForSectorsSdk");
      return [];
    }
    
    // Vérifier l'existence des collections
    const collections = await db.listCollections();
    const collectionIds = collections.map(col => col.id);
    
    // Filtrer les secteurs qui existent comme collections
    const existingSectors = sectors.filter(sector => collectionIds.includes(sector));
    
    if (existingSectors.length === 0) {
      console.warn("Aucun des secteurs fournis n'existe comme collection dans Firestore");
      return [];
    }

    // Créer une requête pour chaque secteur existant
    const queries = existingSectors.map(sector => {
      return db.collection(sector)
        .orderBy('date', 'desc')  // Utiliser 'date' au lieu de 'dateCreation'
        .get();
    });

    // Exécuter toutes les requêtes en parallèle
    const snapshots = await Promise.all(queries);
    
    // Fusionner et trier les résultats
    const allDocs = snapshots.flatMap((snapshot, index) => {
      const sectorName = existingSectors[index];
      return snapshot.docs;
    });

    const tickets = allDocs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        date: data.date?.toDate?.() || data.date,
        client: data.nomClient || '',
        raisonSociale: data.raisonSociale || data.nomClient || '',
        description: data.description || '',
        statut: data.statutExpedition || '',
        secteur: data.secteur || doc.ref.parent.id,
        ...data
      } as SapTicket;
    });

    return tickets;
  } catch (error) {
    console.error("Error fetching all tickets:", error);
    throw error;
  }
};

/**
 * Delete a shipment document from Firestore
 * @param shipmentId The ID of the shipment to delete
 */
export const deleteShipmentSdk = async (shipmentId: string): Promise<void> => {
  try {
    if (!db) {
      db = await initializeFirebaseAdmin();
    }
    await db.collection('Envoi').doc(shipmentId).delete();
    console.log(`Deleted shipment ${shipmentId}`);
  } catch (error) {
    console.error(`Error deleting shipment ${shipmentId}:`, error);
    throw error;
  }
};

export const deleteInstallation = async (installationId: string): Promise<void> => {
  try {
    if (!db) {
      db = await initializeFirebaseAdmin();
    }
    await installationsCollection.doc(installationId).delete();
    console.log(`Deleted installation ${installationId}`);
  } catch (error) {
    console.error(`Error deleting installation ${installationId}:`, error);
    throw new Error(`Échec de la suppression : ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
  }
};

export const bulkUpdateInstallations = async (
  ids: string[], 
  updates: Partial<Installation>
): Promise<void> => {
  try {
    if (!db) {
      db = await initializeFirebaseAdmin();
    }
    const batch = db.batch();
    
    ids.forEach(id => {
      const docRef = installationsCollection.doc(id);
      batch.update(docRef, {
        ...updates,
        updatedAt: FieldValue.serverTimestamp()
      });
    });

    await batch.commit();
    console.log(`Mise à jour batch réussie pour ${ids.length} installations`);
  } catch (error) {
    console.error('Erreur lors de la mise à jour batch:', error);
    throw new Error(`Échec de la mise à jour multiple : ${error instanceof Error ? error.message : 'Erreur système'}`);
  }
};

/**
 * Get all shipments for multiple sectors without limit
 * @param sectors Array of sector IDs to get shipments for
 */
export const getAllShipments = async (sectors: string[]): Promise<Shipment[]> => {
  try {
    if (!db) {
      db = await initializeFirebaseAdmin();
    }
    if (!sectors || sectors.length === 0) {
      console.warn("No sectors provided to getAllShipments");
      return [];
    }

    // Normaliser les secteurs
    const normalizedSectors = sectors.map(s => s.toLowerCase());
    
    const query = db.collection('Envoi')
      .where('secteur', 'in', normalizedSectors)
      .orderBy('date', 'desc');

    const snapshot = await query.get();
    
    const shipments = snapshot.docs.map(doc => {
      const data = doc.data();
      
      // Gestion robuste des dates
      let dateCreation: Date | null = null;
      const rawDate = data.date || data.dateCreation;
      
      if (rawDate?.toDate) {
        dateCreation = rawDate.toDate();
      } else if (rawDate?.seconds) {
        dateCreation = new Date(rawDate.seconds * 1000);
      } else if (typeof rawDate === 'string') {
        dateCreation = new Date(rawDate);
      } else if (rawDate instanceof Date) {
        dateCreation = rawDate;
      }

      return { 
        ...data,
        id: doc.id,
        dateCreation: dateCreation || new Date(),
        secteur: data.secteur || normalizedSectors.find(s => data.secteur?.toLowerCase()?.includes(s)) || 'Non défini',
        nomClient: data.nomClient || data.client || 'Client Inconnu',
        codeClient: data.codeClient || '',
        statutExpedition: data.statutExpedition || data.statut || 'NON',
      } as Shipment;
    });

    return shipments.filter(s => s !== null);
  } catch (error) {
    console.error("Error fetching all shipments:", error);
    return [];
  }
};

/**
 * Upload une image vers Cloudinary et retourne l'URL de l'image.
 * @param fileBuffer Buffer du fichier image
 * @param fileName Nom du fichier (optionnel)
 * @returns URL de l'image Cloudinary
 */
export async function uploadImageToCloudinary(fileBuffer: Buffer, fileName?: string): Promise<string> {
  const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'dkeqzl54y';
  const CLOUDINARY_UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET || 'jdc-img';
  const CLOUDINARY_API_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

  const formData = new FormData();
  formData.append('file', fileBuffer, { filename: fileName || 'image.jpg' });
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const response = await fetch(CLOUDINARY_API_URL, {
    method: 'POST',
    body: formData as any,
    headers: formData.getHeaders(),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `Échec de l'upload Cloudinary (HTTP ${response.status})`);
  }
  const data = await response.json();
  return data.secure_url;
}

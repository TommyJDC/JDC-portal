import { dbAdmin as db } from "~/firebase.admin.config.server";
import type { 
  UserProfile, 
  SapTicket, 
  Shipment, 
  StatsSnapshot, 
  Installation, 
  InstallationStatus,
  InstallationFilters 
} from "~/types/firestore.types";
import type * as admin from 'firebase-admin'; // Importer les types admin
import { FieldValue } from 'firebase-admin/firestore'; // Added FieldValue

// Collection Reference for Installations
const installationsCollection = db.collection('installations');

// Fonctions de gestion des utilisateurs
export const getUserProfileSdk = async (userId: string): Promise<UserProfile | null> => {
  try {
    const doc = await db.collection('users').doc(userId).get();
    return doc.exists ? (doc.data() as UserProfile) : null;
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
};

export const getAllUserProfilesSdk = async (): Promise<UserProfile[]> => {
  try {
    const snapshot = await db.collection('users').get();
    return snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile));
  } catch (error) {
    console.error("Error fetching all user profiles:", error);
    return [];
  }
};

export const updateUserProfileSdk = async (userId: string, updates: Partial<UserProfile>): Promise<void> => {
  try {
    await db.collection('users').doc(userId).update(updates);
  } catch (error) {
    console.error("Error updating user profile:", error);
    throw error;
  }
};

export const createUserProfileSdk = async (profile: UserProfile): Promise<void> => {
  try {
    await db.collection('users').doc(profile.uid).set(profile);
  } catch (error) {
    console.error("Error creating user profile:", error);
    throw error;
  }
};

// Fonctions de gestion des tickets et envois
export const getRecentTicketsForSectors = async (sectors: string[], limit: number): Promise<SapTicket[]> => {
  try {
    const query = db.collection('tickets')
      .where('sector', 'in', sectors)
      .orderBy('date', 'desc')
      .limit(limit);
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as SapTicket));
  } catch (error) {
    console.error("Error fetching recent tickets:", error);
    return [];
  }
};

export const getRecentShipmentsForSectors = async (sectors: string[], limit: number): Promise<Shipment[]> => {
  try {
    // Handle empty sectors array case
    if (!sectors || sectors.length === 0) {
      console.warn("No sectors provided to getRecentShipmentsForSectors");
      return [];
    }

    const query = db.collection('shipments')
      .where('sector', 'in', sectors)
      .orderBy('dateCreation', 'desc')
      .limit(limit);
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Shipment));
  } catch (error) {
    console.error("Error fetching recent shipments:", error);
    return [];
  }
};

export const getTotalTicketCountSdk = async (sectors: string[]): Promise<number> => {
  try {
    const snapshot = await db.collection('tickets')
      .where('sector', 'in', sectors)
      .count()
      .get();
    return snapshot.data().count;
  } catch (error) {
    console.error("Error getting total ticket count:", error);
    return 0;
  }
};

export const getDistinctClientCountFromEnvoiSdk = async (userProfile: UserProfile): Promise<number> => {
  try {
    const snapshot = await db.collection('shipments')
      .where('sector', 'in', userProfile.secteurs)
      .get();
    const uniqueClients = new Set(snapshot.docs.map(doc => doc.data().clientId));
    return uniqueClients.size;
  } catch (error) {
    console.error("Error getting distinct client count:", error);
    return 0;
  }
};

export const getLatestStatsSnapshotsSdk = async (limit: number): Promise<StatsSnapshot[]> => {
  try {
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
    console.log(`Installations Snapshot Query: Found ${docsSnapshot.size} documents for sectors [${sectorsToQuery.join(', ')}] (or all for admin).`);

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

    console.log("Installations Snapshot Result:", JSON.stringify(snapshotResult, null, 2));
    return snapshotResult;

  } catch (error) {
    console.error("Erreur lors de la récupération du snapshot des installations:", error);
    // Return the partially filled or default snapshot in case of error
    return snapshotResult;
  }
};

export const updateSAPTICKET = async (
  sectorId: string,
  ticketId: string,
  updates: Partial<SapTicket>
): Promise<void> => {
  try {
    if (Object.keys(updates).length === 0) {
      console.warn(`Attempted to update SAP ticket ${ticketId} with no changes.`);
      return;
    }

    const dataWithTimestamp = {
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = db.collection('tickets-sap').doc(ticketId);
    await docRef.update(dataWithTimestamp);
    console.log(`Updated SAP ticket ${ticketId} in sector ${sectorId}`);
  } catch (error) {
    console.error(`Error updating SAP ticket ${ticketId}:`, error);
    throw error;
  }
};

// Fonctions de recherche d'articles
export const searchArticles = async (searchTerm: string, tags?: string[]): Promise<any[]> => {
  try {
    let query = db.collection('articles')
      .where('title', '>=', searchTerm)
      .where('title', '<=', searchTerm + '\uf8ff');

    if (tags?.length) {
      query = query.where('tags', 'array-contains', tags[0]);
    }

    const snapshot = await query.limit(25).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Erreur lors de la recherche d'articles :", error);
    return [];
  }
};

// Fonctions de cache géographique
export const getGeocodeFromCache = async (address: string): Promise<{ lat: number, lng: number } | null> => {
  try {
    const doc = await db.collection('geocodes').doc(address).get();
    return doc.exists ? doc.data()?.coordinates : null;
  } catch (error) {
    console.error("Erreur de récupération du cache géo:", error);
    return null;
  }
};

export const setGeocodeToCache = async (address: string, coordinates: { lat: number, lng: number }): Promise<void> => {
  try {
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
    if (!sectors || sectors.length === 0) {
      console.warn("No sectors provided to getAllTicketsForSectorsSdk");
      return [];
    }

    const query = db.collection('tickets-sap')
      .where('secteur', 'in', sectors)
      .orderBy('date', 'desc');

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ 
      ...doc.data(), 
      id: doc.id,
      // Ensure dates are properly handled
      date: doc.data().date?.toDate?.() || doc.data().date
    } as SapTicket));
  } catch (error) {
    console.error("Error fetching all tickets:", error);
    return [];
  }
};

/**
 * Delete a shipment document from Firestore
 * @param shipmentId The ID of the shipment to delete
 */
export const deleteShipmentSdk = async (shipmentId: string): Promise<void> => {
  try {
    await db.collection('shipments').doc(shipmentId).delete();
    console.log(`Deleted shipment ${shipmentId}`);
  } catch (error) {
    console.error(`Error deleting shipment ${shipmentId}:`, error);
    throw error;
  }
};

export const deleteInstallation = async (installationId: string): Promise<void> => {
  try {
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
    if (!sectors || sectors.length === 0) {
      console.warn("No sectors provided to getAllShipments");
      return [];
    }

    const query = db.collection('shipments')
      .where('sector', 'in', sectors)
      .orderBy('dateCreation', 'desc');

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ 
      ...doc.data(), 
      id: doc.id,
      // Ensure dates are properly handled
      dateCreation: doc.data().dateCreation?.toDate?.() || doc.data().dateCreation
    } as Shipment));
  } catch (error) {
    console.error("Error fetching all shipments:", error);
    return [];
  }
};

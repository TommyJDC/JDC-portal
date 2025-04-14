// Import Timestamp and FieldValue directly if needed, but dbAdmin comes from config
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
// Import types remain the same
import type { UserProfile, SapTicket, Shipment, GeocodeCacheEntry, StatsSnapshot, Article } from '~/types/firestore.types';
import { parseFrenchDate } from '~/utils/dateUtils';
// Import the initialized admin db instance
import { dbAdmin } from '~/firebase.admin.config.server'; // Import the configured instance
import type * as admin from 'firebase-admin'; // Import admin types if needed elsewhere


// --- Helper for Status Correction (remains the same, uses data object) ---
const correctTicketStatus = (ticketData: admin.firestore.DocumentData): { correctedStatus: string | null, needsUpdate: boolean } => {
  let currentStatus = ticketData.statut;
  const demandeSAPLower = ticketData.demandeSAP?.toLowerCase() ?? '';
  const needsRmaStatus = demandeSAPLower.includes('demande de rma');
  const isNotRmaStatus = currentStatus !== 'Demande de RMA';

  let correctedStatus: string | null = currentStatus;
  let needsUpdate = false;

  if (needsRmaStatus && isNotRmaStatus) {
    correctedStatus = 'Demande de RMA';
    needsUpdate = true;
  } else if (!currentStatus && !needsRmaStatus) {
    correctedStatus = 'Nouveau';
    needsUpdate = true;
  }

  return { correctedStatus: correctedStatus ?? null, needsUpdate };
};


// --- User Profile Functions (Using Admin SDK) ---

/**
 * Gets a user profile using the Admin SDK.
 * Assumes the passed `id` is the document ID in the 'users' collection
 * (could be Firebase UID or Google ID depending on how it's called).
 */
export const getUserProfileSdk = async (id: string): Promise<UserProfile | null> => {
  if (!id) return null;
  console.log(`[FirestoreService Admin] Getting profile for ID: ${id}`);
  try {
    const userDocRef = dbAdmin.collection('users').doc(id);
    const userDocSnap = await userDocRef.get();
    if (userDocSnap.exists) {
      const data = userDocSnap.data() as any; // Cast to any temporarily
      // Convert Timestamps to Dates before returning
      const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined;
      const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined;
      return {
          uid: id,
          email: data.email,
          displayName: data.displayName,
          role: data.role,
          secteurs: data.secteurs,
          createdAt: createdAt,
          updatedAt: updatedAt,
       } as UserProfile;
    } else {
      console.log(`[FirestoreService Admin] No profile found for ID: ${id}`);
      throw new Error(`User profile not found for ID: ${id}`);
    }
  } catch (error: any) {
    console.error(`[FirestoreService Admin] Error fetching user profile for ID ${id}:`, error);
    if (error.message?.includes("not found")) {
        throw error;
    }
    throw new Error(`Impossible de récupérer le profil utilisateur (ID: ${id}). Cause: ${error.message || error}`);
  }
};

/**
 * Creates a user profile using the Admin SDK.
 * Uses the passed `id` (Firebase UID or Google ID) as the document ID.
 */
export const createUserProfileSdk = async (
  id: string,
  email: string,
  displayName: string,
  initialRole: string = 'Technician'
): Promise<UserProfile> => {
  if (!id || !email || !displayName) {
    throw new Error("ID, email, and display name are required to create a profile.");
  }
  console.log(`[FirestoreService Admin] Creating profile for ID: ${id}, Email: ${email}`);
  try {
    const userDocRef = dbAdmin.collection('users').doc(id);
    const docSnap = await userDocRef.get();
    if (docSnap.exists) {
        console.warn(`[FirestoreService Admin] Profile already exists for ID: ${id}. Overwriting.`);
    }

    // Define the data to set, excluding fields handled by FieldValue or the uid itself
    const newUserProfileDataBase: Omit<UserProfile, 'uid' | 'createdAt' | 'updatedAt'> = {
      email,
      displayName,
      role: initialRole,
      secteurs: [],
    };

    // Add the server timestamp during the set operation
    await userDocRef.set({
        ...newUserProfileDataBase,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(), // Also set updatedAt on creation
    });
    console.log(`[FirestoreService Admin] User profile created/updated successfully for ID: ${id}`);

    // Return the known data immediately. Timestamps will be populated on next read.
    // Cast to UserProfile, acknowledging timestamps might be FieldValue initially server-side.
    return { uid: id, ...newUserProfileDataBase } as UserProfile;

  } catch (error: any) {
    console.error(`[FirestoreService Admin] Error creating user profile for ID ${id}:`, error);
     if (error.code === 7 || error.code === 'PERMISSION_DENIED') {
        console.error("[FirestoreService Admin] CRITICAL: Firestore permission denied during profile creation. Check service account permissions and Firestore rules.");
        throw new Error("Permission refusée par Firestore lors de la création du profil.");
    }
    throw new Error(`Impossible de créer le profil utilisateur (ID: ${id}). Cause: ${error.message || error}`);
  }
};

/**
 * Updates a user profile using the Admin SDK.
 */
export const updateUserProfileSdk = async (uid: string, data: Partial<Omit<UserProfile, 'uid' | 'createdAt' | 'updatedAt'>>): Promise<void> => {
  if (!uid || !data || Object.keys(data).length === 0) {
    console.warn("[FirestoreService Admin] Update user profile called with invalid UID or empty data.");
    return;
  }
  console.log(`[FirestoreService Admin] Updating profile for UID: ${uid}`);
  try {
    const userDocRef = dbAdmin.collection('users').doc(uid);
    // Add updatedAt timestamp
    const updateData = { ...data, updatedAt: FieldValue.serverTimestamp() };
    await userDocRef.update(updateData);
    console.log(`[FirestoreService Admin] User profile updated successfully for UID: ${uid}`);
  } catch (error: any) {
    console.error(`[FirestoreService Admin] Error updating user profile for UID ${uid}:`, error);
     if (error.code === 7 || error.code === 'PERMISSION_DENIED') {
        console.error("[FirestoreService Admin] CRITICAL: Firestore permission denied during profile update.");
        throw new Error("Permission refusée par Firestore lors de la mise à jour du profil.");
    }
    throw new Error(`Impossible de mettre à jour le profil utilisateur (UID: ${uid}). Cause: ${error.message || error}`);
  }
};

/**
 * Gets all user profiles using the Admin SDK.
 */
export const getAllUserProfilesSdk = async (): Promise<UserProfile[]> => {
  console.log("[FirestoreService Admin] Fetching all user profiles...");
  try {
    const usersCollectionRef = dbAdmin.collection('users');
    const q = usersCollectionRef.orderBy('email');
    const querySnapshot = await q.get();
    const profiles = querySnapshot.docs.map((doc) => {
        const data = doc.data() as any;
        const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined;
        const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : undefined;
        return {
            uid: doc.id,
            email: data.email,
            displayName: data.displayName,
            role: data.role,
            secteurs: data.secteurs,
            createdAt: createdAt,
            updatedAt: updatedAt,
        } as UserProfile
    });
    console.log(`[FirestoreService Admin] Fetched ${profiles.length} profiles.`);
    return profiles;
  } catch (error: any) {
    console.error("[FirestoreService Admin] Error fetching all user profiles:", error);
    throw new Error(`Impossible de récupérer la liste des utilisateurs. Cause: ${error.message || error}`);
  }
};


// --- Article Image Functions (Using Admin SDK) ---

export const addArticleImageUrl = async (articleId: string, imageUrl: string): Promise<void> => {
  if (!articleId || !imageUrl) {
    throw new Error("Article ID and image URL are required.");
  }
  console.log(`[FirestoreService Admin] Adding image URL to article ${articleId}...`);
  try {
    const articleDocRef = dbAdmin.collection('articles').doc(articleId);
    await articleDocRef.update({
      imageUrls: FieldValue.arrayUnion(imageUrl)
    });
    console.log(`[FirestoreService Admin] Image URL successfully added to article ${articleId}.`);
  } catch (error: any) {
    console.error(`[FirestoreService Admin] Error adding image URL to article ${articleId}:`, error);
     if (error.code === 7 || error.code === 'PERMISSION_DENIED') {
        throw new Error("Permission refusée pour mettre à jour l'article.");
    } else if (error.code === 5 || error.code === 'NOT_FOUND') {
        throw new Error(`L'article avec l'ID ${articleId} n'a pas été trouvé.`);
    }
    throw new Error(`Impossible d'ajouter l'URL de l'image à l'article : ${error.message || error.code}`);
  }
};

export const deleteArticleImageUrl = async (articleId: string, imageUrl: string): Promise<void> => {
  if (!articleId || !imageUrl) {
    throw new Error("Article ID and image URL are required for deletion.");
  }
  console.log(`[FirestoreService Admin] Removing image URL from article ${articleId}...`);
  try {
    const articleDocRef = dbAdmin.collection('articles').doc(articleId);
    await articleDocRef.update({
      imageUrls: FieldValue.arrayRemove(imageUrl)
    });
    console.log(`[FirestoreService Admin] Image URL successfully removed from article ${articleId}.`);
  } catch (error: any) {
    console.error(`[FirestoreService Admin] Error removing image URL from article ${articleId}:`, error);
     if (error.code === 7 || error.code === 'PERMISSION_DENIED') {
        throw new Error("Permission refusée pour mettre à jour l'article.");
    } else if (error.code === 5 || error.code === 'NOT_FOUND') {
        throw new Error(`L'article avec l'ID ${articleId} n'a pas été trouvé.`);
    }
    throw new Error(`Impossible de supprimer l'URL de l'image de l'article : ${error.message || error.code}`);
  }
};


// --- Article Search Functions (Using Admin SDK) ---

export const searchArticles = async (criteria: { code?: string; nom?: string }): Promise<Article[]> => {
  const { code, nom } = criteria;
  const trimmedCode = code?.trim();
  const trimmedNom = nom?.trim();
  const nomUppercase = trimmedNom?.toUpperCase();

  console.log(`[FirestoreService Admin] Searching articles with criteria:`, { code: trimmedCode, nom: trimmedNom });

  if (!trimmedCode && !trimmedNom) {
    console.log("[FirestoreService Admin] No search criteria provided for articles.");
    return [];
  }

  const articlesCollection = dbAdmin.collection('articles');
  const resultsMap = new Map<string, Article>();

  try {
    if (trimmedCode) {
      const codeQuery = articlesCollection.where("Code", "==", trimmedCode);
      console.log(`[FirestoreService Admin] Executing Code exact match query for: "${trimmedCode}"`);
      const codeSnapshot = await codeQuery.get();
      console.log(`[FirestoreService Admin] Code query found ${codeSnapshot.docs.length} matches.`);
      codeSnapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data.Code && data.Désignation) {
          resultsMap.set(docSnap.id, { id: docSnap.id, ...data } as Article);
        } else {
           console.warn(`[FirestoreService Admin] Document ${docSnap.id} matched by Code is missing 'Code' or 'Désignation'.`);
        }
      });
    }

    if (nomUppercase) {
      const endTerm = nomUppercase + '\uf8ff';
      const designationQuery = articlesCollection
        .orderBy("Désignation")
        .startAt(nomUppercase)
        .endAt(endTerm);

      console.log(`[FirestoreService Admin] Executing Désignation prefix query (uppercase) for: "${nomUppercase}"`);
      const designationSnapshot = await designationQuery.get();
      console.log(`[FirestoreService Admin] Désignation query found ${designationSnapshot.docs.length} potential matches.`);

      designationSnapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data.Code && data.Désignation) {
          resultsMap.set(docSnap.id, { id: docSnap.id, ...data } as Article);
        } else {
          console.warn(`[FirestoreService Admin] Document ${docSnap.id} matched by Désignation is missing 'Code' or 'Désignation'.`);
        }
      });
    }

    const combinedResults = Array.from(resultsMap.values());
    console.log(`[FirestoreService Admin] Article search completed. Found ${combinedResults.length} unique articles.`);
    return combinedResults;

  } catch (error: any) {
    console.error("[FirestoreService Admin] Error executing article search:", error);
    if (error.code === 9 || error.code === 'FAILED_PRECONDITION') {
        console.error("[FirestoreService Admin] Firestore Error: Likely missing a composite index. Check the Firestore console error message for a link to create it. You'll likely need an index on 'Désignation' (ascending).");
        throw new Error("Erreur Firestore: Index manquant requis pour la recherche par nom (sur 'Désignation'). Vérifiez la console Firebase.");
    }
    throw new Error(`Échec de la recherche d'articles. Cause: ${error.message || error}`);
  }
};


// --- SAP Ticket Functions (Using Admin SDK) ---

export const updateSAPTICKET = async (sectorId: string, ticketId: string, data: Partial<Omit<SapTicket, 'id' | 'secteur' | 'date'>>): Promise<void> => {
  if (!sectorId || !ticketId || !data || Object.keys(data).length === 0) {
    console.warn("[FirestoreService Admin] updateSAPTICKET called with invalid sectorId, ticketId, or empty data.");
    throw new Error("Identifiants de secteur/ticket ou données de mise à jour manquants.");
  }
  console.log(`[FirestoreService Admin] Attempting to update ticket ${ticketId} in sector ${sectorId} with data:`, data);
  try {
    const ticketDocRef = dbAdmin.collection(sectorId).doc(ticketId);
    // Ensure date is not accidentally overwritten with undefined if not provided
    const updateData = { ...data };
    if ('date' in updateData) delete (updateData as any).date;

    await ticketDocRef.update(updateData);
    console.log(`[FirestoreService Admin] Successfully updated ticket ${ticketId} in sector ${sectorId}.`);
  } catch (error: any) {
    console.error(`[FirestoreService Admin] Error updating ticket ${ticketId} in sector ${sectorId}:`, error);
    if (error.code === 7 || error.code === 'PERMISSION_DENIED') {
      console.error(`[FirestoreService Admin] CRITICAL: Firestore permission denied for update operation on collection '${sectorId}'. Check service account permissions and Firestore rules.`);
      throw new Error(`Permission refusée par Firestore pour la mise à jour dans le secteur ${sectorId}.`);
    } else if (error.code === 5 || error.code === 'NOT_FOUND') {
        console.error(`[FirestoreService Admin] Error: Document ${ticketId} not found in collection ${sectorId}.`);
        throw new Error(`Le ticket ${ticketId} n'a pas été trouvé dans le secteur ${sectorId}.`);
    }
    throw new Error(`Impossible de mettre à jour le ticket SAP ${ticketId}. Cause: ${error.message || error}`);
  }
};

export const getRecentTicketsForSectors = async (sectors: string[], count: number = 5): Promise<SapTicket[]> => {
  if (!sectors || sectors.length === 0) return [];
  console.log(`[FirestoreService Admin] Fetching recent tickets for sectors: ${sectors.join(', ')}`);

  const ticketPromises = sectors.map(async (sector) => {
    try {
      const sectorCollectionRef = dbAdmin.collection(sector);
      const q = sectorCollectionRef.orderBy('date', 'desc').limit(count);
      const querySnapshot = await q.get();
       return querySnapshot.docs.map(doc => {
          const data = doc.data();
          const parsedDate = parseFrenchDate(data.date);
          const { correctedStatus } = correctTicketStatus(data);
          return {
           id: doc.id,
           ...data,
            statut: correctedStatus ?? data.statut,
            secteur: sector,
            date: parsedDate
          } as SapTicket;
       });
    } catch (error: any) {
      console.error(`[FirestoreService Admin] Error fetching tickets for sector ${sector}:`, error);
       if (error.code === 9 || error.code === 'FAILED_PRECONDITION') {
         console.error(`[FirestoreService Admin] Index missing for ticket query in sector ${sector} (likely on 'date' desc).`);
       }
      return [];
    }
  });

  try {
     const resultsBySector = await Promise.all(ticketPromises);
     const allTickets = resultsBySector.flat();
     allTickets.sort((a, b) => {
         if (!(b.date instanceof Date)) return -1;
         if (!(a.date instanceof Date)) return 1;
         return b.date.getTime() - a.date.getTime();
     });
     console.log(`[FirestoreService Admin] Found ${allTickets.length} tickets across sectors, returning top ${count}`);
    return allTickets.slice(0, count);
  } catch (error) {
    console.error("[FirestoreService Admin] Error merging ticket results:", error);
    throw new Error("Impossible de récupérer les tickets récents.");
  }
};

export const getAllTicketsForSectorsSdk = async (sectors: string[]): Promise<SapTicket[]> => {
  if (!sectors || sectors.length === 0) {
    console.log("[FirestoreService Admin] getAllTicketsForSectorsSdk: No sectors provided, returning [].");
    return [];
  }
  console.log(`[FirestoreService Admin] Fetching ALL tickets (one-time) for sectors: ${sectors.join(', ')}`);

  const ticketPromises = sectors.map(async (sector) => {
    try {
      const sectorCollectionRef = dbAdmin.collection(sector);
      const q = sectorCollectionRef.orderBy('date', 'desc');
      const querySnapshot = await q.get();
      console.log(`[FirestoreService Admin] Fetched ${querySnapshot.size} tickets for sector ${sector}.`);
       return querySnapshot.docs.map(doc => {
          const data = doc.data();
          const parsedDate = parseFrenchDate(data.date);
          const { correctedStatus } = correctTicketStatus(data);
          return {
           id: doc.id,
           ...data,
            statut: correctedStatus ?? data.statut,
            secteur: sector,
            date: parsedDate
          } as SapTicket;
       });
    } catch (error: any) {
      console.error(`[FirestoreService Admin] Error fetching ALL tickets for sector ${sector}:`, error);
       if (error.code === 9 || error.code === 'FAILED_PRECONDITION') {
         console.error(`[FirestoreService Admin] Index missing for ticket query in sector ${sector} (likely on 'date' desc).`);
       }
      return [];
    }
  });

  try {
     const resultsBySector = await Promise.all(ticketPromises);
     const allTickets = resultsBySector.flat();
     allTickets.sort((a, b) => {
         if (!(b.date instanceof Date)) return -1;
         if (!(a.date instanceof Date)) return 1;
         return b.date.getTime() - a.date.getTime();
     });
     console.log(`[FirestoreService Admin] Fetched a total of ${allTickets.length} tickets across all specified sectors.`);
    return allTickets;
  } catch (error) {
    console.error("[FirestoreService Admin] Error merging ALL ticket results:", error);
    throw new Error("Impossible de récupérer tous les tickets SAP pour les secteurs spécifiés.");
  }
};

export const getTotalTicketCountSdk = async (sectors: string[]): Promise<number> => {
  if (!sectors || sectors.length === 0) {
      console.log("[FirestoreService Admin] getTotalTicketCountSdk: No sectors provided, returning 0.");
      return 0;
  }
  console.log(`[FirestoreService Admin] Counting total tickets via aggregate for sectors: ${sectors.join(', ')}`);

  const countPromises = sectors.map(async (sector) => {
    try {
      const sectorCollectionRef = dbAdmin.collection(sector);
      const snapshot = await sectorCollectionRef.count().get();
      const count = snapshot.data().count;
      console.log(`[FirestoreService Admin] Counted ${count} docs for sector ${sector}.`);
      return count;
    } catch (error) {
      console.error(`[FirestoreService Admin] Error counting tickets via aggregate for sector ${sector}:`, error);
      return 0;
    }
  });

  try {
    const counts = await Promise.all(countPromises);
    const totalCount = counts.reduce((sum, count) => sum + count, 0);
    console.log(`[FirestoreService Admin] Total ticket count via aggregate across sectors: ${totalCount}`);
    return totalCount;
  } catch (error) {
    console.error("[FirestoreService Admin] Error summing ticket counts from aggregate:", error);
    throw new Error("Impossible de calculer le nombre total de tickets.");
  }
};


// --- Shipment Functions (Using Admin SDK) ---

export const getAllShipments = async (userProfile: UserProfile | null): Promise<Shipment[]> => {
  if (!userProfile) {
    console.log("[FirestoreService Admin][getAllShipments] Cannot fetch shipments, user profile is null.");
    return [];
  }

  console.log(`[FirestoreService Admin][getAllShipments] Fetching shipments for user: ${userProfile.uid}, Role: ${userProfile.role}`);
  const shipmentsCollectionRef = dbAdmin.collection('Envoi');
  let q: admin.firestore.Query<admin.firestore.DocumentData>;

  try {
    const userSectors = userProfile.secteurs ?? [];

    if (userProfile.role === 'Admin') {
        console.log("[FirestoreService Admin][getAllShipments] Admin user. Fetching ALL shipments.");
        q = shipmentsCollectionRef.orderBy('nomClient');
    } else {
      if (userSectors.length === 0) {
        console.log(`[FirestoreService Admin][getAllShipments] Non-admin user ${userProfile.uid} has no assigned sectors. Returning empty list.`);
        return [];
      }
      console.log(`[FirestoreService Admin][getAllShipments] Non-admin user. Querying sectors: ${userSectors.join(', ')}`);
      q = shipmentsCollectionRef
        .where('secteur', 'in', userSectors)
        .orderBy('nomClient');
    }

    console.log("[FirestoreService Admin][getAllShipments] Executing query...");
    const querySnapshot = await q.get();
    console.log(`[FirestoreService Admin][getAllShipments] Query successful. Fetched ${querySnapshot.size} documents.`);

    const shipments = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        const dateCreation = data.dateCreation instanceof Timestamp ? data.dateCreation.toDate() : undefined;
        return { id: doc.id, ...data, dateCreation } as Shipment;
    });
    return shipments;

  } catch (error: any) {
    console.error("[FirestoreService Admin][getAllShipments] Error fetching shipments:", error);
    if (error.code === 7 || error.code === 'PERMISSION_DENIED') {
         console.error("[FirestoreService Admin][getAllShipments] CRITICAL: Firestore permission denied. Check service account permissions and Firestore rules.");
         throw new Error("Permission refusée par Firestore. Vérifiez les règles de sécurité.");
     } else if (error.code === 9 || error.code === 'FAILED_PRECONDITION') {
         console.error("[FirestoreService Admin][getAllShipments] CRITICAL: Firestore query requires an index. Check Firestore console.");
         throw new Error("Index Firestore manquant. Vérifiez la console Firestore.");
     } else {
         throw new Error(`Impossible de récupérer la liste des envois. Cause: ${error.message || error}`);
     }
  }
};

export const getRecentShipmentsForSectors = async (sectors: string[], count: number = 5): Promise<Shipment[]> => {
  const fetchAllSectors = !sectors || sectors.length === 0;

  if (fetchAllSectors) {
    console.log(`[FirestoreService Admin] Fetching ${count} recent shipments across ALL sectors (Admin view).`);
  } else {
    console.log(`[FirestoreService Admin] Fetching ${count} recent shipments for sectors: ${sectors.join(', ')}`);
  }

  try {
    const shipmentsCollectionRef = dbAdmin.collection('Envoi');
    let q: admin.firestore.Query<admin.firestore.DocumentData>;

    const baseQuery = shipmentsCollectionRef.orderBy('dateCreation', 'desc').limit(count);

    if (fetchAllSectors) {
      q = baseQuery;
    } else {
      if (sectors.length > 0) {
          q = baseQuery.where('secteur', 'in', sectors);
      } else {
          console.warn("[FirestoreService Admin] getRecentShipmentsForSectors: Non-admin called with empty sectors array unexpectedly. Returning [].");
          return [];
      }
    }

    const querySnapshot = await q.get();
    const shipments = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        const dateCreation = data.dateCreation instanceof Timestamp ? data.dateCreation.toDate() : undefined;
        return {
            id: doc.id,
            ...data,
            dateCreation: dateCreation
        } as Shipment;
    });

    console.log(`[FirestoreService Admin] Fetched ${shipments.length} recent shipments matching criteria.`);
    return shipments;
  } catch (error: any) {
    console.error("[FirestoreService Admin] Error fetching recent shipments:", error);
     if (error.code === 9 || error.code === 'FAILED_PRECONDITION') {
         console.error("[FirestoreService Admin] CRITICAL: Firestore query requires an index (likely on dateCreation desc). Check Firestore console.");
         throw new Error("Index Firestore manquant (probablement sur dateCreation). Vérifiez la console Firestore.");
     }
    throw new Error(`Impossible de récupérer les envois récents. Cause: ${error.message || error}`);
  }
};

const getAllShipmentsForSectors = async (sectors: string[], isAdmin: boolean): Promise<Shipment[]> => {
  console.log(`[FirestoreService Admin] getAllShipmentsForSectors: Fetching ALL shipments. Admin: ${isAdmin}, Sectors: ${sectors.join(', ')}`);

  try {
    const shipmentsCollectionRef = dbAdmin.collection('Envoi');
    let q: admin.firestore.Query<admin.firestore.DocumentData>;

    if (isAdmin) {
        console.log("[FirestoreService Admin] getAllShipmentsForSectors: Admin detected, fetching all documents.");
        q = shipmentsCollectionRef;
    } else {
        if (!sectors || sectors.length === 0) {
            console.log("[FirestoreService Admin] getAllShipmentsForSectors: Non-admin with no sectors, returning [].");
            return [];
        }
        console.log(`[FirestoreService Admin] getAllShipmentsForSectors: Non-admin, fetching for sectors: ${sectors.join(', ')}`);
        q = shipmentsCollectionRef.where('secteur', 'in', sectors);
    }

    const querySnapshot = await q.get();
    const shipments = querySnapshot.docs.map((doc) => {
        const data = doc.data();
        const dateCreation = data.dateCreation instanceof Timestamp ? data.dateCreation.toDate() : undefined;
        return { id: doc.id, ...data, dateCreation } as Shipment;
    });
    console.log(`[FirestoreService Admin] getAllShipmentsForSectors: Fetched ${shipments.length} total shipments.`);
    return shipments;
  } catch (error: any) {
    console.error("[FirestoreService Admin] Error fetching all shipments for sectors:", error);
     if (error.code === 9 || error.code === 'FAILED_PRECONDITION') {
         console.error("[FirestoreService Admin] CRITICAL: Firestore query requires an index. Check Firestore console.");
         throw new Error("Index Firestore manquant. Vérifiez la console Firestore.");
     }
    throw new Error(`Impossible de récupérer tous les envois pour les secteurs. Cause: ${error.message || error}`);
  }
};

export const getDistinctClientCountFromEnvoiSdk = async (userProfile: UserProfile | null): Promise<number> => {
   if (!userProfile) {
     console.log("[FirestoreService Admin] getDistinctClientCountFromEnvoiSdk: No user profile provided, returning 0.");
     return 0;
   }

   const isAdmin = userProfile.role === 'Admin';
   const userSectors = userProfile.secteurs ?? [];

   console.warn(`[FirestoreService Admin] Calculating distinct client count from 'Envoi' documents. Admin: ${isAdmin}, Sectors: ${userSectors.join(', ')}. This can be inefficient.`);

   try {
     const accessibleShipments = await getAllShipmentsForSectors(userSectors, isAdmin);
     console.log(`[FirestoreService Admin] getDistinctClientCountFromEnvoiSdk: Fetched ${accessibleShipments.length} accessible shipments.`);

     if (accessibleShipments.length === 0) {
         console.log("[FirestoreService Admin] getDistinctClientCountFromEnvoiSdk: No accessible shipments found, returning 0 distinct clients.");
         return 0;
     }

     const uniqueClientIdentifiers = new Set<string>();
     accessibleShipments.forEach((shipment) => {
       let clientIdentifier: string | null = null;
       if (shipment.codeClient && String(shipment.codeClient).trim() !== '') {
         clientIdentifier = String(shipment.codeClient).trim();
       } else if (shipment.nomClient && String(shipment.nomClient).trim() !== '') {
          clientIdentifier = String(shipment.nomClient).trim();
       }
       if (clientIdentifier) {
         uniqueClientIdentifiers.add(clientIdentifier);
       }
     });

     const count = uniqueClientIdentifiers.size;
     console.log(`[FirestoreService Admin] getDistinctClientCountFromEnvoiSdk: Found ${count} distinct clients from accessible 'Envoi' documents.`);
     return count;
   } catch (error) {
     console.error("[FirestoreService Admin] getDistinctClientCountFromEnvoiSdk: Error calculating distinct client count:", error);
     throw new Error("Impossible de compter les clients distincts depuis les envois.");
   }
 };

export const deleteShipmentSdk = async (shipmentId: string): Promise<void> => {
  if (!shipmentId) {
    throw new Error("Shipment ID is required to delete.");
  }
  console.log(`[FirestoreService Admin] Attempting to delete shipment with ID: ${shipmentId}`);
  try {
    const shipmentDocRef = dbAdmin.collection('Envoi').doc(shipmentId);
    await shipmentDocRef.delete();
    console.log(`[FirestoreService Admin] Successfully deleted shipment: ${shipmentId}`);
  } catch (error: any) {
    console.error(`[FirestoreService Admin] Error deleting shipment ${shipmentId}:`, error);
    if (error.code === 7 || error.code === 'PERMISSION_DENIED') {
      console.error("[FirestoreService Admin] CRITICAL: Firestore permission denied for delete operation.");
      throw new Error("Permission refusée par Firestore pour la suppression.");
    }
    throw new Error(`Impossible de supprimer l'envoi. Cause: ${error.message || error}`);
  }
};


// --- Stats Snapshot Functions (Using Admin SDK) ---

export const getLatestStatsSnapshotsSdk = async (count: number = 1): Promise<StatsSnapshot[]> => {
  console.log(`[FirestoreService Admin] Fetching latest ${count} stats snapshot(s) from 'dailyStatsSnapshots'...`);
  try {
    const snapshotsCollectionRef = dbAdmin.collection('dailyStatsSnapshots');
    const q = snapshotsCollectionRef
      .orderBy('timestamp', 'desc')
      .limit(count);
    const querySnapshot = await q.get();
    const snapshots = querySnapshot.docs.map(doc => {
        const data = doc.data();
        const timestamp = data.timestamp instanceof Timestamp ? data.timestamp.toDate() : (data.timestamp ? new Date(data.timestamp) : new Date(0));
        return {
            id: doc.id,
            timestamp: timestamp,
            totalTickets: data.totalTickets ?? 0,
            activeShipments: data.activeShipments ?? 0,
            activeClients: data.activeClients ?? 0,
        } as StatsSnapshot;
    });
    console.log(`[FirestoreService Admin] Fetched ${snapshots.length} snapshot(s).`);
    return snapshots;
  } catch (error: any) {
    console.error("[FirestoreService Admin] Error fetching latest stats snapshots:", error);
     if (error.code === 9 || error.code === 'FAILED_PRECONDITION') {
         console.error("[FirestoreService Admin] CRITICAL: Firestore query requires an index (likely on timestamp desc). Check Firestore console.");
         throw new Error("Index Firestore manquant (probablement sur timestamp). Vérifiez la console Firestore.");
     }
    throw new Error(`Impossible de récupérer le dernier snapshot de statistiques. Cause: ${error.message || error}`);
  }
};


// --- Geocode Cache (Using Admin SDK) ---
const GEOCODE_COLLECTION_NAME = 'geocodes';

export const getGeocodeFromCache = async (address: string): Promise<{ latitude: number; longitude: number } | null> => {
  console.log(`[FirestoreService Admin] Getting geocode cache for address: ${address}`);
  try {
    const cacheDocRef = dbAdmin.collection(GEOCODE_COLLECTION_NAME).doc(address);
    const docSnap = await cacheDocRef.get();

    if (docSnap.exists) {
      const data = docSnap.data() as GeocodeCacheEntry;
      console.log(`[FirestoreService Admin] Geocode cache hit for address: ${address}`);
      return { latitude: data.latitude, longitude: data.longitude };
    } else {
      console.log(`[FirestoreService Admin] Geocode cache miss for address: ${address}`);
      return null;
    }
  } catch (error) {
    console.error("[FirestoreService Admin] Error getting geocode from cache:", error);
    return null;
  }
};

export const getArticles = async (): Promise<Article[]> => {
  console.log("[FirestoreService Admin] Fetching all articles...");
  try {
    const articlesCollectionRef = dbAdmin.collection('articles');
    const querySnapshot = await articlesCollectionRef.get();
    const articles = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }) as Article);
    console.log(`[FirestoreService Admin] Fetched ${articles.length} articles.`);
    return articles;
  } catch (error: any) {
    console.error("[FirestoreService Admin] Error fetching articles:", error);
    throw new Error(`Impossible de récupérer les articles. Cause: ${error.message || error}`);
  }
};

export const saveGeocodeToCache = async (address: string, latitude: number, longitude: number): Promise<void> => {
   console.log(`[FirestoreService Admin] Saving geocode cache for address: ${address}`);
  try {
    const cacheDocRef = dbAdmin.collection(GEOCODE_COLLECTION_NAME).doc(address);
    // Use admin.firestore.FieldValue for server timestamp with Admin SDK
    const cacheEntry: Omit<GeocodeCacheEntry, 'timestamp'> & { timestamp: admin.firestore.FieldValue } = {
      latitude,
      longitude,
      timestamp: FieldValue.serverTimestamp(),
    };
    await cacheDocRef.set(cacheEntry);
    console.log(`[FirestoreService Admin] Geocode saved to cache for address: ${address}`);
  } catch (error: any) {
    console.error("[FirestoreService Admin] Error saving geocode to cache:", error);
     if (error.code === 7 || error.code === 'PERMISSION_DENIED') {
        console.error("[FirestoreService Admin] CRITICAL: Firestore permission denied saving geocode cache.");
    }
  }
};

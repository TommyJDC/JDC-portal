import { FieldValue, Timestamp } from 'firebase-admin/firestore'; 
import { getDb } from '~/firebase.admin.config.server'; 
import { convertFirestoreDate } from "~/utils/dateUtils"; 
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
  SAPArchive,
  TechnicianInstallations
} from "~/types/firestore.types";
import type * as admin from 'firebase-admin';
import fetch from 'node-fetch';
import FormData from 'form-data';
import type { UserSessionData } from '~/services/session.server';
import { checkAvailabilityAndCreateBalanceEvent } from './calendar.service.server';

export async function getUserProfileSdk(uid: string): Promise<UserProfile | undefined> {
  const db = getDb(); 
  const userRef = db.collection('users').doc(uid);
  const doc = await userRef.get();

  console.log(`[FIRESTORE.SERVICE] getUserProfileSdk - Attempting to get doc for UID ${uid}. Doc type: ${typeof doc}, Doc content: ${JSON.stringify(doc)}, Doc exists property: ${doc ? doc.exists : 'doc is null/undefined'}`);

  if (!doc || !doc.exists) { // Added !doc check for safety, .exists is a property
    console.warn(`[FIRESTORE.SERVICE] Document not found or doc is invalid for UID: ${uid}`);
    return undefined;
  }
  const data = doc.data();
  if (!data) { 
    console.warn(`[FIRESTORE.SERVICE] Document data is undefined for UID: ${uid}, though document exists.`);
    return undefined; 
  }
  return {
    uid: data?.uid || uid,
    email: data?.email || '',
    role: data?.role || '',
    secteurs: data?.secteurs || [],
    displayName: data?.displayName || '',
    nom: data?.nom || '',
    phone: data?.phone || '',
    password: data?.password || '', 
    address: data?.address || '',
    blockchainAddress: data?.blockchainAddress || '',
    jobTitle: data?.jobTitle || '',
    department: data?.department || '', 
    googleRefreshToken: data?.googleRefreshToken || '',
    isGmailProcessor: data?.isGmailProcessor || false,
    gmailAuthorizedScopes: data?.gmailAuthorizedScopes || [],
    gmailAuthStatus: data?.gmailAuthStatus || 'inactive',
    labelSapClosed: data?.labelSapClosed || '',
    labelSapNoResponse: data?.labelSapNoResponse || '',
    labelSapRma: data?.labelSapRma || '',
    encryptedWallet: data?.encryptedWallet || '',
    createdAt: data?.createdAt instanceof Timestamp ? data.createdAt.toDate() : null, // Restauré
    updatedAt: data?.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : null, // Restauré
  } as UserProfile;
}

export async function createUserProfileSdk(profileData: UserProfile): Promise<UserProfile> {
  const db = getDb();
  const docRef = db.collection('users').doc(profileData.uid);
  const serverTimestamp = FieldValue.serverTimestamp();

  const dataToWrite: { [key: string]: any } = { ...profileData };

  // Gestion de createdAt : utiliser la Date JS si fournie, sinon serverTimestamp
  if (profileData.createdAt instanceof Date) {
    dataToWrite.createdAt = profileData.createdAt;
  } else {
    // Pour null, undefined, ou type incorrect, initialiser avec serverTimestamp.
    // Ceci est important si profileData.createdAt n'est pas fourni (nouvel utilisateur)
    // ou si c'est null (lu d'un ancien document Firestore sans ce champ).
    dataToWrite.createdAt = serverTimestamp;
  }

  // Toujours définir/mettre à jour updatedAt avec serverTimestamp
  dataToWrite.updatedAt = serverTimestamp;

  // Supprimer les autres champs qui seraient undefined pour éviter les erreurs Firestore
  for (const key in dataToWrite) {
    if (dataToWrite[key] === undefined && key !== 'createdAt' && key !== 'updatedAt') {
      delete dataToWrite[key];
    }
  }
  // Assurer que createdAt et updatedAt ne sont pas undefined (ils devraient être Date ou serverTimestamp)
  if (dataToWrite.createdAt === undefined) dataToWrite.createdAt = serverTimestamp;
  if (dataToWrite.updatedAt === undefined) dataToWrite.updatedAt = serverTimestamp;


  console.log("[FIRESTORE.SERVICE] Data to write for user profile (restored createdAt/updatedAt logic):", JSON.stringify(dataToWrite, null, 2));

  await docRef.set(dataToWrite, { merge: true });

  const writtenProfile = await getUserProfileSdk(profileData.uid);
  if (!writtenProfile) {
    console.error(`[FIRESTORE.SERVICE] Failed to re-read profile ${profileData.uid} after creation/update.`);
    // Retourner une version de profileData avec createdAt/updatedAt comme Date
    const now = new Date();
    return {
        ...profileData,
        createdAt: profileData.createdAt instanceof Date ? profileData.createdAt : now,
        updatedAt: now,
    } as UserProfile;
  }
  return writtenProfile;
}

export async function updateUserProfileSdk(uid: string, updates: Partial<UserProfile>): Promise<void> {
  const db = getDb(); 
  const userRef = db.collection('users').doc(uid);
  const dataToUpdate: any = { ...updates, updatedAt: FieldValue.serverTimestamp() }; // Restauré

   for (const key in dataToUpdate) {
    if (dataToUpdate[key] === undefined) {
      delete dataToUpdate[key];
    }
  }
  console.log("[FIRESTORE.SERVICE] Data to update for user profile (restored updatedAt):", JSON.stringify(dataToUpdate, null, 2));
  await userRef.update(dataToUpdate);
}

export async function updateInstallation(id: string, updates: Partial<Installation>): Promise<void> {
  const db = getDb(); 
  const installationRef = db.collection('installations').doc(id);
  
  // Récupérer l'installation actuelle
  const currentInstallation = await installationRef.get();
  const currentData = currentInstallation.data() as Installation;

  // Vérifier si le matériel vient d'être expédié
  const isNewlyExpedied = !currentData.materielExpedie && updates.materielExpedie === true;

  // Mettre à jour l'installation
  await installationRef.update(updates);

  // Si le matériel vient d'être expédié et que c'est une installation Kezia avec une balance
  if (isNewlyExpedied && 
      currentData.secteur.toLowerCase() === 'kezia' && 
      currentData.balance && 
      !currentData.verificationBalancePlanifiee) {
    
    try {
      // Récupérer l'utilisateur avec les droits Google
      const userDoc = await db.collection('users').doc('105906689661054220398').get();
      if (!userDoc.exists) throw new Error('User with Google token not found');
      
      const userData = userDoc.data();
      if (!userData) throw new Error('User data is empty');

      // Créer une session utilisateur pour l'utilisateur avec les droits Google
      const userSession: UserSessionData = {
        userId: userDoc.id,
        email: userData.email,
        displayName: userData.displayName,
        role: userData.role,
        secteurs: userData.secteurs,
        googleRefreshToken: userData.googleRefreshToken
      };

      // Créer l'événement de vérification
      const { success, error } = await checkAvailabilityAndCreateBalanceEvent(userSession, {
        ...currentData,
        ...updates
      });

      if (success) {
        // Marquer la vérification comme planifiée
        await installationRef.update({ verificationBalancePlanifiee: true });
      } else {
        console.error('Erreur lors de la planification de la vérification:', error);
      }
    } catch (error) {
      console.error('Erreur lors de la gestion de la vérification de balance:', error);
    }
  }

  // Déclencher la synchronisation avec Google Sheets
  try {
    const baseUrl = process.env.APP_BASE_URL || 'https://jdc-portal.netlify.app';
    const apiUrl = `${baseUrl}/.netlify/functions/sync-installations`;

    await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('[updateInstallation] Synchronisation avec Google Sheets déclenchée');
  } catch (error) {
    console.error('[updateInstallation] Erreur lors de la synchronisation avec Google Sheets:', error);
  }
}

export async function getInstallationsBySector(sector: string, filters?: InstallationFilters): Promise<Installation[]> {
  const db = getDb(); 
  let query: admin.firestore.Query = db.collection('installations')
    .where('secteur', '==', sector);

  if (filters) {
    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }
  }

  // Récupérer tous les envois CTN pour obtenir la liste des codes clients ayant reçu un envoi
  const ctnSnapshot = await db.collection('Envoi').get();
  const ctnClientCodes = new Set<string>();
  ctnSnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.codeClient) {
      ctnClientCodes.add(data.codeClient);
    }
  });

  const snapshot = await query.get();
  const installations = snapshot.docs.map(doc => {
    const data = doc.data();
    const hasCTN = ctnClientCodes.has(data.codeClient);
    const installation: Installation = {
      ...data, 
      id: doc.id, 
      secteur: sector, 
      codeClient: data.codeClient || '',
      nom: data.nom || '',
      ville: data.ville || '',
      contact: data.contact || '',
      telephone: data.telephone || '', 
      commercial: data.commercial || '',
      dateInstall: data.dateInstall ? convertFirestoreDate(data.dateInstall) ?? '' : '',
      tech: data.tech || '',
      status: (data.status as InstallationStatus) || 'rendez-vous à prendre', 
      commentaire: data.commentaire || '',
      hasCTN
    };
    return installation;
  });

  return installations;
}

export async function getClientCodesWithShipment(sector: string): Promise<Set<string>> {
  const shipments = await getAllShipments();
  const clientCodes = new Set<string>();
  shipments.forEach(shipment => {
    if (shipment.secteur && shipment.secteur === sector && shipment.codeClient) {
      clientCodes.add(shipment.codeClient);
    }
  });
  return clientCodes;
}

export async function getAllTicketsForSectorsSdk(sectors: string[]) { 
  const db = getDb(); 
  let allTickets: SapTicket[] = [];
  if (!sectors || sectors.length === 0) {
      console.warn("getAllTicketsForSectorsSdk called with empty or null sectors array.");
      return []; 
  }
  for (const sector of sectors) {
    const validSectors = ['CHR', 'HACCP', 'Kezia', 'Tabac'];
    if (!validSectors.includes(sector)) {
        console.warn(`getAllTicketsForSectorsSdk: Invalid sector name provided: ${sector}. Skipping.`);
        continue; 
    }
    const snapshot = await db.collection(sector).get();
    const sectorTickets = snapshot.docs.map(doc => {
      const data = doc.data();
      const date = convertFirestoreDate(data.date);
      let status: string = 'open'; 
      let statut: string = 'Nouveau'; 

      const rawStatus = data.status;
      if (typeof rawStatus === 'string') {
          status = rawStatus;
      } else if (typeof rawStatus === 'object' && rawStatus !== null && 'stringValue' in rawStatus && typeof rawStatus.stringValue === 'string') {
          status = rawStatus.stringValue;
      }

      const rawStatut = data.statut;
      if (typeof rawStatut === 'string') {
          statut = rawStatut;
      } else if (typeof rawStatut === 'object' && rawStatut !== null && 'stringValue' in rawStatut && typeof rawStatut.stringValue === 'string') {
          statut = rawStatut.stringValue;
      } else if (!rawStatut) {
          switch (status.toLowerCase()) {
              case 'open': statut = 'Ouvert'; break;
              case 'pending': statut = 'En attente'; break;
              case 'closed': statut = 'Clôturé'; break;
              case 'rma_request': statut = 'Demande de RMA'; break;
              case 'material_sent': statut = 'Envoi matériel'; break;
              default: statut = status.charAt(0).toUpperCase() + status.slice(1);
          }
      }

      return {
        id: doc.id,
        ...data, 
        date, 
        secteur: sector, 
        status, 
        statut
      } as SapTicket;
    });
    allTickets = [...allTickets, ...sectorTickets];
  }
  return allTickets;
}

export async function updateSAPTICKET(sectorId: string, ticketId: string, updates: Partial<SapTicket>): Promise<void> {
  const db = getDb(); 
  const ticketRef = db.collection(sectorId).doc(ticketId);
  await ticketRef.update(updates);
}

export async function getAllShipments(): Promise<Shipment[]> { 
  const db = getDb(); 
  const snapshot = await db.collection('Envoi').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shipment)); 
}

export async function deleteShipmentSdk(shipmentId: string): Promise<void> {
  const db = getDb(); 
  await db.collection('Envoi').doc(shipmentId).delete();
}

export async function getAllUserProfilesSdk(): Promise<UserProfile[]> {
  const db = getDb(); 
  const snapshot = await db.collection('users').get();
  return snapshot.docs.map(doc => {
    const data = doc.data(); 
    if (!data) {
        return { 
            uid: doc.id, 
            email: '', role: '', secteurs: [], displayName: '', nom: '', phone: '',
            password: '', address: '', blockchainAddress: '', jobTitle: '', department: '',
            googleRefreshToken: '', isGmailProcessor: false, gmailAuthorizedScopes: [],
            gmailAuthStatus: 'inactive', labelSapClosed: '', labelSapNoResponse: '',
            labelSapRma: '', encryptedWallet: '', createdAt: undefined, updatedAt: undefined,
         } as UserProfile;
    }
    return {
      uid: data.uid || doc.id, 
      email: data.email || '',
      role: data.role || '',
      secteurs: data.secteurs || [],
      displayName: data.displayName || '',
      nom: data.nom || '',
      phone: data.phone || '',
      password: data.password || '',
      address: data.address || '',
      blockchainAddress: data.blockchainAddress || '',
      jobTitle: data.jobTitle || '',
      department: data.department || '', 
      googleRefreshToken: data.googleRefreshToken || '',
      isGmailProcessor: data.isGmailProcessor || false,
      gmailAuthorizedScopes: data.gmailAuthorizedScopes || [],
      gmailAuthStatus: data.gmailAuthStatus || 'inactive',
      labelSapClosed: data.labelSapClosed || '',
      labelSapNoResponse: data.labelSapNoResponse || '',
      labelSapRma: data.labelSapRma || '',
      encryptedWallet: data.encryptedWallet || '',
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null, 
      updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : null, 
    } as UserProfile;
  });
}

export async function getSapTicketCountBySectorSdk(sectors: string[]): Promise<Record<string, number>> {
  const db = getDb(); 
  const ticketCounts: Record<string, number> = {};
  for (const sector of sectors) {
    try {
      const snapshot = await db.collection(sector).count().get();
      ticketCounts[sector] = snapshot.data().count;
    } catch (error) {
      console.error(`Error fetching ticket count for sector ${sector}:`, error);
      ticketCounts[sector] = 0;
    }
  }
  return ticketCounts;
}

export async function getRecentTicketsForSectors(sectors: string[], limit: number): Promise<SapTicket[]> {
  const db = getDb(); 
  let allTickets: SapTicket[] = [];
  for (const sector of sectors) {
    const snapshot = await db.collection(sector)
      .orderBy('date', 'desc')
      .limit(limit)
      .get();
    const sectorTickets = snapshot.docs.map(doc => {
      const data = doc.data();
      const date = convertFirestoreDate(data.date);
      return { id: doc.id, ...data, date, secteur: sector } as SapTicket;
    });
    allTickets = [...allTickets, ...sectorTickets];
  }
  return allTickets
    .sort((a, b) => {
      const dateA = a.date?.getTime() || 0;
      const dateB = b.date?.getTime() || 0;
      return dateB - dateA;
    })
    .slice(0, limit);
}

export async function getDistinctClientCountFromEnvoiSdk(userProfile: UserProfile): Promise<number> {
  const db = getDb(); 
  const sectors = userProfile.role === 'Admin'
    ? ['CHR', 'HACCP', 'Kezia', 'Tabac']
    : userProfile.secteurs;
  const clientCodes = new Set<string>();
  for (const sector of sectors) {
    const snapshot = await db.collection('Envoi').where('secteur', '==', sector).get();
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
  console.log('[getInstallationsSnapshot] Début avec:', {
    userRole: userProfile.role,
    userName: userProfile.nom,
    userSectors: userProfile.secteurs
  });

  const db = getDb(); 
  const sectors = userProfile.role === 'Admin'
    ? ['chr', 'haccp', 'kezia', 'tabac']
    : userProfile.secteurs.map(s => s.toLowerCase());

  console.log('[getInstallationsSnapshot] Secteurs à traiter:', sectors);

  const snapshot: InstallationsSnapshot = {
    total: 0,
    byStatus: { 'rendez-vous à prendre': 0, 'rendez-vous pris': 0, 'installation terminée': 0 },
    bySector: {}
  };

  const installationsSnapshotQuery = await db.collection('installations').get();
  console.log('[getInstallationsSnapshot] Nombre total d\'installations:', installationsSnapshotQuery.docs.length);

  installationsSnapshotQuery.docs.forEach(doc => {
    const data = doc.data();
    const installationSector = (data.secteur as string)?.toLowerCase();
    const status = data.status as InstallationStatus;

    // Vérifier si le secteur de l'installation correspond à un des secteurs autorisés
    if (sectors.includes(installationSector)) {
      snapshot.total++;
      snapshot.byStatus[status] = (snapshot.byStatus[status] || 0) + 1;

      // Initialiser les stats du secteur si nécessaire
      if (!snapshot.bySector[installationSector]) {
        snapshot.bySector[installationSector] = {
          total: 0,
          byStatus: { 'rendez-vous à prendre': 0, 'rendez-vous pris': 0, 'installation terminée': 0 },
        };
      }

      // Mettre à jour les stats du secteur
      snapshot.bySector[installationSector].total++;
      snapshot.bySector[installationSector].byStatus[status] = 
        (snapshot.bySector[installationSector].byStatus[status] || 0) + 1;
    }
  });

  console.log('[getInstallationsSnapshot] Snapshot final:', snapshot);
  return snapshot;
}

export async function getLatestStatsSnapshotsSdk(): Promise<StatsSnapshot[]> {
  const db = getDb(); 
  const snapshot = await db.collection('dailyStatsSnapshots')
    .orderBy('timestamp', 'desc')
    .limit(30)
    .get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as StatsSnapshot[];
}

export async function getGeocodeFromCache(address: string): Promise<{ lat: number; lng: number } | undefined> {
  const db = getDb(); 
  const geocodeCacheRef = db.collection('geocodeCache').doc(address);
  const doc = await geocodeCacheRef.get();
  if (!doc.exists) { // .exists est une propriété
    return undefined;
  }
  const data = doc.data();
  if(!data) return undefined;
  return data as { lat: number; lng: number };
}

export async function setGeocodeToCache(address: string, geocode: { lat: number; lng: number }): Promise<void> {
  const db = getDb(); 
  const geocodeCacheRef = db.collection('geocodeCache').doc(address);
  await geocodeCacheRef.set(geocode);
}

export async function getAllInstallations(): Promise<Installation[]> {
  const db = getDb(); 
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
      dateInstall: data.dateInstall ? convertFirestoreDate(data.dateInstall) ?? '' : '',
      tech: data.tech || '',
      status: (data.status as InstallationStatus) || 'rendez-vous à prendre',
      commentaire: data.commentaire || '',
    };
    return installation;
  }) as Installation[];
}

const cloudinaryConfig = {
  cloudName: 'dkeqzl54y',
  apiKey: '725561566214411',
  apiSecret: process.env.CLOUDINARY_API_SECRET || 'cJQOY_KSc0gkmLFx2nT496VbBVY',
  uploadPreset: 'articles_images'
};

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
    const data = await response.json() as { secure_url: string };
    return data.secure_url;
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw error;
  }
}

export async function addArticleImageUrl(articleId: string, imageUrl: string): Promise<void> {
  const db = getDb(); 
  const articleRef = db.collection('articles').doc(articleId);
  await articleRef.update({
    imageUrls: FieldValue.arrayUnion(imageUrl)
  });
}

export async function deleteArticleImageUrl(articleId: string, imageUrl: string): Promise<void> {
  const db = getDb(); 
  const articleRef = db.collection('articles').doc(articleId);
  await articleRef.update({
    imageUrls: FieldValue.arrayRemove(imageUrl)
  });
}

export async function searchArticles({ code, nom }: { code: string; nom: string }): Promise<Article[]> {
  const db = getDb(); 
  let query: FirebaseFirestore.Query = db.collection('articles');
  let articles: Article[] = [];
  const upperCode = code.toUpperCase();
  const upperNom = nom.toUpperCase();

  if (upperCode) {
    console.log("[searchArticles] Searching by code (uppercase):", upperCode);
    query = query.where('Code', '==', upperCode);
    const snapshot = await query.get();
    articles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Article[];
  } else if (upperNom) {
    console.log("[searchArticles] Searching by nom (uppercase):", upperNom);
    query = query.where('Désignation', '>=', upperNom)
                 .where('Désignation', '<=', upperNom + '\uf8ff');
    const snapshot = await query.get();
    articles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Article[];
  } else {
    console.log("[searchArticles] No search criteria provided.");
    articles = [];
  }
  return articles;
}

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

export async function archiveSapTicket(ticket: SapTicket, technicianNotes: string | undefined, technicianName: string): Promise<void> {
  const db = getDb(); 
  const clientValue = getSafeStringValue(ticket.client, getSafeStringValue(ticket.raisonSociale, 'Client inconnu'));
  const raisonSocialeValue = getSafeStringValue(ticket.raisonSociale);
  const descriptionValue = getSafeStringValue(ticket.description, getSafeStringValue(ticket.descriptionProbleme));
  const numeroSAPValue = getSafeStringValue(ticket.numeroSAP);
  const archiveData: SAPArchive = {
    originalTicketId: ticket.id,
    archivedDate: FieldValue.serverTimestamp() as any, 
    closureReason: ticket.status === 'closed' ? 'resolved' : 'no-response',
    technicianNotes: technicianNotes || 'Aucune note fournie',
    technician: technicianName,
    client: { stringValue: clientValue },
    raisonSociale: { stringValue: raisonSocialeValue },
    description: { stringValue: descriptionValue },
    secteur: ticket.secteur as 'CHR' | 'HACCP' | 'Kezia' | 'Tabac',
    numeroSAP: { stringValue: numeroSAPValue },
    mailId: ticket.mailId || undefined,
    documents: [],
  };
  try {
    const archiveRef = await db.collection('sap-archive').add(archiveData);
    console.log(`Ticket ${ticket.id} archived successfully to ${archiveRef.id}`);
    await db.collection(ticket.secteur).doc(ticket.id).delete();
    console.log(`Original ticket ${ticket.id} deleted from ${ticket.secteur}`);
  } catch (error) {
    console.error(`Error archiving ticket ${ticket.id}:`, error);
    throw error;
  }
}

export interface HeuresDraft {
  userId: string;
  fileId: string; 
  data: any; 
  createdAt: Timestamp; 
}

export async function saveHeuresDraft(draftData: Omit<HeuresDraft, 'createdAt'>): Promise<void> {
  const db = getDb(); 
  const docId = `${draftData.userId}_${draftData.fileId}`;
  await db.collection('heuresDrafts').doc(docId).set({
    ...draftData,
    createdAt: FieldValue.serverTimestamp() 
  });
}

export async function getHeuresDraft(userId: string, fileId: string): Promise<HeuresDraft | undefined> {
  const db = getDb(); 
  const docId = `${userId}_${fileId}`;
  const docSnap = await db.collection('heuresDrafts').doc(docId).get();

  if (!docSnap.exists) { // .exists est une propriété
    return undefined;
  }
  const data = docSnap.data(); // data() peut retourner undefined
  if (!data) {
    console.warn(`HeuresDraft document ${docId} exists but data() returned undefined.`);
    return undefined;
  }
  return data as HeuresDraft; 
}


export async function deleteSapTicket(
  sectorId: string,
  ticketId: string
): Promise<{ success: boolean; message: string }> {
  try {
    if (!sectorId || !ticketId) {
      throw new Error('Paramètres sectorId et ticketId requis');
    }
    const db = getDb(); 

    const validSectors = ['CHR', 'HACCP', 'Kezia', 'Tabac'];
    if (!validSectors.includes(sectorId)) {
      throw new Error(`Secteur invalide: ${sectorId}`);
    }

    const docRef = db.collection(sectorId).doc(ticketId);
    const docSnapshot = await docRef.get(); 
    const docExists = docSnapshot.exists; // .exists est une propriété

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

const TASK_COLLECTION = 'scheduledTasksState';

interface TaskState {
  lastRun: Timestamp;
}

export async function getScheduledTaskState(taskName: string): Promise<TaskState | undefined> {
  const db = getDb(); 
  const taskDoc = await db.collection(TASK_COLLECTION).doc(taskName).get();

  if (taskDoc.exists) { // .exists est une propriété
    const data = taskDoc.data(); 
    if (data) {
        return data as TaskState;
    } else {
        console.warn(`TaskState document ${taskName} exists but data() returned undefined.`); // Modifié le message
        return undefined;
    }
  }
  return undefined;
}

export async function updateScheduledTaskState(taskName: string): Promise<void> {
  const db = getDb(); 
  const now = new Date();
  await db.collection(TASK_COLLECTION).doc(taskName).set({ lastRun: now });
}

export async function deleteNotificationById(notificationId: string): Promise<{ success: boolean; message: string }> {
  try {
    if (!notificationId) {
      throw new Error('ID de notification requis');
    }
    const db = getDb(); 

    const docRef = db.collection('notifications').doc(notificationId);
    const docSnapshot = await docRef.get(); 
    const docExists = docSnapshot.exists; // .exists est une propriété

    if (!docExists) {
      return {
        success: false,
        message: `Notification ${notificationId} introuvable`
      };
    }

    await docRef.delete();

    return {
      success: true,
      message: `Notification ${notificationId} supprimée avec succès`
    };

  } catch (error) {
    console.error(`Erreur suppression notification ${notificationId} :`, error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erreur inconnue lors de la suppression'
    };
  }
}

export async function getTechniciansInstallationsSdk(): Promise<TechnicianInstallations[]> {
  const db = getDb();
  
  // Récupérer toutes les installations
  const installationsSnapshot = await db.collection('installations').get();
  
  // Créer un Map pour stocker les statistiques par technicien
  const techStats = new Map<string, {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
  }>();

  // Parcourir toutes les installations
  installationsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const techName = data.tech;
    
    if (!techName) return; // Ignorer les installations sans technicien

    // Initialiser les stats pour ce technicien si nécessaire
    if (!techStats.has(techName)) {
      techStats.set(techName, {
        total: 0,
        completed: 0,
        inProgress: 0,
        pending: 0
      });
    }

    const stats = techStats.get(techName)!;
    stats.total++;

    // Incrémenter le compteur approprié selon le statut
    switch (data.status) {
      case 'installation terminée':
        stats.completed++;
        break;
      case 'rendez-vous pris':
        stats.inProgress++;
        break;
      case 'rendez-vous à prendre':
        stats.pending++;
        break;
    }
  });

  // Convertir le Map en tableau de TechnicianInstallations
  const techniciansData: TechnicianInstallations[] = Array.from(techStats.entries()).map(([techName, stats]) => {
    const [firstName, ...lastNameParts] = techName.split(' ');
    const lastName = lastNameParts.join(' ');

    return {
      technicianId: techName, // Utiliser le nom comme ID
      firstName: firstName || '',
      lastName: lastName || '',
      ...stats
    };
  });

  console.log('[FIRESTORE.SERVICE] Données finales des techniciens:', techniciansData);
  return techniciansData;
}

export async function createDailySapSnapshot() {
  const db = getDb();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Récupérer les tickets SAP par secteur
  const sectors = ['CHR', 'HACCP', 'Kezia', 'Tabac'];
  const ticketCounts: Record<string, number> = {};

  for (const sector of sectors) {
    const counts = await getSapTicketCountBySectorSdk([sector]);
    ticketCounts[sector] = counts[sector] || 0;
  }

  // Créer le snapshot
  const snapshot = {
    timestamp: today,
    ticketCounts,
    createdAt: new Date()
  };

  // Sauvegarder dans la collection 'sap_snapshots'
  await db.collection('sap_snapshots').add(snapshot);

  console.log('[FIRESTORE.SERVICE] Snapshot SAP quotidien créé:', snapshot);
  return snapshot;
}

export async function getSapEvolution24h() {
  const db = getDb();
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  // Récupérer le snapshot d'hier
  const snapshotQuery = await db.collection('sap_snapshots')
    .where('timestamp', '>=', yesterday)
    .orderBy('timestamp', 'desc')
    .limit(1)
    .get();

  if (snapshotQuery.empty) {
    console.log('[FIRESTORE.SERVICE] Aucun snapshot trouvé pour les dernières 24h');
    return null;
  }

  const yesterdaySnapshot = snapshotQuery.docs[0].data();
  const currentCounts = await getSapTicketCountBySectorSdk(['CHR', 'HACCP', 'Kezia', 'Tabac']);

  // Calculer l'évolution par secteur
  const evolution: Record<string, number> = {};
  for (const sector of ['CHR', 'HACCP', 'Kezia', 'Tabac']) {
    const yesterdayCount = yesterdaySnapshot.ticketCounts[sector] || 0;
    const currentCount = currentCounts[sector] || 0;
    evolution[sector] = currentCount - yesterdayCount;
  }

  return {
    yesterday: yesterdaySnapshot.ticketCounts,
    current: currentCounts,
    evolution
  };
}

export async function getTechnicians(sector?: string): Promise<{ id: string; name: string }[]> {
  const db = getDb();
  let query = db.collection('users')
    .where('role', 'in', ['Technician', 'Admin']);

  const snapshot = await query.get();
  
  return snapshot.docs
    .map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: `${data.displayName || data.nom || 'Sans nom'}`,
        secteurs: data.secteurs || [],
        role: data.role || ''
      };
    })
    .filter(tech => 
      // Si un secteur est spécifié, ne garder que les techniciens qui ont ce secteur ou sont admin
      !sector || 
      tech.secteurs.map((s: string) => s.toLowerCase()).includes(sector.toLowerCase()) ||
      tech.role === 'Admin'
    )
    .map(({ id, name }) => ({ id, name }));
}

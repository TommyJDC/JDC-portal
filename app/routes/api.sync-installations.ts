import type { DataFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Firestore } from 'firebase-admin/firestore';
import { google, sheets_v4 } from 'googleapis';

type Sector = 'chr' | 'haccp' | 'tabac' | 'kezia';
type SpreadsheetConfig = Record<Sector, { spreadsheetId: string; range: string }>;
type ColumnMapping = Record<string, number>;
type ColumnMappings = Record<Sector, ColumnMapping>;

// Configuration
const SPREADSHEET_CONFIG: SpreadsheetConfig = {
  chr: {
    spreadsheetId: '1vnyvpP8uGw0oa9a4j-KI8IUXdc4wW52n_TiQOedw4hk',
    range: 'EN COURS!A2:Z',
  },
  haccp: {
    spreadsheetId: '1wP5ixXsDJNmCAzuI2WM8sXAhokoJeEQrUxjNW-Tneq0',
    range: 'EN COURS!A2:Z',
  },
  tabac: {
    spreadsheetId: '1Ggm5rnwGmn40JjSN7aB6cs7z-hJiEkdAZLUq6QaQvjg',
    range: 'EN COURS!A2:Z',
  },
  kezia: {
    spreadsheetId: '1uzzHN8tzc53mOOpH8WuXJHIUsk9f17eYc0qsod-Yryk',
    range: 'EN COURS!A2:Z',
  },
};

export const COLUMN_MAPPINGS: ColumnMappings = {
  chr: {
    // commande: 0, // Non mappé dans le code actuel
    dateCdeMateriel: 1, // B
    // CA: 2, // Non mappé dans le code actuel
    codeClient: 3, // D
    nom: 4, // E
    ville: 5, // F
    telephone: 6, // G
    commercial: 7, // H
    // MATERIEL A INSTALLER: 8, // Non mappé dans le code actuel
    cdc: 9, // J
    integrationJalia: 10, // K
    dossier: 11, // L
    tech: 12, // M
    dateInstall: 13, // N
    heure: 14, // O
    // RELANCE PROG: 15, // Non mappé dans le code actuel
    commentaireTech: 16, // Q
    materielLivre: 17, // R
    commentaireEnvoiBT: 18, // S
    // BT: 19, // Non mappé dans le code actuel
    techSecu: 20, // U
    techAffecte: 21 // V
  },
  haccp: {
    dateSignatureCde: 0,
    dateCdeMateriel: 1,
    codeClient: 2,
    nom: 3,
    ville: 4,
    telephone: 5,
    commercial: 6,
    materielPreParametrage: 7,
    dossier: 8,
    dateInstall: 9,
    commentaire: 10,
    materielLivre: 11,
    numeroColis: 12,
    commentaireInstall: 13,
    identifiantMotDePasse: 14,
    numerosSondes: 15
  },
  tabac: {
    dateSignatureCde: 0,
    dateCdeMateriel: 1,
    codeClient: 2,
    nom: 3,
    ville: 4,
    coordonneesTel: 5,
    commercial: 6,
    materielBalance: 7,
    offreTpe: 8,
    cdc: 9,
    tech: 10,
    dateInstall: 11,
    typeInstall: 12,
    commentaireEtatMateriel: 13
  },
  kezia: {
    colonne1: 1, 
    dateCdeMateriel: 2,
    codeClient: 3,       
    nom: 4,              
    ville: 5,            
    personneContact: 6,  
    telephone: 7,        
    commercial: 8,       
    configCaisse: 9,     
    offreTpe: 10,         
    cdc: 11,            
    dossier: 12,         
    tech: 13,            
    dateInstall: 14,     
    commentaire: 15,     
    materielEnvoye: 16,  
    confirmationReception: 17  
  }
};

import { initializeFirebaseAdmin, getDb } from '~/firebase.admin.config.server';
import type { InstallationStatus } from "~/types/firestore.types"; // Importer le type InstallationStatus

console.log("[api.sync-installations] Action déclenchée.");

let db: Firestore;

async function ensureFirebaseInitialized() {
  if (!db) {
    await initializeFirebaseAdmin();
    db = getDb();
  }
  return db;
}


async function getSheetData(auth: any, spreadsheetId: string, range: string) {
  console.log(`[sync-installations] Récupération données sheet ${spreadsheetId}`);
  const sheets = google.sheets({ version: 'v4', auth });
  try {
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    return response.data.values || [];
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error(`[sync-installations] Erreur récupération sheet ${spreadsheetId}:`, err.message);
    }
    return [];
  }
}

async function getGoogleSheetsAuth(db: Firestore) {
  console.log('[sync-installations] Récupération auth Google Sheets');
  const userDoc = await db.collection('users').doc('105906689661054220398').get();
  if (!userDoc.exists) throw new Error('User with Google token not found');
  
  const userData = userDoc.data();
  if (!userData) throw new Error('User data is empty');
  if (!userData.googleRefreshToken) throw new Error('Google refresh token not found');

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  
  auth.setCredentials({
    refresh_token: userData.googleRefreshToken,
    scope: userData.gmailAuthorizedScopes?.join(' ') || 'https://www.googleapis.com/auth/spreadsheets.readonly',
    token_type: 'Bearer'
  });
  
  return auth;
}

async function getAllInstallationsFromFirestore(db: Firestore, sector: Sector) {
  console.log(`[sync-installations] Récupération installations ${sector} depuis Firestore`);
  const snapshot = await db.collection('installations').where('secteur', '==', sector).get();
  const installations: Record<string, { id: string; [key: string]: unknown }> = {};
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.codeClient) installations[data.codeClient] = { id: doc.id, ...data };
  });
  console.log(`[sync-installations] ${Object.keys(installations).length} installations trouvées pour ${sector}`);
  return installations;
}

async function syncSector(sector: Sector, config: { spreadsheetId: string; range: string }, auth: any) {
  const db = await ensureFirebaseInitialized();
  console.log(`[sync-installations] Début synchronisation secteur ${sector}`);
  
  const [sheetData, firestoreData] = await Promise.all([
    getSheetData(auth, config.spreadsheetId, config.range),
    getAllInstallationsFromFirestore(db, sector)
  ]);

  if (!sheetData) {
    console.error(`[sync-installations] Aucune donnée sheet pour ${sector}`);
    return { added: 0, updated: 0, terminated: 0 };
  }

  console.log(`[sync-installations] ${sheetData.length} lignes trouvées pour ${sector}`);

  const sheetCodeClients = new Set();
  const updates: any[] = [];
  const adds: any[] = [];
  const sectorMapping = COLUMN_MAPPINGS[sector];

  for (const row of sheetData) {
    const codeClient = row[sectorMapping.codeClient];
    if (!codeClient) continue;
    
    sheetCodeClients.add(codeClient);
    // Construire l'objet installationData en mappant toutes les colonnes définies dans COLUMN_MAPPINGS
    const installationData: Record<string, any> = {
      secteur: sector, // Toujours inclure le secteur
      codeClient: codeClient, // Toujours inclure le code client
      status: 'rendez-vous à prendre', // Définir un statut par défaut si non présent dans la feuille? Ou mapper depuis la feuille si un champ status existe? (Actuellement non mappé dans COLUMN_MAPPINGS)
    };

    // Log pour le débogage - Afficher la ligne brute et les données mappées pour Kezia
    if (sector === 'kezia') {
      console.log(`[sync-installations][DEBUG] Kezia Row:`, row);
      console.log(`[sync-installations][DEBUG] Kezia Mapped Data (before processing):`, installationData);
    }

    // Mapper tous les champs définis dans le mapping du secteur
    for (const key in sectorMapping) {
      const columnIndex = sectorMapping[key];
      const value = row[columnIndex];
      
      // Gérer les cas spécifiques ou formater si nécessaire (ex: dates)
      if (key === 'dateInstall' || key === 'dateCdeMateriel' || key === 'dateSignatureCde') {
        // Tenter de parser la date si elle existe
        const date = value ? new Date(value) : null;
        // Vérifier si la date est valide. Si non, stocker null.
        installationData[key] = date && !isNaN(date.getTime()) ? date : null;
      } else if (key === 'telephone' && sector === 'tabac') {
         // Gérer le cas spécifique du téléphone pour Tabac si le champ est nommé différemment dans la feuille
         // Note: Le mapping COLUMN_MAPPINGS.tabac.coordonneesTel est déjà utilisé pour 'telephone' ci-dessous
         installationData['telephone'] = value || '';
      }
       else {
        // Pour les autres champs, stocker la valeur brute (ou une chaîne vide si undefined/null)
        installationData[key] = value || '';
      }
    }

    // Assurer que les champs obligatoires par le type Installation sont présents, même s'ils sont vides
    // (Cela peut être redondant si le mapping les couvre, mais assure la robustesse)
    installationData.nom = installationData.nom || '';
    installationData.codeClient = installationData.codeClient || '';
    installationData.status = (installationData.status as InstallationStatus) || 'rendez-vous à prendre';


    const existing = firestoreData[codeClient];
    if (existing) {
      updates.push(installationData);
    } else {
      adds.push(installationData);
    }
  }

  console.log(`[sync-installations] Secteur ${sector}: ${adds.length} ajouts, ${updates.length} mises à jour`);

  // Enregistrer les nouvelles installations
  const batch = db.batch();
  for (const add of adds) {
    const newDocRef = db.collection('installations').doc();
    batch.set(newDocRef, add);
  }

  // Mettre à jour les installations existantes
  for (const update of updates) {
    const docRef = db.collection('installations').doc(firestoreData[update.codeClient].id);
    batch.update(docRef, update);
  }

  await batch.commit();
  
  return { 
    added: adds.length, 
    updated: updates.length, 
    terminated: Object.keys(firestoreData).length 
  };
}

export async function action({ request }: DataFunctionArgs) {
  console.log('[sync-installations] Début de la synchronisation');
  
  if (request.method !== 'POST') {
    console.error('[sync-installations] Méthode non autorisée:', request.method);
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    console.log('[sync-installations] Initialisation Firebase...');
    db = await ensureFirebaseInitialized();
    console.log('[sync-installations] Firebase initialisé avec succès');
    
    console.log('[sync-installations] Récupération auth Google Sheets...');
    const auth = await getGoogleSheetsAuth(db);
    console.log('[sync-installations] Auth Google Sheets récupérée avec succès');
    
    const results: Record<string, any> = {};
    console.log('[sync-installations] Début synchronisation secteurs');
    
    for (const sector in SPREADSHEET_CONFIG) {
      const typedSector = sector as Sector;
      console.log(`[sync-installations] Synchronisation secteur ${typedSector}`);
      results[typedSector] = await syncSector(typedSector, SPREADSHEET_CONFIG[typedSector], auth);
      console.log(`[sync-installations] Secteur ${typedSector} synchronisé:`, results[typedSector]);
    }

    console.log('[sync-installations] Synchronisation terminée avec succès');
    return json({ success: true, results });
  } catch (error: any) {
    console.error('[sync-installations] Erreur de synchronisation:', error);
    
    // Log supplémentaire pour Firebase
    if (error.code && error.code.startsWith('firebase')) {
      console.error('[sync-installations] Erreur Firebase:', error.code, error.details);
    }
    
    // Log supplémentaire pour Google Sheets
    if (error.response) {
      console.error('[sync-installations] Erreur Google API:', {
        status: error.response.status,
        data: error.response.data
      });
    }

    return json({ 
      error: error.message || 'An unknown error has occurred',
      details: process.env.NODE_ENV === 'development' ? {
        code: error.code,
        stack: error.stack,
        response: error.response?.data
      } : undefined
    }, { status: 500 });
  }
}

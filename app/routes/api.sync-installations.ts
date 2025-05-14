import type { DataFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Firestore } from 'firebase-admin/firestore';
import { google, sheets_v4 } from 'googleapis';
import { LoaderFunctionArgs } from '@remix-run/node';
import type { Installation } from '~/types/firestore.types';
import { getDb } from '~/firebase.admin.config.server';
import type { InstallationStatus } from '~/types/firestore.types';
import { getGoogleAuthClient } from "~/services/google.server";

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

import { initializeFirebaseAdmin } from '~/firebase.admin.config.server';

console.log("[api.sync-installations] Action déclenchée.");

let db: Firestore;

async function ensureFirebaseInitialized() {
  if (!db) {
    await initializeFirebaseAdmin();
    db = getDb();
  }
  return db;
}

// Renommée pour plus de clarté : ne retourne que le token, pas l'objet auth complet
export async function getGoogleRefreshTokenFromFirestore() {
  try {
    const db = await ensureFirebaseInitialized();
    const adminSnapshot = await db.collection('users').where('role', '==', 'Admin').get();
    const adminWithToken = adminSnapshot.docs.find(doc => doc.data().googleRefreshToken != null);
    if (adminWithToken) {
      console.log("Utilisateur admin trouvé avec token Google (refresh token)");
      return adminWithToken.data().googleRefreshToken;
    }
    const userSnapshot = await db.collection('users').get();
    const userWithToken = userSnapshot.docs.find(doc => doc.data().googleRefreshToken != null);
    if (userWithToken) {
      console.log("Utilisateur (non-admin) trouvé avec token Google (refresh token)");
      return userWithToken.data().googleRefreshToken;
    }
    throw new Error("Aucun utilisateur avec refresh token Google trouvé dans Firestore");
  } catch (error) {
    console.error("Erreur lors de la récupération du refresh token Google depuis Firestore:", error);
    throw error;
  }
}

async function getSheetData(authClient: any, spreadsheetId: string, range: string) {
  console.log(`[sync-installations] Récupération données sheet ${spreadsheetId} avec client OAuth2`);
  const sheets = google.sheets({ version: 'v4', auth: authClient });
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

async function syncSector(sector: Sector, config: { spreadsheetId: string; range: string }, authClient: any) {
  const db = await ensureFirebaseInitialized();
  console.log(`[sync-installations] Début synchronisation secteur ${sector}`);
  
  const [sheetData, firestoreDataObj] = await Promise.all([
    getSheetData(authClient, config.spreadsheetId, config.range),
    getAllInstallationsFromFirestore(db, sector) // Renommé firestoreDataObj pour clarté
  ]);

  if (!sheetData) {
    console.error(`[sync-installations] Aucune donnée sheet pour ${sector}`);
    // Retourner le nombre d'installations existantes comme potentiellement "terminées" ou "à vérifier"
    return { added: 0, updated: 0, deleted: 0, existingInFirestore: Object.keys(firestoreDataObj).length }; 
  }

  console.log(`[sync-installations] ${sheetData.length} lignes trouvées dans Google Sheet pour ${sector}`);

  const sheetCodeClients = new Set<string>();
  const updates: any[] = [];
  const adds: any[] = [];
  const sectorMapping = COLUMN_MAPPINGS[sector];

  for (const row of sheetData) {
    const codeClientValue = row[sectorMapping.codeClient];
    if (!codeClientValue) continue;
    
    const codeClient = String(codeClientValue).trim(); // Assurer que c'est une chaîne et trim
    sheetCodeClients.add(codeClient);
    
    const installationData: Record<string, any> = {
      secteur: sector, 
      codeClient: codeClient, 
      status: 'rendez-vous à prendre', 
    };

    if (sector === 'kezia') {
      console.log(`[sync-installations][DEBUG] Kezia Row:`, row);
      console.log(`[sync-installations][DEBUG] Kezia Mapped Data (before processing):`, installationData);
    }

    for (const key in sectorMapping) {
      const columnIndex = sectorMapping[key];
      const value = row[columnIndex];
      
      if (key === 'dateInstall' || key === 'dateCdeMateriel' || key === 'dateSignatureCde') {
        const date = value ? new Date(value) : null;
        installationData[key] = date && !isNaN(date.getTime()) ? date.toISOString() : null; // Stocker en ISO string ou null
      } else if (key === 'telephone' && sector === 'tabac' && sectorMapping.coordonneesTel !== undefined) {
         // Utiliser le mapping spécifique pour le téléphone Tabac si défini
         installationData['telephone'] = row[sectorMapping.coordonneesTel] || '';
      } else if (key !== 'codeClient') { // Éviter de ré-écraser codeClient qui est déjà traité
        installationData[key] = value || '';
      }
    }
    installationData.nom = installationData.nom || '';
    installationData.codeClient = installationData.codeClient || '';
    installationData.status = (installationData.status as InstallationStatus) || 'rendez-vous à prendre';

    const existing = firestoreDataObj[codeClient];
    if (existing) {
      let hasChanges = false;
      for (const keyToCompare in installationData) {
        let sheetValue = installationData[keyToCompare];
        let firestoreValueAtKey = existing[keyToCompare]; // Renommé pour éviter confusion avec la variable de scope externe

        if (keyToCompare.startsWith('date')) {
          try {
            sheetValue = sheetValue ? new Date(sheetValue).toISOString() : null;
          } catch (e) {
            sheetValue = null; // Invalide, considérer comme différent
          }
          
          try {
            if (firestoreValueAtKey && typeof (firestoreValueAtKey as any).toDate === 'function') {
              // Cas Timestamp Firestore
              firestoreValueAtKey = (firestoreValueAtKey as any).toDate().toISOString();
            } else if (firestoreValueAtKey) {
              // Cas string ISO, objet Date JS, ou autre chose convertible
              firestoreValueAtKey = new Date(firestoreValueAtKey as string | number | Date).toISOString();
            } else {
              firestoreValueAtKey = null;
            }
          } catch (e) {
            firestoreValueAtKey = null; // Invalide ou non convertible, considérer comme différent
          }
        }

        if (String(sheetValue || '') !== String(firestoreValueAtKey || '')) {
          hasChanges = true;
          console.log(`[sync-installations][DEBUG] Changement détecté pour ${codeClient} sur le champ ${keyToCompare}: Sheet='${sheetValue}', Firestore='${firestoreValueAtKey}'`);
          break;
        }
      }

      if (hasChanges) {
        updates.push({ id: existing.id, ...installationData });
      }
    } else {
      adds.push(installationData);
    }
  }

  // Logique de suppression
  const firestoreInstallationsArray = Object.values(firestoreDataObj);
  const deletes: string[] = [];
  for (const firestoreInst of firestoreInstallationsArray) {
    if (firestoreInst.codeClient && !sheetCodeClients.has(String(firestoreInst.codeClient).trim())) {
      deletes.push(firestoreInst.id); 
    }
  }
  console.log(`[sync-installations] Secteur ${sector}: ${adds.length} ajouts, ${updates.length} mises à jour, ${deletes.length} suppressions`);
  if (adds.length > 0 || updates.length > 0 || deletes.length > 0) {
    const batch = db.batch();
    for (const add of adds) {
      const newDocRef = db.collection('installations').doc();
      batch.set(newDocRef, add);
    }
    for (const update of updates) {
      const { id, ...updateData } = update;
      const docRef = db.collection('installations').doc(id);
      batch.update(docRef, updateData);
    }
    for (const docIdToDelete of deletes) {
      const docRef = db.collection('installations').doc(docIdToDelete);
      batch.delete(docRef);
    }
    await batch.commit();
    console.log(`[sync-installations] Batch commit pour ${sector} effectué.`);
  } else {
    console.log(`[sync-installations] Aucune modification à appliquer pour ${sector}.`);
  }
  return { 
    added: adds.length, 
    updated: updates.length, 
    deleted: deletes.length
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
    await ensureFirebaseInitialized();
    console.log('[sync-installations] Firebase initialisé avec succès');
    
    console.log('[sync-installations] Récupération refresh token Google...');
    const refreshToken = await getGoogleRefreshTokenFromFirestore();
    if (!refreshToken) {
      throw new Error("Impossible de récupérer le refresh token Google pour la synchronisation Sheets.");
    }
    console.log('[sync-installations] Refresh token Google récupéré.');

    console.log('[sync-installations] Création du client OAuth2 Google...');
    const authClient = await getGoogleAuthClient({ googleRefreshToken: refreshToken });
    if (!authClient) {
      throw new Error("Impossible de créer le client OAuth2 Google pour la synchronisation Sheets.");
    }
    console.log('[sync-installations] Client OAuth2 Google créé avec succès.');
    
    const results: Record<string, any> = {};
    console.log('[sync-installations] Début synchronisation secteurs');
    
    for (const sector in SPREADSHEET_CONFIG) {
      const typedSector = sector as Sector;
      console.log(`[sync-installations] Synchronisation secteur ${typedSector}`);
      results[typedSector] = await syncSector(typedSector, SPREADSHEET_CONFIG[typedSector], authClient);
      console.log(`[sync-installations] Secteur ${typedSector} synchronisé:`, results[typedSector]);
    }
    
    console.log('[sync-installations] Synchronisation terminée avec succès', results);
    return json({ success: true, message: 'Synchronisation terminée avec succès', results });

  } catch (error: any) {
    console.error('[sync-installations] Erreur majeure lors de la synchronisation:', error);
    return json({ success: false, error: error.message || "Erreur inconnue de synchronisation" }, { status: 500 });
  }
}

interface SheetData {
  id?: string;
  codeClient: string;
  nom: string;
  ville: string;
  contact: string;
  telephone: string;
  commercial: string;
  dateInstall: string;
  tech: string;
  status: string;
  commentaire: string;
  secteur: string;
}

export async function syncInstallationsFromGoogleSheets() {
  console.warn("[sync-installations] syncInstallationsFromGoogleSheets EST OBSOLETE ET NE DEVRAIT PLUS ETRE APPELEE DIRECTEMENT PAR LE SCHEDULER. UTILISER LA ROUTE /api/sync-installations.");
  try {
    await ensureFirebaseInitialized();
    const refreshToken = await getGoogleRefreshTokenFromFirestore();
    if (!refreshToken) throw new Error("Refresh token manquant");
    const authClient = await getGoogleAuthClient({ googleRefreshToken: refreshToken });
    if (!authClient) throw new Error("Client OAuth2 manquant");

    const results: Record<string, any> = {};
    for (const sector in SPREADSHEET_CONFIG) {
      const typedSector = sector as Sector;
      results[typedSector] = await syncSector(typedSector, SPREADSHEET_CONFIG[typedSector], authClient);
    }
    return { success: true, results };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  // Cette route est POST-only pour la synchro, le loader peut retourner une simple info
  return json({ message: "Utilisez POST pour synchroniser les installations." });
}

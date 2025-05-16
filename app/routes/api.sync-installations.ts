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
import { getProcessedSlotsForTask, markSlotAsProcessedForTask } from "~/services/firestore.service.server";

// Helper function to parse date string from Google Sheet (JJ/MM/AAAA or JJ/MM)
function parseSheetDate(dateString: string | null | undefined): Date | null {
  if (!dateString) return null;

  let day: number, month: number, year: number | undefined;
  const parts = String(dateString).trim().split('/');

  if (parts.length === 2) { // JJ/MM
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1; // Month is 0-indexed in JavaScript Date
    year = new Date().getFullYear(); // Assume current year
  } else if (parts.length === 3) { // JJ/MM/AAAA or JJ/MM/AA
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    year = parseInt(parts[2], 10);
    if (year < 100) { // Handle 2-digit year, e.g., 24 -> 2024
      year += 2000;
    }
  } else {
    // If not JJ/MM or JJ/MM/AAAA, try standard new Date() parsing (e.g., for ISO dates)
    const d = new Date(dateString);
    if (!isNaN(d.getTime())) return d;
    console.warn(`[sync-installations] Unrecognized date format during string parsing: ${dateString}`);
    return null;
  }

  if (isNaN(day) || isNaN(month) || (year === undefined || isNaN(year))) { // Ensure year is checked if defined
    console.warn(`[sync-installations] Invalid date components from sheet string: ${dateString}`);
    return null;
  }

  const date = new Date(Date.UTC(year, month, day)); // Construct as UTC

  // Final validation to ensure the date constructor didn't overflow and components match UTC.
  if (date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day) {
    return date;
  }
  console.warn(`[sync-installations] Constructed UTC date from string ${date.toISOString()} mismatches parsed components for input: ${dateString}`);
  return null;
}

// Function to convert Google Sheet serial number to a UTC Date object
function convertGoogleSheetSerialNumberToDate(serial: number): Date | null {
  if (serial === undefined || serial === null) return null;
  // Google Sheets date serial number: days since 12/30/1899.
  // JavaScript's Date epoch: 01/01/1970.
  // Days between 12/30/1899 and 01/01/1970 (inclusive of 1900 leap day bug in Excel) is 25569.
  const utcMilliseconds = (serial - 25569) * 86400 * 1000;
  const date = new Date(utcMilliseconds); // This date is already UTC because milliseconds are epoch-based
  
  // Validate if the created date is reasonable (e.g. not too far in past/future if serial was off)
  if (isNaN(date.getTime())) {
    console.warn(`[sync-installations] Failed to convert serial number ${serial} to valid date.`);
    return null;
  }
  return date;
}

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
  console.log(`[sync-installations] Récupération données et formatage sheet ${spreadsheetId} avec client OAuth2`);
  const sheets = google.sheets({ version: 'v4', auth: authClient });
  try {
    // Modifié pour inclure les données de la grille (formatage)
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      ranges: [range], // Doit être un tableau de plages
      includeGridData: true,
    });
    // Extraire les données des lignes de la première feuille/plage retournée
    // La structure de la réponse est plus complexe ici
    if (response.data.sheets && response.data.sheets[0] && response.data.sheets[0].data && response.data.sheets[0].data[0]) {
      return response.data.sheets[0].data[0].rowData || [];
    }
    console.warn(`[sync-installations] Aucune donnée de ligne trouvée dans la réponse de la feuille de calcul pour ${spreadsheetId}`);
    return [];
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
  
  const [sheetRowData, firestoreDataObj] = await Promise.all([
    getSheetData(authClient, config.spreadsheetId, config.range),
    getAllInstallationsFromFirestore(db, sector)
  ]);

  if (!sheetRowData || sheetRowData.length === 0) {
    console.error(`[sync-installations] Aucune donnée sheet (rowData) pour ${sector}`);
    return { added: 0, updated: 0, deleted: 0, existingInFirestore: Object.keys(firestoreDataObj).length }; 
  }

  console.log(`[sync-installations] ${sheetRowData.length} rowData trouvées dans Google Sheet pour ${sector}`);

  const sheetCodeClients = new Set<string>();
  const updates: any[] = [];
  const adds: any[] = [];
  const sectorMapping = COLUMN_MAPPINGS[sector];
  const dateInstallColumnIndex = sectorMapping.dateInstall;

  for (const rowDataItem of sheetRowData) {
    if (!rowDataItem.values || rowDataItem.values.length === 0) {
      continue;
    }
    const rowValues = rowDataItem.values;

    const codeClientCell = rowValues[sectorMapping.codeClient];
    if (!codeClientCell || codeClientCell.formattedValue === undefined || codeClientCell.formattedValue === null) {
      console.warn(`[sync-installations] codeClient non trouvé ou vide pour une ligne du secteur ${sector}, saut.`);
      continue;
    }
    
    const codeClient = String(codeClientCell.formattedValue).trim();
    if (!codeClient) {
        console.warn(`[sync-installations] codeClient vide après trim pour une ligne du secteur ${sector}, saut.`);
        continue;
    }
    sheetCodeClients.add(codeClient);
    
    let newStatus: InstallationStatus = 'rendez-vous à prendre';
    let shouldFetchDateInstall = false;

    if (dateInstallColumnIndex !== undefined) {
      const dateInstallCell = rowValues[dateInstallColumnIndex];
      let colorType: 'RED' | 'GREEN' | 'WHITE_OR_NONE' | 'OTHER' = 'WHITE_OR_NONE';

      if (dateInstallCell && dateInstallCell.effectiveFormat && dateInstallCell.effectiveFormat.backgroundColor) {
        const bgColor = dateInstallCell.effectiveFormat.backgroundColor;
        const r = bgColor.red || 0;
        const g = bgColor.green || 0;
        const b = bgColor.blue || 0;

        if (r === 1 && g === 0 && b === 0) {
          colorType = 'RED';
        } else if (r === 0 && g === 1 && b === 0) {
          colorType = 'GREEN';
        } else if (r === 1 && g === 1 && b === 1) {
          colorType = 'WHITE_OR_NONE';
        } else if (Object.keys(bgColor).length === 0) { 
          colorType = 'WHITE_OR_NONE';
        } else {
          colorType = 'OTHER';
        }
      } else if (dateInstallCell) {
        colorType = 'WHITE_OR_NONE';
      }

      switch (colorType) {
        case 'GREEN':
          newStatus = 'rendez-vous pris';
          shouldFetchDateInstall = true;
          break;
        case 'RED':
          newStatus = 'rendez-vous à prendre';
          shouldFetchDateInstall = false;
          break;
        case 'WHITE_OR_NONE':
          newStatus = 'rendez-vous à prendre';
          shouldFetchDateInstall = true;
          break;
        case 'OTHER':
          newStatus = 'rendez-vous à prendre';
          shouldFetchDateInstall = false;
          break;
      }
    }
    
    const installationData: Record<string, any> = {
      secteur: sector, 
      codeClient: codeClient, 
      status: newStatus, 
    };

    for (const key in sectorMapping) {
      const columnIndex = sectorMapping[key];
      const cell = rowValues[columnIndex];
      
      if (key === 'dateInstall') {
        if (shouldFetchDateInstall && dateInstallColumnIndex !== undefined && rowValues[dateInstallColumnIndex]) {
          const dateCell = rowValues[dateInstallColumnIndex];
          let parsedDate: Date | null = null;

          if (dateCell?.effectiveValue?.numberValue !== undefined && dateCell?.effectiveValue?.numberValue !== null) {
            parsedDate = convertGoogleSheetSerialNumberToDate(dateCell.effectiveValue.numberValue);
            if (!parsedDate) {
               console.warn(`[sync-installations] Failed to convert serial ${dateCell.effectiveValue.numberValue} for dateInstall, client ${codeClient}`);
            }
          } else if (dateCell?.formattedValue) {
            parsedDate = parseSheetDate(String(dateCell.formattedValue));
            if (!parsedDate && dateCell.formattedValue) {
               console.warn(`[sync-installations] Failed to parse formattedValue ${dateCell.formattedValue} for dateInstall, client ${codeClient}`);
            }
          }
          
          if (parsedDate) {
            installationData[key] = parsedDate.toISOString();
          } else {
            installationData[key] = null;
            if (dateCell && (dateCell.effectiveValue?.numberValue || dateCell.formattedValue)) {
              console.warn(`[sync-installations] Final null for dateInstall after attempting parse, client ${codeClient}. Cell: ${JSON.stringify(dateCell)}`);
            }
          }
        } else {
          installationData[key] = null;
        }
      } else if (key === 'dateCdeMateriel' || key === 'dateSignatureCde') {
        let parsedDate: Date | null = null;
        const currentCell = cell; // cell is already defined as rowValues[columnIndex] for the current key

        if (currentCell?.effectiveValue?.numberValue !== undefined && currentCell?.effectiveValue?.numberValue !== null) {
            parsedDate = convertGoogleSheetSerialNumberToDate(currentCell.effectiveValue.numberValue);
            if (!parsedDate) {
               console.warn(`[sync-installations] Failed to convert serial ${currentCell.effectiveValue.numberValue} for ${key}, client ${codeClient}`);
            }
        } else if (currentCell?.formattedValue){
            parsedDate = parseSheetDate(String(currentCell.formattedValue));
            if (!parsedDate && currentCell.formattedValue) {
               console.warn(`[sync-installations] Failed to parse formattedValue ${currentCell.formattedValue} for ${key}, client ${codeClient}`);
            }
        }

        if (parsedDate) {
            installationData[key] = parsedDate.toISOString();
        } else {
            installationData[key] = null;
            if (currentCell && (currentCell.effectiveValue?.numberValue || currentCell.formattedValue)) {
              console.warn(`[sync-installations] Final null for ${key} after attempting parse, client ${codeClient}. Cell: ${JSON.stringify(currentCell)}`);
            }
        }
      } else if (key === 'telephone' && sector === 'tabac' && sectorMapping.coordonneesTel !== undefined) {
         const telCell = rowValues[sectorMapping.coordonneesTel];
         installationData['telephone'] = telCell && telCell.formattedValue ? telCell.formattedValue : '';
      } else if (key !== 'codeClient') {
        installationData[key] = cell ? cell.formattedValue : null;
      }
    }
    installationData.nom = installationData.nom || '';

    const existing = firestoreDataObj[codeClient];
    if (existing) {
      let hasChanges = false;
      for (const keyToCompare in installationData) {
        let sheetValue = installationData[keyToCompare];
        let firestoreValueAtKey = existing[keyToCompare];

        if (keyToCompare.startsWith('date')) {
          try {
            sheetValue = sheetValue ? new Date(sheetValue).toISOString() : null;
          } catch (e) {
            sheetValue = null;
          }
          
          try {
            if (firestoreValueAtKey && typeof (firestoreValueAtKey as any).toDate === 'function') {
              firestoreValueAtKey = (firestoreValueAtKey as any).toDate().toISOString();
            } else if (firestoreValueAtKey) {
              firestoreValueAtKey = new Date(firestoreValueAtKey as string | number | Date).toISOString();
            } else {
              firestoreValueAtKey = null;
            }
          } catch (e) {
            firestoreValueAtKey = null;
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

  const firestoreInstallationsArray = Object.values(firestoreDataObj);
  const deletes: string[] = [];
  const updatesToMarkAsTerminee: { id: string; status: InstallationStatus }[] = [];

  for (const firestoreInst of firestoreInstallationsArray) {
    if (firestoreInst.codeClient && !sheetCodeClients.has(String(firestoreInst.codeClient).trim())) {
      updatesToMarkAsTerminee.push({ id: firestoreInst.id, status: 'installation terminée' });
    }
  }
  console.log(`[sync-installations] Secteur ${sector}: ${adds.length} ajouts, ${updates.length} mises à jour (données), ${updatesToMarkAsTerminee.length} marquées comme terminées`);
  if (adds.length > 0 || updates.length > 0 || updatesToMarkAsTerminee.length > 0) {
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
    for (const updateTerminee of updatesToMarkAsTerminee) {
      const docRef = db.collection('installations').doc(updateTerminee.id);
      batch.update(docRef, { status: updateTerminee.status });
    }
    await batch.commit();
    console.log(`[sync-installations] Batch commit pour ${sector} effectué.`);
  } else {
    console.log(`[sync-installations] Aucune modification à appliquer pour ${sector}.`);
  }
  return { 
    added: adds.length, 
    updated: updates.length, 
    deleted: 0,
    markedAsTerminee: updatesToMarkAsTerminee.length
  };
}

const SYNC_INSTALLATIONS_TASK_NAME = 'sync-installations-google-sheets';
// Créneaux cibles en heure de Paris (Europe/Paris)
const TARGET_SLOTS_PARIS = ["09:00", "12:00", "17:00"]; 
const TARGET_TIMEZONE = "Europe/Paris";

export async function action({ request }: DataFunctionArgs) {
  console.log('[sync-installations] Vérification pour exécution de la synchronisation (déclenchée, fuseau Paris)...');
  
  if (request.method !== 'POST') {
    console.warn('[sync-installations] Méthode non autorisée reçue:', request.method);
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    await ensureFirebaseInitialized();

    // Obtenir l'heure actuelle à Paris
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: TARGET_TIMEZONE,
    });
    const parts = formatter.formatToParts(now);
    let currentHourParis = 0;
    let currentMinuteParis = 0;
    for (const part of parts) {
      if (part.type === 'hour') currentHourParis = parseInt(part.value);
      if (part.type === 'minute') currentMinuteParis = parseInt(part.value);
    }
    const currentTimeSlotParisString = `${String(currentHourParis).padStart(2, '0')}:${String(currentMinuteParis).padStart(2, '0')}`;
    
    // Obtenir la date actuelle en UTC pour l'utiliser comme clé dans Firestore (pour la cohérence du jour)
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    let slotToProcessIdentifier: string | null = null; // e.g., "09:00_Europe/Paris"

    for (const targetSlot of TARGET_SLOTS_PARIS) {
      const [targetHour, targetMinute] = targetSlot.split(':').map(Number);
      // Vérifier si l'heure actuelle de Paris est dans l'heure du créneau cible
      if (currentHourParis === targetHour) {
        slotToProcessIdentifier = `${targetSlot}_${TARGET_TIMEZONE.replace("/", "-")}`;
        break;
      }
    }

    if (!slotToProcessIdentifier) {
      console.log(`[sync-installations] Hors créneau (Paris). Actuel Paris: ${currentTimeSlotParisString}. Créneaux cibles: ${TARGET_SLOTS_PARIS.join(', ')}.`);
      return json({ success: true, message: 'Hors créneau (Paris), aucune action.', details: `Current Paris time: ${currentTimeSlotParisString}` });
    }

    console.log(`[sync-installations] Créneau pertinent détecté (Paris): ${slotToProcessIdentifier}`);

    const processedSlotsToday = await getProcessedSlotsForTask(SYNC_INSTALLATIONS_TASK_NAME, todayUtc);
    if (processedSlotsToday.includes(slotToProcessIdentifier)) {
      console.log(`[sync-installations] Le créneau ${slotToProcessIdentifier} a déjà été traité pour la date UTC ${todayUtc.toISOString().split('T')[0]}.`);
      return json({ success: true, message: `Créneau ${slotToProcessIdentifier} déjà traité.` });
    }

    console.log(`[sync-installations] Début de la synchronisation pour le créneau ${slotToProcessIdentifier}`);
    
    // ----- Logique de synchronisation existante (inchangée) -----
    console.log('[sync-installations] Récupération refresh token Google...');
    const refreshToken = await getGoogleRefreshTokenFromFirestore();
    if (!refreshToken) throw new Error("Impossible de récupérer le refresh token Google.");
    const authClient = await getGoogleAuthClient({ googleRefreshToken: refreshToken });
    if (!authClient) throw new Error("Impossible de créer le client OAuth2 Google.");
    
    const results: Record<string, any> = {};
    for (const sector in SPREADSHEET_CONFIG) {
      const typedSector = sector as Sector;
      results[typedSector] = await syncSector(typedSector, SPREADSHEET_CONFIG[typedSector], authClient);
    }
    // ----- Fin de la logique de synchronisation -----
    
    await markSlotAsProcessedForTask(SYNC_INSTALLATIONS_TASK_NAME, todayUtc, slotToProcessIdentifier);
    
    console.log(`[sync-installations] Synchronisation pour ${slotToProcessIdentifier} terminée.`, results);
    return json({ success: true, message: `Synchronisation pour ${slotToProcessIdentifier} terminée.`, results });

  } catch (error: any) {
    console.error('[sync-installations] Erreur majeure lors de la synchronisation (déclenchée, Paris):', error);
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

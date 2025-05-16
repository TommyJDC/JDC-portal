import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue, Firestore } from 'firebase-admin/firestore';
import { google, sheets_v4 } from 'googleapis';
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
export const SPREADSHEET_CONFIG: SpreadsheetConfig = {
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
    dateCdeMateriel: 1,
    codeClient: 3,
    nom: 4,
    ville: 5,
    telephone: 6,
    commercial: 7,
    cdc: 9,
    integrationJalia: 10,
    dossier: 11,
    tech: 12,
    dateInstall: 13,
    heure: 14,
    commentaireTech: 16,
    materielLivre: 17,
    commentaireEnvoiBT: 18,
    techSecu: 20,
    techAffecte: 21
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

let db: Firestore;

async function ensureFirebaseInitialized() {
  if (!db) {
    db = getDb();
  }
  return db;
}

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
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      ranges: [range],
      includeGridData: true,
    });
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

export async function syncSector(sector: Sector, config: { spreadsheetId: string; range: string }, authClient: any) {
  const db = await ensureFirebaseInitialized();
  const sheetData = await getSheetData(authClient, config.spreadsheetId, config.range);
  const existingInstallations = await getAllInstallationsFromFirestore(db, sector);
  
  // Process each row from the sheet
  for (const row of sheetData) {
    if (!row.values) continue;
    
    const values = row.values.map(v => v.formattedValue || '');
    const codeClient = values[COLUMN_MAPPINGS[sector].codeClient];
    
    if (!codeClient) continue;
    
    const installation: Partial<Installation> = {
      codeClient,
      nom: values[COLUMN_MAPPINGS[sector].nom] || '',
      ville: values[COLUMN_MAPPINGS[sector].ville] || '',
      secteur: sector,
      dateInstall: parseSheetDate(values[COLUMN_MAPPINGS[sector].dateInstall])?.toISOString() || undefined,
      tech: values[COLUMN_MAPPINGS[sector].tech] || '',
      status: 'pending' as InstallationStatus,
      lastSync: new Date().toISOString()
    };
    
    if (existingInstallations[codeClient]) {
      await db.collection('installations').doc(existingInstallations[codeClient].id).update(installation);
    } else {
      await db.collection('installations').add(installation);
    }
  }
}

export async function syncAllSectors() {
  try {
    const refreshToken = await getGoogleRefreshTokenFromFirestore();
    const authClient = await getGoogleAuthClient(refreshToken);
    
    for (const [sector, config] of Object.entries(SPREADSHEET_CONFIG)) {
      await syncSector(sector as Sector, config, authClient);
    }
    
    return { success: true, message: 'Synchronisation terminée avec succès' };
  } catch (error) {
    console.error('Erreur lors de la synchronisation:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Erreur inconnue' };
  }
} 
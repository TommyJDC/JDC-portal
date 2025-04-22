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

const COLUMN_MAPPINGS: ColumnMappings = {
  chr: {
    dateCdeMateriel: 2,
    codeClient: 4,
    nom: 5,
    ville: 6,
    telephone: 7,
    commercial: 8,
    configCaisse: 9,
    cdc: 10,
    integrationJalia: 11,
    dossier: 12,
    tech: 13,
    dateInstall: 14,
    heure: 15,
    commentaireTech: 17,
    materielLivre: 18,
    commentaireEnvoiBT: 19,
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

async function initializeFirebaseAdmin() {
  try {
    const app = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      })
    });
    
    return getFirestore(app);
  } catch (error: unknown) {
    if (error instanceof Error && 'code' in error && error.code === 'app/duplicate-app') {
      return getFirestore(require('firebase-admin/app').getApps()[0]);
    }
    throw error;
  }
}

async function getSheetData(auth: any, spreadsheetId: string, range: string) {
  const sheets = google.sheets({ version: 'v4', auth });
  try {
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    return response.data.values || [];
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error(`Error fetching sheet data for ${spreadsheetId}:`, err.message);
    }
    return [];
  }
}

async function getGoogleSheetsAuth(db: Firestore) {
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
  const snapshot = await db.collection('installations').where('secteur', '==', sector).get();
  const installations: Record<string, { id: string; [key: string]: unknown }> = {};
  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.codeClient) installations[data.codeClient] = { id: doc.id, ...data };
  });
  return installations;
}

async function syncSector(db: Firestore, sector: Sector, config: { spreadsheetId: string; range: string }, auth: any) {
  const [sheetData, firestoreData] = await Promise.all([
    getSheetData(auth, config.spreadsheetId, config.range),
    getAllInstallationsFromFirestore(db, sector)
  ]);

  if (!sheetData) {
    console.error(`Failed to fetch sheet data for ${sector}`);
    return { added: 0, updated: 0, terminated: 0 };
  }

  const sheetCodeClients = new Set();
  const updates: any[] = [];
  const adds: any[] = [];
  const sectorMapping = COLUMN_MAPPINGS[sector];

  for (const row of sheetData) {
    const codeClient = row[sectorMapping.codeClient];
    if (!codeClient) continue;
    
    sheetCodeClients.add(codeClient);
    const installationData = {
      secteur: sector,
      status: 'rendez-vous à prendre',
      nom: row[sectorMapping.nom] || '',
      ville: row[sectorMapping.ville] || '',
      telephone: row[sectorMapping.telephone] || '',
      commercial: row[sectorMapping.commercial] || '',
      dateCdeMateriel: row[sectorMapping.dateCdeMateriel] || null,
      codeClient,
    };

    // Add sector-specific fields...

    const existing = firestoreData[codeClient];
    if (existing) {
      // Check for updates...
    } else {
      adds.push(installationData);
    }
  }

  // Process updates, adds and terminations...
  // Return sync statistics
  return { 
    added: adds.length, 
    updated: updates.length, 
    terminated: Object.keys(firestoreData).length 
  };
}

export async function action({ request }: DataFunctionArgs) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    if (!db) db = await initializeFirebaseAdmin();
    const auth = await getGoogleSheetsAuth(db);
    
    const results: Record<string, any> = {};
  for (const sector in SPREADSHEET_CONFIG) {
    const typedSector = sector as Sector;
    results[typedSector] = await syncSector(db, typedSector, SPREADSHEET_CONFIG[typedSector], auth);
  }

    return json({ success: true, results });
  } catch (error: any) {
    console.error('Sync error:', error);
    return json({ error: error.message }, { status: 500 });
  }
}

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { google } = require('googleapis');

// --- Configuration ---
// TODO: Charger les credentials Firebase depuis les variables d'environnement ou un fichier sécurisé
// const serviceAccount = require('./path/to/your/firebase-service-account-key.json');
// TODO: Charger les credentials Google Sheets depuis les variables d'environnement ou un fichier sécurisé
// const keys = require('./path/to/your/google-sheets-api-credentials.json');

// TODO: Définir les Spreadsheet IDs et les plages pour chaque secteur
const SPREADSHEET_CONFIG = {
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

// TODO: Définir le mapping des colonnes du spreadsheet vers les champs Firestore
// Exemple: { 0: 'codeClient', 1: 'nom', 2: 'ville', ... }
const COLUMN_MAPPINGS = {
  chr: {
    dateCdeMateriel: 0,
    codeClient: 1,
    nom: 2,
    ville: 3,
    telephone: 4,
    commercial: 5,
    configCaisse: 6,
    cdc: 7,
    dossier: 8,
    tech: 9,
    dateInstall: 10,
    heureRelance: 11,
    commentaireTech: 12,
    materielLivre: 13,
    commentaireEnvoiBT: 14,
    techSecu: 15,
    techAffecte: 16
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
  // Les champs 'tech' et 'dateInstall' sont souvent mis à jour depuis l'appli,
  // décidez si vous voulez les écraser depuis le sheet ou les ignorer ici.
  // tech: 12,
  // dateInstall: 13,
};

// --- Initialisation ---
let db;
try {
  // Initialiser Firebase Admin (une seule fois)
  // Assurez-vous que GOOGLE_APPLICATION_CREDENTIALS est défini dans l'environnement Netlify
  // ou chargez les credentials manuellement avec cert()
  initializeApp();
  db = getFirestore();
} catch (e) {
  // Gérer le cas où l'app est déjà initialisée (peut arriver lors des reloads locaux)
  if (e.code !== 'app/duplicate-app') {
    console.error('Firebase Admin initialization error:', e);
  }
  if (!db) db = getFirestore(); // Obtenir l'instance existante
}

const installationsCollection = db.collection('installations');

// --- Fonctions Google Sheets ---
async function getSheetData(auth, spreadsheetId, range) {
  const sheets = google.sheets({ version: 'v4', auth });
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    return response.data.values || []; // Retourne un tableau vide si pas de données
  } catch (err) {
    console.error(`Error fetching sheet data for ${spreadsheetId}: ${err.message}`);
    // Gérer les erreurs spécifiques (ex: 403 permission denied, 404 not found)
    if (err.code === 403) {
        console.error('Permission denied. Check API key/OAuth scope and sheet sharing settings.');
    } else if (err.code === 404) {
        console.error(`Spreadsheet ${spreadsheetId} or range ${range} not found.`);
    }
    return []; // Retourne un tableau vide en cas d'erreur pour ne pas bloquer les autres secteurs
  }
}

// --- Fonctions Firestore ---
async function getAllInstallationsFromFirestore(sector) {
  const snapshot = await installationsCollection.where('secteur', '==', sector).get();
  const installations = {};
  snapshot.forEach(doc => {
    // Utiliser un identifiant unique (comme codeClient) comme clé pour un accès rapide
    const data = doc.data();
    if (data.codeClient) {
      installations[data.codeClient] = { id: doc.id, ...data };
    } else {
        console.warn(`Document ${doc.id} in sector ${sector} is missing codeClient.`);
    }
  });
  return installations;
}

// --- Logique de Synchronisation ---
async function syncSector(sector, config, auth) {
  console.log(`Starting sync for sector: ${sector}...`);

  const [sheetData, firestoreData] = await Promise.all([
    getSheetData(auth, config.spreadsheetId, config.range),
    getAllInstallationsFromFirestore(sector)
  ]);

  if (!sheetData) {
    console.error(`Failed to fetch sheet data for ${sector}. Skipping sync.`);
    return;
  }

  console.log(`Fetched ${sheetData.length} rows from Sheet for ${sector}.`);
  console.log(`Fetched ${Object.keys(firestoreData).length} installations from Firestore for ${sector}.`);

  const sheetCodeClients = new Set();
  const updates = []; // Batch updates
  const adds = [];    // Batch adds (ou opérations individuelles)

  // 1. Parcourir les données du Spreadsheet
  for (const row of sheetData) {
    const sectorMapping = COLUMN_MAPPINGS[sector];
    const codeClient = row[sectorMapping.codeClient];

    if (!codeClient) {
      console.warn(`Skipping row with missing codeClient in ${sector}:`, row);
      continue;
    }
    sheetCodeClients.add(codeClient);

    const installationSheetData = {
      secteur: sector,
      status: 'rendez-vous à prendre',
      // Mapper les colonnes selon le mapping spécifique au secteur
      nom: row[sectorMapping.nom] || '',
      ville: row[sectorMapping.ville] || '',
      telephone: row[sectorMapping.telephone] || '',
      commercial: row[sectorMapping.commercial] || '',
      dateCdeMateriel: row[sectorMapping.dateCdeMateriel] || null,
      codeClient: codeClient,
    };

    // Ajouter les champs spécifiques à chaque secteur
    if (sector === 'chr') {
      installationSheetData.configCaisse = row[sectorMapping.configCaisse] || '';
      installationSheetData.cdc = row[sectorMapping.cdc] || '';
      installationSheetData.dossier = row[sectorMapping.dossier] || '';
      installationSheetData.tech = row[sectorMapping.tech] || '';
      installationSheetData.dateInstall = row[sectorMapping.dateInstall] || null;
      installationSheetData.commentaireTech = row[sectorMapping.commentaireTech] || '';
      installationSheetData.materielLivre = row[sectorMapping.materielLivre] || '';
    } else if (sector === 'haccp') {
      installationSheetData.materielPreParametrage = row[sectorMapping.materielPreParametrage] || '';
      installationSheetData.dossier = row[sectorMapping.dossier] || '';
      installationSheetData.commentaire = row[sectorMapping.commentaire] || '';
      installationSheetData.materielLivre = row[sectorMapping.materielLivre] || '';
      installationSheetData.identifiantMotDePasse = row[sectorMapping.identifiantMotDePasse] || '';
    } else if (sector === 'tabac') {
      installationSheetData.materielBalance = row[sectorMapping.materielBalance] || '';
      installationSheetData.offreTpe = row[sectorMapping.offreTpe] || '';
      installationSheetData.cdc = row[sectorMapping.cdc] || '';
      installationSheetData.typeInstall = row[sectorMapping.typeInstall] || '';
      installationSheetData.commentaireEtatMateriel = row[sectorMapping.commentaireEtatMateriel] || '';
    } else if (sector === 'kezia') {
      installationSheetData.configCaisse = row[sectorMapping.configCaisse] || '';
      installationSheetData.cdc = row[sectorMapping.cdc] || '';
      installationSheetData.dossier = row[sectorMapping.dossier] || '';
      // Ne pas écraser tech et dateInstall par défaut depuis le sheet
      // installationSheetData.tech = row[sectorMapping.tech] || '';
      // installationSheetData.dateInstall = row[sectorMapping.dateInstall] || null;
    }

    const existingFirestore = firestoreData[codeClient];

    if (existingFirestore) {
      // Installation existante: vérifier les mises à jour nécessaires
      let needsUpdate = false;
      const updatePayload = {};

      for (const key in installationSheetData) {
        // Comparer les champs pertinents (ignorer les timestamps, id, et potentiellement status, tech, dateInstall)
        if (key !== 'id' && key !== 'createdAt' && key !== 'updatedAt' && key !== 'status' && key !== 'tech' && key !== 'dateInstall') {
          // Comparaison simple, à affiner si nécessaire (ex: pour les dates)
          if (installationSheetData[key] !== existingFirestore[key]) {
            updatePayload[key] = installationSheetData[key];
            needsUpdate = true;
          }
        }
      }
       // Si le statut dans Firestore est 'terminée', ne pas le repasser à 'à prendre'
       // sauf si une logique spécifique le demande.
       if (existingFirestore.status === 'installation terminée') {
           // On pourrait logguer si une installation terminée réapparaît dans le sheet
           console.log(`Installation ${codeClient} (Terminée) found in sheet for ${sector}. No status change applied.`);
       } else {
           // Si l'installation n'est pas terminée, on peut envisager de mettre à jour
           // son statut si nécessaire, mais la logique par défaut est de le laisser tel quel
           // ou de le mettre à 'rendez-vous à prendre' si on considère le sheet comme source principale
           // pour les installations *actives*. Ici, on ne met pas à jour le statut depuis le sheet.
       }


      if (needsUpdate) {
        console.log(`Scheduling update for ${codeClient} in ${sector}`);
        updates.push({ id: existingFirestore.id, payload: updatePayload });
      }
      // Marquer comme traité pour l'étape 3
      delete firestoreData[codeClient];

    } else {
      // Nouvelle installation: ajouter à Firestore
      console.log(`Scheduling add for new installation ${codeClient} in ${sector}`);
      // Ajouter directement ou via batch (addInstallation n'est pas conçu pour batch)
      adds.push(installationSheetData);
    }
  }

  // 2. Identifier les installations à marquer comme "terminées"
  // Celles qui restent dans firestoreData n'étaient pas dans le sheet actuel
  const terminations = [];
  for (const codeClient in firestoreData) {
    const installation = firestoreData[codeClient];
    // Ne marquer comme terminée que si elle ne l'est pas déjà
    if (installation.status !== 'installation terminée') {
      console.log(`Scheduling termination for ${codeClient} in ${sector} (not found in sheet)`);
      terminations.push({ id: installation.id, payload: { status: 'installation terminée' } });
    }
  }

  // 3. Exécuter les opérations Firestore (idéalement en batch)
  const batch = db.batch();
  let operationCount = 0;

  updates.forEach(op => {
    if (operationCount < 490) { // Limite Firestore batch = 500 opérations
      const docRef = installationsCollection.doc(op.id);
      batch.update(docRef, { ...op.payload, updatedAt: FieldValue.serverTimestamp() });
      operationCount++;
    } else {
        console.warn(`Batch limit reached for updates in ${sector}. Some updates might be skipped.`);
    }
  });

  terminations.forEach(op => {
     if (operationCount < 490) {
        const docRef = installationsCollection.doc(op.id);
        batch.update(docRef, { ...op.payload, updatedAt: FieldValue.serverTimestamp() });
        operationCount++;
     } else {
         console.warn(`Batch limit reached for terminations in ${sector}. Some terminations might be skipped.`);
     }
  });

  // Gérer les ajouts (ne peuvent pas être dans le même batch que les updates/deletes)
  // Exécuter les ajouts individuellement pour l'instant
  for (const addData of adds) {
      try {
          await installationsCollection.add({
              ...addData,
              createdAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
          });
      } catch(error) {
          console.error(`Error adding installation ${addData.codeClient} for sector ${sector}:`, error);
      }
  }


  try {
    if (operationCount > 0) {
        await batch.commit();
        console.log(`Successfully committed ${operationCount} updates/terminations for ${sector}.`);
    } else {
        console.log(`No updates or terminations to commit for ${sector}.`);
    }
    console.log(`Finished sync for sector: ${sector}. Added: ${adds.length}, Updated: ${updates.length}, Terminated: ${terminations.length}`);

  } catch (error) {
    console.error(`Error committing batch for ${sector}:`, error);
  }
}


// --- Handler Netlify ---
exports.handler = async (event, context) => {
  console.log("Starting Installations Sync Function...");

  // TODO: Sécuriser l'exécution (ex: vérifier un secret, l'origine de l'appel)

  try {
    // Authentification avec le compte Tommy VILMEN
    const db = getFirestore();
    const userDoc = await db.collection('users').doc('105906689661054220398').get();
    if (!userDoc.exists) {
      throw new Error('User 105906689661054220398 not found in Firestore');
    }
    const userData = userDoc.data();
    
    const auth = new google.auth.OAuth2({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    });
    
    auth.setCredentials({
      refresh_token: userData.googleRefreshToken,
      scope: userData.gmailAuthorizedScopes.join(' '),
      token_type: 'Bearer',
    });
    
    const authClient = await auth.getClient();

    // Synchroniser chaque secteur
    for (const sector in SPREADSHEET_CONFIG) {
      await syncSector(sector, SPREADSHEET_CONFIG[sector], authClient);
    }

    console.log("Installations Sync Function finished successfully.");
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Synchronization finished successfully." }),
    };
  } catch (error) {
    console.error("Error during synchronization process:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Synchronization failed.", error: error.message }),
    };
  }
};

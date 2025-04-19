const { getFirestore } = require('firebase-admin/firestore');
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

// Configuration
const KEZIA_SPREADSHEET_ID = "1uzzHN8tzc53mOOpH8WuXJHIUsk9f17eYc0qsod-Yryk";
const KEZIA_SHEET_NAME = "EN COURS";

// Initialize Firebase Admin if not already initialized
if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  initializeApp({
    credential: cert(serviceAccount)
  });
}

// Function to get Google Sheets client
async function getGoogleSheetsClient() {
  const serviceAccountAuth = new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
    ],
  });

  const doc = new GoogleSpreadsheet(KEZIA_SPREADSHEET_ID, serviceAccountAuth);
  await doc.loadInfo();
  return doc;
}

// Function to create a notification
async function createNotification(db, notification) {
  const notificationsRef = db.collection('notifications');
  await notificationsRef.add({
    ...notification,
    timestamp: new Date(),
    read: false
  });
}

exports.handler = async function(event, context) {
  try {
    // Get Firestore instance
    const db = getFirestore();

    // Get Google Sheets client
    const doc = await getGoogleSheetsClient();
    const sheet = doc.sheetsByTitle[KEZIA_SHEET_NAME];
    await sheet.loadCells();

    // Get all rows
    const rows = await sheet.getRows();

    // Get known installations
    const knownInstallationsRef = db.collection('kezia-installations');
    const knownInstallationsSnapshot = await knownInstallationsRef.get();
    const knownInstallations = new Set(knownInstallationsSnapshot.docs.map(doc => doc.id));

    // Check for new installations
    const batch = db.batch();
    let newInstallationsCount = 0;

    for (const row of rows) {
      const codeClient = row.get('CODE CLIENT');
      if (!codeClient || knownInstallations.has(codeClient)) {
        continue;
      }

      // New installation found
      newInstallationsCount++;
      const nom = row.get('NOM') || 'Client inconnu';

      // Add to known installations
      const docRef = knownInstallationsRef.doc(codeClient);
      batch.set(docRef, {
        dateAjout: new Date(),
        nom: nom
      });

      // Create notification for all users with admin role
      const adminUsersSnapshot = await db.collection('user-profiles')
        .where('role', '==', 'Admin')
        .get();

      for (const adminUser of adminUsersSnapshot.docs) {
        await createNotification(db, {
          type: 'info',
          title: 'Nouvelle installation Kezia',
          message: `Nouvelle installation ajoutée pour ${nom} (${codeClient})`,
          link: '/installations/kezia',
          userId: adminUser.id
        });
      }
    }

    // Commit all changes
    await batch.commit();

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: `Vérification terminée. ${newInstallationsCount} nouvelles installations trouvées.`
      })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

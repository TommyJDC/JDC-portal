import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

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
  } catch (error) {
    if (error.code === 'app/duplicate-app') {
    const apps = getApps();
    const app = apps.length ? apps[0] : null;
    if (app) {
        return getFirestore(app);
      }
    }
    console.error('Firebase Admin initialization error:', error);
    throw error;
  }
}

let db;

// Fonction pour obtenir les utilisateurs notifiables
async function getNotifiableUsers() {
  console.log('[sap-notifications] Récupération des utilisateurs notifiables');
  const usersRef = db.collection('users');
  const snapshot = await usersRef
    .where('role', 'in', ['Admin', 'Technician'])
    .get();
  
  const users = snapshot.docs.map(doc => ({
    ...doc.data(),
    uid: doc.id,
  }));
  console.log(`[sap-notifications] ${users.length} utilisateurs notifiables trouvés`);
  return users;
}

// Créer une notification
async function createNotification(notification) {
  console.log('[sap-notifications] Création de notification:', {
    userId: notification.userId,
    type: notification.type,
    sourceId: notification.sourceId
  });
  try {
    const notificationData = {
      ...notification,
      timestamp: new Date(),
      read: false
    };

    const notificationRef = await db.collection('notifications').add(notificationData);
    console.log('[sap-notifications] Notification créée avec ID:', notificationRef.id);
    return true;
  } catch (error) {
    console.error('Erreur lors de la création de la notification:', error);
    return false;
  }
}

// Notifier pour un nouveau ticket SAP
async function notifyNewSapTicket(ticket) {
  console.log('[sap-notifications] Notification nouveau ticket SAP:', {
    ticketId: ticket.id,
    secteur: ticket.secteur,
    client: ticket.raisonSociale || ticket.client
  });
  try {
    const users = await getNotifiableUsers();
    
    const notificationPromises = users.map(user => {
      if (user.secteurs.includes(ticket.secteur)) {
        return createNotification({
          userId: user.uid,
          title: `Nouveau ticket SAP - ${ticket.secteur}`,
          message: `${ticket.raisonSociale || ticket.client} - ${ticket.description}`,
          type: 'ticket',
          sourceId: ticket.id,
          link: `/tickets-sap?id=${ticket.id}`
        });
      }
      return null;
    });

    const results = await Promise.all(notificationPromises.filter(Boolean));
    console.log('[sap-notifications] Notifications SAP envoyées:', results.filter(Boolean).length);
    return true;
  } catch (error) {
    console.error('Erreur lors de la notification du nouveau ticket SAP:', error);
    return false;
  }
}

// Notifier pour un nouvel envoi CTN
async function notifyNewCTN(shipment) {
  console.log('[sap-notifications] Notification nouvel envoi CTN:', {
    shipmentId: shipment.id,
    secteur: shipment.secteur,
    client: shipment.nomClient
  });
  try {
    const users = await getNotifiableUsers();
    
    const notificationPromises = users.map(user => {
      if (user.secteurs.includes(shipment.secteur)) {
        return createNotification({
          userId: user.uid,
          title: `Nouvel envoi CTN - ${shipment.secteur}`,
          message: `${shipment.nomClient} - ${shipment.ville}`,
          type: 'shipment',
          sourceId: shipment.id,
          link: `/envois-ctn?id=${shipment.id}`
        });
      }
      return null;
    });

    const results = await Promise.all(notificationPromises.filter(Boolean));
    console.log('[sap-notifications] Notifications CTN envoyées:', results.filter(Boolean).length);
    return true;
  } catch (error) {
    console.error('Erreur lors de la notification du nouvel envoi CTN:', error);
    return false;
  }
}

// --- Ajout logique notification SAP depuis Firestore installations ---
async function notifySapFromInstallations() {
  console.log('[sap-notifications] Début notification depuis installations');
  if (!db) {
    db = await initializeFirebaseAdmin();
  }
  // Récupérer toutes les installations, tous secteurs confondus
  const snapshot = await db.collection('installations').get();
  let notified = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.status === 'rendez-vous pris' && !data.sapNotificationSent) {
      await notifyNewSapTicket({
        id: doc.id,
        secteur: data.secteur,
        raisonSociale: data.nom,
        client: data.codeClient,
        description: data.commentaire || '',
      });
      await doc.ref.update({ sapNotificationSent: true });
      notified++;
    }
  }
  console.log(`[sap-notifications] ${notified} notifications SAP envoyées depuis installations`);
  return notified;
}

export const handler = async (event) => {
  console.log('[sap-notifications] Handler appelé:', {
    method: event.httpMethod,
    path: event.path,
    query: event.queryStringParameters
  });
  try {
    if (!db) {
      db = await initializeFirebaseAdmin();
    }

    // Gérer le cas spécial GET avec fromInstallations
    if (event.httpMethod === 'GET' && event.queryStringParameters?.fromInstallations) {
      try {
        const count = await notifySapFromInstallations();
        return {
          statusCode: 200,
          body: JSON.stringify({ message: `Notifications SAP envoyées depuis installations: ${count}` })
        };
      } catch (error) {
        console.error('Erreur lors de la notification depuis installations:', error);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: error.message })
        };
      }
    }

    // Gérer les événements Firestore (POST)
    if (event.httpMethod === 'POST' && event.body) {
      const data = JSON.parse(event.body);
      
      // Si c'est un nouveau ticket SAP
      if (data.collection === 'tickets-sap' && data.type === 'created') {
        await notifyNewSapTicket(data.document);
      }
      
      // Si c'est un nouvel envoi CTN
      if (data.collection === 'envois-ctn' && data.type === 'created') {
        await notifyNewCTN(data.document);
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Notifications traitées avec succès' })
      };
    }
    
    // Si la requête ne correspond à aucun cas géré
    return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Requête non supportée ou corps manquant' })
    };
  } catch (error) {
    console.error('Erreur dans la fonction de notification:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Erreur lors du traitement des notifications' })
    };
  }
};

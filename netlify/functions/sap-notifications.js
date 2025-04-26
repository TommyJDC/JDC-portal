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

// Créer une notification (modifiée pour la nouvelle structure)
async function createNotification(notificationData) {
  console.log('[sap-notifications] Création de notification:', {
    type: notificationData.type,
    sector: notificationData.sector,
    targetRoles: notificationData.targetRoles,
    sourceId: notificationData.metadata?.ticketId || notificationData.metadata?.shipmentId || notificationData.metadata?.installationId
  });
  try {
    const notificationToSave = {
      ...notificationData,
      createdAt: new Date(), // Utiliser Date pour la création
      read: false, // Les nouvelles notifications sont non lues par défaut
    };

    const notificationRef = await db.collection('notifications').add(notificationToSave);
    console.log('[sap-notifications] Notification créée avec ID:', notificationRef.id);
    return true;
  } catch (error) {
    console.error('Erreur lors de la création de la notification:', error);
    return false;
  }
}

// Notifier pour un nouveau ticket SAP (modifiée)
async function notifyNewSapTicket(ticket) {
  console.log('[sap-notifications] Notification nouveau ticket SAP:', {
    ticketId: ticket.id,
    secteur: ticket.secteur,
    client: ticket.raisonSociale || ticket.client
  });
  try {
    // Créer une seule notification pour cet événement
    const notificationData = {
      type: 'ticket_created',
      sector: [ticket.secteur], // Cibler le secteur du ticket
      targetRoles: ['Admin', 'Technician'], // Cibler les Admins et Techniciens
      message: `Nouveau ticket SAP (${ticket.secteur}) - ${ticket.raisonSociale || ticket.client} - ${ticket.description}`,
      metadata: { ticketId: ticket.id },
      link: `/tickets-sap?id=${ticket.id}`
    };

    await createNotification(notificationData);

    console.log('[sap-notifications] Notification nouveau ticket SAP envoyée.');
    return true;
  } catch (error) {
    console.error('Erreur lors de la notification du nouveau ticket SAP:', error);
    return false;
  }
}

// Notifier pour un nouvel envoi CTN (modifiée)
async function notifyNewCTN(shipment) {
  console.log('[sap-notifications] Notification nouvel envoi CTN:', {
    shipmentId: shipment.id,
    secteur: shipment.secteur,
    client: shipment.nomClient
  });
  try {
    // Créer une seule notification pour cet événement
    const notificationData = {
      type: 'shipment',
      sector: [shipment.secteur], // Cibler le secteur de l'envoi
      targetRoles: ['Admin', 'Logistics'], // Cibler les Admins et Logistique
      message: `Nouvel envoi CTN (${shipment.secteur}) - ${shipment.nomClient} - ${shipment.ville}`,
      metadata: { shipmentId: shipment.id },
      link: `/envois-ctn?id=${shipment.id}`
    };

    await createNotification(notificationData);

    console.log('[sap-notifications] Notification nouvel envoi CTN envoyée.');
    return true;
  } catch (error) {
    console.error('Erreur lors de la notification du nouvel envoi CTN:', error);
    return false;
  }
}

// Notifier pour la clôture d'un ticket SAP (nouvelle fonction)
async function notifyClosedSapTicket(ticket) {
  console.log('[sap-notifications] Notification clôture ticket SAP:', {
    ticketId: ticket.id,
    secteur: ticket.secteur,
    client: ticket.raisonSociale || ticket.client
  });
  try {
    const notificationData = {
      type: 'ticket_closed',
      sector: [ticket.secteur],
      targetRoles: ['Admin', 'Technician'],
      message: `Ticket SAP clôturé (${ticket.secteur}) - ${ticket.raisonSociale || ticket.client} - ${ticket.description}`,
      metadata: { ticketId: ticket.id },
      link: `/tickets-sap?id=${ticket.id}`
    };
    await createNotification(notificationData);
    console.log('[sap-notifications] Notification clôture ticket SAP envoyée.');
    return true;
  } catch (error) {
    console.error('Erreur lors de la notification de clôture ticket SAP:', error);
    return false;
  }
}


// --- Ajout logique notification SAP depuis Firestore installations (modifiée) ---
async function notifySapFromInstallations() {
  console.log('[sap-notifications] Début notification depuis installations');
  if (!db) {
    db = await initializeFirebaseAdmin();
  }

  // Récupérer toutes les installations, tous secteurs confondus
  const snapshot = await db.collection('installations').get();
  let notifiedCount = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    // Notification pour nouvelle installation (status 'rendez-vous pris' et pas encore notifié)
    if (data.status === 'rendez-vous pris' && !data.sapNotificationSent) {
      const notificationData = {
        type: 'installation',
        sector: [data.secteur],
        targetRoles: ['Admin', 'Technician'], // Cibler Admins et Techniciens pour les nouvelles installations
        message: `Nouvelle installation (${data.secteur}) - ${data.nom || data.codeClient} - ${data.commentaire || 'Rendez-vous pris'}`,
        metadata: { installationId: doc.id },
        link: `/installations/${data.secteur.toLowerCase()}-firestore?id=${doc.id}` // Lien vers l'installation (ajuster si nécessaire)
      };
      await createNotification(notificationData);
      await doc.ref.update({ sapNotificationSent: true }); // Marquer comme notifié
      notifiedCount++;
    }
    // Notification pour clôture d'installation (status 'installation terminée' et pas encore notifié de clôture)
    if (data.status === 'installation terminée' && !data.installationClosedNotificationSent) {
       const notificationData = {
        type: 'installation_closed',
        sector: [data.secteur],
        targetRoles: ['Admin', 'Client'], // Cibler Admins et Clients pour les clôtures
        message: `Installation terminée (${data.secteur}) - ${data.nom || data.codeClient}`,
        metadata: { installationId: doc.id },
        link: `/installations/${data.secteur.toLowerCase()}-firestore?id=${doc.id}` // Lien vers l'installation (ajuster si nécessaire)
      };
      await createNotification(notificationData);
      await doc.ref.update({ installationClosedNotificationSent: true }); // Marquer comme notifié de clôture
      notifiedCount++;
    }
  }
  console.log(`[sap-notifications] ${notifiedCount} notifications générées depuis installations`);
  return notifiedCount;
}

// Nouvelle fonction pour notifier une nouvelle installation (déclenchée par événement Firestore)
async function notifyNewInstallation(installation) {
  console.log('[sap-notifications] Notification nouvelle installation:', {
    installationId: installation.id,
    secteur: installation.secteur,
    client: installation.nom || installation.codeClient
  });
  try {
    // Créer une seule notification pour cet événement
    const notificationData = {
      type: 'installation',
      sector: [installation.secteur],
      targetRoles: ['Admin', 'Technician'], // Cibler Admins et Techniciens
      message: `Nouvelle installation (${installation.secteur}) - ${installation.nom || installation.codeClient} - ${installation.commentaire || 'Rendez-vous pris'}`,
      metadata: { installationId: installation.id },
      link: `/installations/${installation.secteur.toLowerCase()}-firestore?id=${installation.id}`
    };
    await createNotification(notificationData);
    console.log('[sap-notifications] Notification nouvelle installation envoyée.');
    return true;
  } catch (error) {
    console.error('Erreur lors de la notification de nouvelle installation:', error);
    return false;
  }
}

// Nouvelle fonction pour notifier la clôture d'une installation (déclenchée par événement Firestore)
async function notifyClosedInstallation(installation) {
  console.log('[sap-notifications] Notification clôture installation:', {
    installationId: installation.id,
    secteur: installation.secteur,
    client: installation.nom || installation.codeClient
  });
  try {
    const notificationData = {
      type: 'installation_closed',
      sector: [installation.secteur],
      targetRoles: ['Admin', 'Client'], // Cibler Admins et Clients
      message: `Installation terminée (${installation.secteur}) - ${installation.nom || installation.codeClient}`,
      metadata: { installationId: installation.id },
      link: `/installations/${installation.secteur.toLowerCase()}-firestore?id=${installation.id}`
    };
    await createNotification(notificationData);
    console.log('[sap-notifications] Notification clôture installation envoyée.');
    return true;
  } catch (error) {
    console.error('Erreur lors de la notification de clôture installation:', error);
    return false;
  }
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

    // Gérer les événements Firestore (POST)
    if (event.httpMethod === 'POST' && event.body) {
      const data = JSON.parse(event.body);
      
      // Si c'est un nouveau ticket SAP
      if (data.collection === 'tickets-sap' && data.type === 'created') {
        await notifyNewSapTicket(data.document);
      }
      
      // Si c'est un ticket SAP mis à jour (pour la clôture)
      if (data.collection === 'tickets-sap' && data.type === 'updated' && data.document?.status === 'closed') {
         await notifyClosedSapTicket(data.document);
      }

      // Si c'est un nouvel envoi CTN
      if (data.collection === 'envois-ctn' && data.type === 'created') {
        await notifyNewCTN(data.document);
      }
      
      // Si c'est une nouvelle installation
      if (data.collection === 'installations' && data.type === 'created' && data.document?.status === 'rendez-vous pris') {
        // Note: We might need to check if sapNotificationSent is already true if this event can fire multiple times for the same doc
        // For now, assuming 'created' event only fires once.
        await notifyNewInstallation(data.document);
        // Mark as notified to prevent duplicate notifications if the doc is updated later without status change
        // This requires updating the original document, which might trigger another 'updated' event.
        // A more robust solution would be to handle this flag update outside the notification function,
        // perhaps in the process that creates/updates the installation document.
        // For simplicity here, we'll skip updating the flag within the notification function itself
        // to avoid potential infinite loops or race conditions with Firestore triggers.
        // The flag check should ideally be part of the Firestore trigger configuration or the process writing to Firestore.
      }

      // Si c'est une installation mise à jour (pour la clôture)
      if (data.collection === 'installations' && data.type === 'updated' && data.document?.status === 'installation terminée' && !data.document?.installationClosedNotificationSent) {
         await notifyClosedInstallation(data.document);
         // Mark as notified to prevent duplicate notifications
         // Similar consideration as above regarding where this flag update should ideally happen.
         // For this example, we'll assume the process updating the installation document
         // is responsible for setting installationClosedNotificationSent after the notification is sent.
      }


      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Événement Firestore traité avec succès' })
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

// Removed notifySapFromInstallations as it's no longer needed
// async function notifySapFromInstallations() { ... }

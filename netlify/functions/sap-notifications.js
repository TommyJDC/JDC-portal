const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialiser Firebase Admin avec les credentials hardcodés
const app = initializeApp({
  credential: cert({
    projectId: "sap-jdc",
    privateKey: `
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDk2DRRR1WNcCNr
BTkyGJqgjH+lzIZ6z5eYTv6Cna4ZS2JJ3qGDhKIowhnLroM7jzIqKC5R+ewmXfwo
+9iomnGf66OT9orjuXrOB/UpWTVXFC8E3rDvA24zXF3OKxete1dNtoo9NQA/8Rb0
Rp/MoAPv9tAz9GqATdHP2qJy61g+DMe4XmOHJPiDPlxqvYztwzmagpkvUYRKb2up
RlOe4nrP1rse8aVvTb+JAAtbuVO3A8aV4EWJf4MoNjlgXw5AtiiGNRMCeu/tWDy3
bVAsjGL8Nwct5I21AA39Wsdgo0vt+DlkB6B9cmetm8v48Z/OelQVN8QEY2OgLsRX
QjIKkcNJAgMBAAECggEABqALw7P2UhtGVeQs0mUhSjdHFXG6YvZ87mKQaQ+k6Vk5
WzzKyEKgFItUsS+NimfhjT7kjb2tNzR5XGZje14dSVf1Fbo0LdZCK+d8aC9g+p28
Tr5zuOJh37LI3x3NmFl9yY4t/7T3xjd18VR/boPOGWBiiV6GHCN584k3iBmFeyZY
OG0aHdZO6IWk9aQjz344BZM14yJBnaUC21kCepZItpjrVUERi6puvzaD228CgGW3
wQXhVv7duGAtydQu0ZFmMzBNy2ux9tReQte/2Eo88ua/5KvBz+k0rRGvuhQX+Smr
Dy1Ld6wS8/weNd4N8y3CjpDjCwcHCFAzafNH6uiHUQKBgQD1cTvOLx7dNIhfJLx0
BDoIYSHSVBHIa4IosFm/O8IERREt1CPI0zGAyf5XtZdmuHUEjmkcdxjW1qyt0BjJ
8InohyunF2VfwyLq8+zTs3OXCuzMj0tMUhSN1ZJn6DRQT0brsVb9zWIyWSeDcXON
dLjUPpiyjbcXO16+bZwNVWI7OwKBgQDusDL4nN5tgBv5O2vxYifuVBtoRY0rmmO/
xpHXuY56M3qh3hbiRIBN/uGf9OcESBuZuKDCOtnkuuIf5DPUW6g7x3gbuCall6Ix
TtWTrM6wn6fCtA3bP0CDzmmjJSnNwV89CHSNJiQAympFviWVsToouNUucHT4d/xQ
0kILxA6rSwKBgQCItgGx3t06KUCsfjHaDWClujS0is8862UcdN4Ifqia6D2hYUBt
Y/V23wwknqkuNiA34Xr6t/vF7t1QE1E7ahfmxSOzdnyo0nBonmWTpakEwLkVV9uB
L1bzibp61gQNl5rRPX5O8E95697ugAr1B8bLsfIrwnPxJMipGTSK2LxWcQKBgGD5
ERxUj0GppLPTYn2FRXfcj+4DI+GtLg2CHUqpxqr7Mz2EP4PaFM6bWQtlsl3Y9e20
RwviYRg+nRQb4LrMKkNvPOr2HC12t5yUzMzcjnTPyJagFGkY/5sNR3nS5XMEty7S
upeGAWaY1ihTom14vYpB3cqqQbuY89faNJ8XHmaVAoGAWcQlBIJUap1S+I5OVD2I
xilxcxjptuj7E9B3BL4Fc/IfrCGVfcTJlqbLJRPw2UmeY3lp+umz0fjO9BX3NGXD
MBcJGdBErDsluxSmGvJOojFiMnSQJdRapAWIimUfmDZtzzgdFppkC6uzT0Dd+/6Q
NDAjd3cfjZIEAmSyeVMAYbA=
-----END PRIVATE KEY-----
`.trim().replace(/\\n/g, '\n'),
    clientEmail: "remix-server-firestore@sap-jdc.iam.gserviceaccount.com"
  })
});

const db = getFirestore(app);

// Fonction pour obtenir les utilisateurs notifiables
async function getNotifiableUsers() {
  const usersRef = db.collection('users');
  const snapshot = await usersRef
    .where('role', 'in', ['Admin', 'Technician'])
    .get();
  
  return snapshot.docs.map(doc => ({
    ...doc.data(),
    uid: doc.id,
  }));
}

// Créer une notification
async function createNotification(notification) {
  try {
    const notificationData = {
      ...notification,
      timestamp: new Date(),
      read: false
    };

    await db.collection('notifications').add(notificationData);
    return true;
  } catch (error) {
    console.error('Erreur lors de la création de la notification:', error);
    return false;
  }
}

// Notifier pour un nouveau ticket SAP
async function notifyNewSapTicket(ticket) {
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

    await Promise.all(notificationPromises.filter(Boolean));
    return true;
  } catch (error) {
    console.error('Erreur lors de la notification du nouveau ticket SAP:', error);
    return false;
  }
}

// Notifier pour un nouvel envoi CTN
async function notifyNewCTN(shipment) {
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

    await Promise.all(notificationPromises.filter(Boolean));
    return true;
  } catch (error) {
    console.error('Erreur lors de la notification du nouvel envoi CTN:', error);
    return false;
  }
}

exports.handler = async (event) => {
  try {
    // Vérifier si c'est un événement Firestore
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
      body: JSON.stringify({ message: 'Notifications envoyées avec succès' })
    };
  } catch (error) {
    console.error('Erreur dans la fonction de notification:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Erreur lors du traitement des notifications' })
    };
  }
};

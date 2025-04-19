import { dbAdmin } from '~/firebase.admin.config.server';
import type { SapTicket, Notification, UserProfile } from '~/types/firestore.types';
import { createNotification } from './notifications.service.server';

// Fonction pour obtenir tous les admins et techniciens
async function getNotifiableUsers(): Promise<UserProfile[]> {
  const usersRef = dbAdmin.collection('users');
  const snapshot = await usersRef
    .where('role', 'in', ['Admin', 'Technician'])
    .get();
  
  return snapshot.docs.map(doc => ({
    ...doc.data(),
    uid: doc.id,
  })) as UserProfile[];
}

// Fonction pour créer une notification pour un nouveau ticket SAP
export async function notifyNewSapTicket(ticket: SapTicket) {
  try {
    const users = await getNotifiableUsers();
    
    const notificationPromises = users.map(user => {
      // Vérifie si l'utilisateur est concerné par le secteur du ticket
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

// Fonction pour créer une notification pour un nouvel envoi CTN
export async function notifyNewCTN(shipment: any) {
  try {
    const users = await getNotifiableUsers();
    
    const notificationPromises = users.map(user => {
      // Vérifie si l'utilisateur est concerné par le secteur de l'envoi
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

// Fonction pour configurer les triggers Firestore
export async function setupNotificationTriggers() {
  // Surveiller les nouveaux tickets SAP
  dbAdmin.collection('tickets-sap').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added') {
        const ticket = {
          id: change.doc.id,
          ...change.doc.data()
        } as SapTicket;
        notifyNewSapTicket(ticket);
      }
    });
  });

  // Surveiller les nouveaux envois CTN
  dbAdmin.collection('envois-ctn').onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added') {
        const shipment = {
          id: change.doc.id,
          ...change.doc.data()
        };
        notifyNewCTN(shipment);
      }
    });
  });
}

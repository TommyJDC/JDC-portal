import { getDb } from '~/firebase.admin.config.server'; // Modifié pour importer getDb
import type { SapTicket, Notification, UserProfile } from '~/types/firestore.types';
import { createNotification } from './notifications.service.server';
import type { QuerySnapshot, DocumentChange } from 'firebase-admin/firestore'; // Importer les types pour onSnapshot

// Fonction pour obtenir tous les admins et techniciens
async function getNotifiableUsers(): Promise<UserProfile[]> {
  const db = getDb(); // Obtenir l'instance de db
  const usersRef = db.collection('users');
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
          type: 'new_ticket', // Corrigé pour correspondre à NotificationType
          sourceId: ticket.id,
          link: `/tickets-sap?id=${ticket.id}`
          // Les champs optionnels comme targetRoles, sector, metadata peuvent être ajoutés si nécessaire
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
          type: 'new_shipment', // Corrigé pour correspondre à NotificationType
          sourceId: shipment.id,
          link: `/envois-ctn?id=${shipment.id}`
          // Les champs optionnels comme targetRoles, sector, metadata peuvent être ajoutés si nécessaire
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
  // Note: L'utilisation de onSnapshot côté serveur pour des tâches de fond peut ne pas être fiable
  // dans tous les environnements de déploiement. Des tâches planifiées ou des appels explicites
  // après la création d'entités sont souvent plus robustes.

  // Les tickets SAP sont dans des collections par secteur, ex: 'CHR', 'HACCP', etc.
  // Il faudrait un listener par collection de secteur pour les tickets.
  const ticketSectors = ['CHR', 'HACCP', 'Kezia', 'Tabac']; 
  const db = getDb(); // Obtenir l'instance de db
  ticketSectors.forEach(sector => {
    db.collection(sector).onSnapshot((snapshot: QuerySnapshot) => { // Typer snapshot
      snapshot.docChanges().forEach((change: DocumentChange) => { // Typer change
        if (change.type === 'added') {
          const ticketData = change.doc.data();
          const ticket = {
            id: change.doc.id,
            ...ticketData
          } as SapTicket;
          // S'assurer que le ticket a bien un champ 'secteur' pour la logique dans notifyNewSapTicket
          if (!ticket.secteur && ticketData.secteur) ticket.secteur = ticketData.secteur as string;
          else if (!ticket.secteur) ticket.secteur = sector; 
          notifyNewSapTicket(ticket);
        }
        // On pourrait ajouter des notifications pour 'modified' (clôture, mise à jour) ici aussi
        // if (change.type === 'modified') {
        //   const ticketData = change.doc.data();
        //   const ticket = ticketData as SapTicket;
        //   if (ticket.status === 'closed' /* ou une condition pour la clôture */) {
        //     // Envoyer une notification de clôture de ticket
        //   }
        // }
      });
    });
  });

  // Surveiller les nouveaux envois CTN (collection 'Envoi')
  db.collection('Envoi').onSnapshot((snapshot: QuerySnapshot) => { // Typer snapshot
    snapshot.docChanges().forEach((change: DocumentChange) => { // Typer change
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

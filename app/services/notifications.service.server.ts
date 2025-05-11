import { initializeFirebaseAdmin, getDb } from '~/firebase.admin.config.server';
import type { Notification, UserProfile, NotificationType, UserRole } from '~/types/firestore.types'; // Import UserProfile, NotificationType, and UserRole
import type { DocumentData, QueryDocumentSnapshot } from 'firebase-admin/firestore';

let db: FirebaseFirestore.Firestore;

const ensureDb = async () => {
  if (!db) {
    db = await initializeFirebaseAdmin();
  }
  return db;
};

// Helper function for retrying async operations
async function retryAsyncOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 1000,
  shouldRetry: (error: any) => boolean = (error) => error.code === 4 // Default to retry on DEADLINE_EXCEEDED (gRPC code 4)
): Promise<T> {
  let attempts = 0;
  let delayMs = initialDelayMs;
  while (attempts < maxRetries) {
    try {
      return await operation();
    } catch (error: any) {
      attempts++;
      if (attempts >= maxRetries || !shouldRetry(error)) {
        console.error(`Operation failed after ${attempts} attempts or condition not met for retry. Original error:`, error);
        throw error;
      }
      console.warn(`Attempt ${attempts} failed with code ${error.code}. Retrying in ${delayMs}ms... Error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      delayMs *= 2; // Exponential backoff
    }
  }
  // This line should ideally not be reached if maxRetries > 0,
  // as the loop's catch block would rethrow.
  // Adding it for type safety / exhaustive check.
  throw new Error('Operation failed after maximum retries.');
}

export const getNotifications = async (userId: string) => {
  try {
    const db = await ensureDb();
    const notificationsRef = db.collection('notifications')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc') // Utiliser createdAt pour le tri, si timestamp n'existe pas/plus
      .limit(50);

    const snapshot = await notificationsRef.get();
    return snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
      id: doc.id,
      ...doc.data()
    })) as Notification[];
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return [];
  }
};

export const markNotificationAsRead = async (notificationId: string) => {
  try {
    const db = await ensureDb();
    await db.collection('notifications').doc(notificationId).update({
      isRead: true // Utiliser isRead
    });
    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
};

export const markAllNotificationsAsRead = async (userId: string) => {
  try {
    const db = await ensureDb();
    const batch = db.batch();
    const notificationsRef = await db.collection('notifications')
      .where('userId', '==', userId)
      .where('isRead', '==', false) // Utiliser isRead
      .get();

    notificationsRef.docs.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      batch.update(doc.ref, { isRead: true }); // Utiliser isRead
    });

    await batch.commit();
    return true;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return false;
  }
};

export const createNotification = async (notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'>) => { // Omettre isRead
  try {
    const db = await ensureDb();
    const notificationData = {
      ...notification,
      createdAt: new Date(),
      isRead: false // Initialiser isRead
    };

    // Wrap the Firestore add operation with retry logic
    const operation = () => db.collection('notifications').add(notificationData);
    const docRef = await retryAsyncOperation(operation); // Default retries (3) for DEADLINE_EXCEEDED

    return {
      id: docRef.id,
      ...notificationData
    } as Notification; // Caster pour assurer le type de retour complet
  } catch (error) {
    // The error here will be the one after retries have been exhausted or if it's not a retriable error
    console.error('Error creating notification after potential retries:', error);
    return null;
  }
};

export const deleteNotification = async (notificationId: string) => {
  try {
    const db = await ensureDb();
    await db.collection('notifications').doc(notificationId).delete();
    return true;
  } catch (error) {
    console.error('Error deleting notification:', error);
    return false;
  }
};

export const getUnreadNotificationsCount = async (userId: string) => {
  try {
    const db = await ensureDb();
    const snapshot = await db.collection('notifications')
      .where('userId', '==', userId)
      .where('isRead', '==', false) // Utiliser isRead
      .count()
      .get();

    return snapshot.data().count;
  } catch (error) {
    console.error('Error getting unread notifications count:', error);
    return 0;
  }
};

// --- Ajout logique notification SAP depuis Firestore installations ---
export async function notifySapFromInstallations() {
  console.log('[notifications.service] Début notification depuis installations');
  const db = await ensureDb();

  // Récupérer toutes les installations, tous secteurs confondus
  const snapshot = await db.collection('installations').get();
  let notifiedCount = 0;
  for (const doc of snapshot.docs) {
    const data = doc.data();
    // Notification pour nouvelle installation (status 'rendez-vous pris' et pas encore notifié)
    if (data.status === 'rendez-vous pris' && !data.sapNotificationSent) {
      const notificationData: Omit<Notification, 'id' | 'createdAt' | 'isRead'> = { // Typer l'objet
        type: 'installation', 
        userId: 'system', // Ou un ID spécifique si la notification est pour un utilisateur/rôle
        sector: [data.secteur as string], 
        targetRoles: ['Admin', 'Technician'], 
        title: `Nouvelle installation ${data.secteur}`,
        message: `Nouvelle installation (${data.secteur}) - ${data.nom || data.codeClient} - ${data.commentaire || 'Rendez-vous pris'}`,
        metadata: { installationId: doc.id, codeClient: data.codeClient, nomClient: data.nom },
        sourceId: doc.id,
        link: `/installations/${(data.secteur as string).toLowerCase()}-firestore?id=${doc.id}`
      };
      await createNotification(notificationData);
      await doc.ref.update({ sapNotificationSent: true }); 
      notifiedCount++;
    }
    // Notification pour clôture d'installation (status 'installation terminée' et pas encore notifié de clôture)
    if (data.status === 'installation terminée' && !data.installationClosedNotificationSent) {
       const notificationData: Omit<Notification, 'id' | 'createdAt' | 'isRead'> = { // Typer l'objet
        type: 'installation_closed', 
        userId: 'system', // Ou un ID spécifique
        sector: [data.secteur as string], 
        targetRoles: ['Admin', 'Client'], 
        title: `Installation terminée ${data.secteur}`,
        message: `Installation terminée (${data.secteur}) - ${data.nom || data.codeClient}`,
        metadata: { installationId: doc.id, codeClient: data.codeClient, nomClient: data.nom },
        sourceId: doc.id,
        link: `/installations/${(data.secteur as string).toLowerCase()}-firestore?id=${doc.id}`
      };
      await createNotification(notificationData);
      await doc.ref.update({ installationClosedNotificationSent: true }); 
      notifiedCount++;
    }
  }
  console.log(`[notifications.service] ${notifiedCount} notifications générées depuis installations`);
  return notifiedCount;
}


// New function for real-time listening
// Note: This function runs on the server, so it uses firebase-admin
// For client-side listening, you'd use the Firebase JS SDK
export const setupNotificationsListener = async (
  user: UserProfile, // Pass the full user profile for role/sector checks
  callback: (notifications: Notification[]) => void
): Promise<() => void> => { // Return the unsubscribe function
  try {
    const db = await ensureDb();
    // Query primarily by timestamp, filter later
    // We need Timestamp from firebase-admin/firestore
    const { Timestamp } = await import('firebase-admin/firestore');

    const query = db.collection('notifications')
      .orderBy('createdAt', 'desc') // Assuming 'createdAt' field exists and is a Timestamp
      .limit(100); // Fetch a reasonable number, filter in callback

    const unsubscribe = query.onSnapshot(snapshot => {
      const allNotifications = snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => {
        const data = doc.data();
        // Ensure createdAt is a Date object
        const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date());
        return {
          id: doc.id,
          ...data,
          createdAt: createdAt, // Use the converted Date object
        } as Notification; // Cast to Notification type
      });

      // Filter notifications based on user profile
      const filteredNotifications = allNotifications.filter(notif => {
        // Admins see everything
        if (user.role === 'Admin') return true;

        // Check if targeted directly to user
        if (notif.userId === user.uid) return true;

        // Check if targeted to user's role(s)
        // Assuming user.role is a single string like 'Technician'. Adjust if it's an array.
        if (notif.targetRoles && notif.targetRoles.includes(user.role)) return true;

        // Check if targeted to user's sector(s)
        // Assuming user.secteurs is an array of strings.
        if (notif.sector && user.secteurs && notif.sector.some(s => user.secteurs.includes(s))) return true;

        // If none of the above, the user shouldn't see this notification
        return false;
      });

      callback(filteredNotifications); // Pass the filtered list
    }, error => {
      console.error('Error in notification listener:', error);
      callback([]); // Send empty list on error
    });

    return unsubscribe; // Return the unsubscribe function
  } catch (error) {
    console.error('Error setting up notification listener:', error);
    return () => {}; // Return a no-op unsubscribe function on error
  }
};

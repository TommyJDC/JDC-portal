import { initializeFirebaseAdmin, getDb } from '~/firebase.admin.config.server';
import type { Notification, UserProfile } from '~/types/firestore.types'; // Import UserProfile
import type { DocumentData, QueryDocumentSnapshot } from 'firebase-admin/firestore';

let db: FirebaseFirestore.Firestore;

const ensureDb = async () => {
  if (!db) {
    db = await initializeFirebaseAdmin();
  }
  return db;
};

export const getNotifications = async (userId: string) => {
  try {
    const db = await ensureDb();
    const notificationsRef = db.collection('notifications')
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
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
      read: true
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
      .where('read', '==', false)
      .get();

    notificationsRef.docs.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      batch.update(doc.ref, { read: true });
    });

    await batch.commit();
    return true;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return false;
  }
};

export const createNotification = async (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
  try {
    const db = await ensureDb();
    const notificationData = {
      ...notification,
      timestamp: new Date(),
      read: false
    };

    const docRef = await db.collection('notifications').add(notificationData);
    return {
      id: docRef.id,
      ...notificationData
    };
  } catch (error) {
    console.error('Error creating notification:', error);
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
      .where('read', '==', false)
      .count()
      .get();

    return snapshot.data().count;
  } catch (error) {
    console.error('Error getting unread notifications count:', error);
    return 0;
  }
};

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

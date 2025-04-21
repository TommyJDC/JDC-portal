import { initializeFirebaseAdmin, getDb } from '~/firebase.admin.config.server';
import type { Notification } from '~/types/firestore.types';
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

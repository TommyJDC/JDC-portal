// This function will be deployed as a Netlify Function (which runs on AWS Lambda)
// It uses firebase-admin to bypass Firestore security rules and fetch notifications
// based on user ID, roles, and sectors.

import { initializeFirebaseAdmin } from '../../app/firebase.admin.config.server.js';

let dbAdmin;

const ensureDbAdmin = async () => {
  if (!dbAdmin) {
    dbAdmin = await initializeFirebaseAdmin();
  }
  return dbAdmin;
};

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed',
    };
  }

  try {
    const { userId, userRole, userSectors } = JSON.parse(event.body);

    if (!userId || !userRole || !userSectors) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required parameters: userId, userRole, userSectors' }),
      };
    }

    const db = await ensureDbAdmin();

    // Fetch all notifications (firebase-admin bypasses rules)
    const snapshot = await db.collection('notifications')
      .orderBy('createdAt', 'desc')
      .limit(100) // Limit the number of documents fetched
      .get();

    const allNotifications = snapshot.docs.map(doc => {
      const data = doc.data();
      console.log('getNotificationsForUser: Fetched notification with ID:', doc.id, 'and userId:', data.userId); // Log userId
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt ? data.createdAt.toDate() : new Date(), // Convert Timestamp to Date
      };
    });

    // Filter notifications based on user profile (server-side)
    const filteredNotifications = allNotifications.filter(notif => {
      // Admins see everything
      if (userRole === 'Admin') return true;

      // Check if targeted directly to user
      if (notif.userId === userId) {
        console.log('getNotificationsForUser: Including notification', notif.id, 'for userId match.');
        return true;
      }

      // Check if targeted to user's role(s)
      if (notif.targetRoles && Array.isArray(notif.targetRoles) && notif.targetRoles.includes(userRole)) return true;

      // Check if targeted to user's sector(s)
      if (notif.sector && Array.isArray(notif.sector) && userSectors && Array.isArray(userSectors) && notif.sector.some(s => userSectors.includes(s))) return true;

      // If none of the above, the user shouldn't see this notification
      return false;
    });

    return {
      statusCode: 200,
      body: JSON.stringify(filteredNotifications),
    };

  } catch (error) {
    console.error('Error in getNotificationsForUser function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error', details: error.message }),
    };
  }
};

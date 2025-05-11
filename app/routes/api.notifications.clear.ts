import { json, redirect } from "@remix-run/node"; // Ajout de redirect
import type { ActionFunctionArgs } from "@remix-run/node"; // Utiliser ActionFunctionArgs
import { getDb, initializeFirebaseAdmin } from "~/firebase.admin.config.server";
// import { authenticator } from "~/services/auth.server"; // Plus utilisé directement
import { sessionStorage, type UserSessionData } from "~/services/session.server"; // Importer pour session manuelle
import { getUserProfileSdk } from "~/services/firestore.service.server";
import type { Notification, UserProfile } from "~/types/firestore.types";
import type { DocumentData, QueryDocumentSnapshot } from 'firebase-admin/firestore';

export async function action({ request }: ActionFunctionArgs) { // Utiliser ActionFunctionArgs
  console.log('api.notifications.clear: Action function started.');
  
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  const userSession: UserSessionData | null = session.get("user") ?? null;

  if (!userSession || !userSession.userId) {
    console.log('api.notifications.clear: User session not found or invalid.');
    // Pour une API, retourner une erreur 401 est souvent préférable à une redirection.
    return json({ success: false, error: 'User not authenticated' }, { status: 401 });
    // Alternativement, si une redirection est souhaitée (comme avec failureRedirect):
    // throw redirect("/login");
  }

  console.log('api.notifications.clear: User session found for userId:', userSession.userId);

  try {
    console.log('api.notifications.clear: Initializing Firebase Admin...');
    await initializeFirebaseAdmin(); // Initialize Firebase Admin
    console.log('api.notifications.clear: Firebase Admin initialized.');
    
    const db = getDb(); // Call getDb() to get the Firestore instance
    console.log('api.notifications.clear: Got Firestore instance.');

    console.log('api.notifications.clear: Fetching user profile for userId:', userSession.userId);
    const userProfile = await getUserProfileSdk(userSession.userId);

    if (!userProfile) {
      console.error('api.notifications.clear: User profile not found for userId:', userSession.userId);
      return json({ success: false, error: 'User profile not found' }, { status: 404 });
    }

    console.log('api.notifications.clear: User profile fetched:', userProfile.uid, 'Role:', userProfile.role, 'Sectors:', userProfile.secteurs);


    // Fetch all notifications (similar to Netlify function)
    console.log('api.notifications.clear: Fetching all notifications...');
    const snapshot = await db.collection('notifications')
      .orderBy('createdAt', 'desc')
      .limit(100) // Use the same limit as the Netlify function
      .get();

    console.log('api.notifications.clear: Fetched', snapshot.docs.length, 'total notifications.');

    // Filter notifications based on user profile (duplicate logic from Netlify function)
    const notificationsToDelete = snapshot.docs.filter(doc => {
      const notif = doc.data() as Notification; // Cast to Notification type
      // Admins see everything
      if (userProfile.role === 'Admin') return true;

      // Check if targeted directly to user
      if (notif.userId === userProfile.uid) return true;

      // Check if targeted to user's role(s)
      if (notif.targetRoles && Array.isArray(notif.targetRoles) && notif.targetRoles.includes(userProfile.role)) return true;

      // Check if targeted to user's sector(s)
      // Assuming userProfile.secteurs is an array of strings.
      if (notif.sector && Array.isArray(notif.sector) && userProfile.secteurs && Array.isArray(userProfile.secteurs) && notif.sector.some(s => userProfile.secteurs.includes(s))) return true;

      // If none of the above, the user shouldn't see this notification
      return false;
    });

    console.log('api.notifications.clear: Found', notificationsToDelete.length, 'notifications visible to user.');

    if (notificationsToDelete.length === 0) {
      console.log('api.notifications.clear: No visible notifications to delete.');
      return json({ success: true, message: 'No visible notifications to clear' });
    }

    const batch = db.batch();
    console.log('api.notifications.clear: Created batch for deletion.');

    notificationsToDelete.forEach((doc) => {
      console.log('api.notifications.clear: Adding doc', doc.id, 'to batch for deletion.');
      batch.delete(doc.ref);
    });

    console.log('api.notifications.clear: Committing batch...');
    await batch.commit();
    console.log('api.notifications.clear: Batch committed successfully.');
    
    return json({ success: true, message: `${notificationsToDelete.length} notifications cleared` });
  } catch (error) {
    console.error('api.notifications.clear: Erreur lors de la suppression des notifications:', error);
    return json({ success: false, error: 'Erreur lors de la suppression des notifications' }, { status: 500 });
  }
}

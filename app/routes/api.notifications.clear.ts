import { json } from "@remix-run/node";
import { getDb } from "~/firebase.admin.config.server"; // Import getDb instead of dbAdmin
import { authenticator } from "~/services/auth.server";

export async function action({ request }: { request: Request }) {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });
  
  try {
    const db = getDb(); // Call getDb() to get the Firestore instance
    const batch = db.batch();
    const notificationsRef = await db.collection('notifications')
      .where('userId', '==', user.userId)
      .get();

    notificationsRef.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    
    return json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la suppression des notifications:', error);
    return json({ success: false, error: 'Erreur lors de la suppression des notifications' }, { status: 500 });
  }
}

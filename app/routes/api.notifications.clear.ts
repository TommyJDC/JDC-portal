import { json } from "@remix-run/node";
import { dbAdmin } from "~/firebase.admin.config.server";
import { authenticator } from "~/services/auth.server";

export async function action({ request }: { request: Request }) {
  const user = await authenticator.isAuthenticated(request, {
    failureRedirect: "/login",
  });
  
  try {
    const batch = dbAdmin.batch();
    const notificationsRef = await dbAdmin.collection('notifications')
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

import { json } from '@remix-run/node';
import type { ActionFunctionArgs } from '@remix-run/node';
import { markAllNotificationsAsRead } from '~/services/notifications.service.server';
import { sessionStorage, type UserSessionData } from "~/services/session.server"; // Importer pour session manuelle

export async function action({ request }: ActionFunctionArgs) {
  try {
    const session = await sessionStorage.getSession(request.headers.get("Cookie"));
    const userSession: UserSessionData | null = session.get("user") ?? null;

    if (!userSession || !userSession.userId) {
      return json({ error: "Non authentifié." }, { status: 401 });
    }
    
    // Utiliser l'ID de l'utilisateur de la session authentifiée
    const userId = userSession.userId;

    // const data = await request.json(); // Plus besoin de lire le corps pour userId
    // const userIdFromBody = data.userId; // Ancienne méthode

    // if (!userId) { // Cette vérification est maintenant redondante si on utilise userSession.userId
    //   return json({ error: 'User ID is required' }, { status: 400 });
    // }

    const success = await markAllNotificationsAsRead(userId); // Utiliser userId de la session
    if (success) {
      return json({ success: true });
    }
    return json({ error: 'Failed to mark all notifications as read' }, { status: 400 });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

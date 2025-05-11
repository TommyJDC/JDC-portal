import { json } from '@remix-run/node';
import type { ActionFunctionArgs } from '@remix-run/node';
import { markNotificationAsRead } from '~/services/notifications.service.server';
import { sessionStorage, type UserSessionData } from "~/services/session.server"; // Importer pour session manuelle

export async function action({ request, params }: ActionFunctionArgs) { // Ajouter request
  const session = await sessionStorage.getSession(request.headers.get("Cookie"));
  const userSession: UserSessionData | null = session.get("user") ?? null;

  if (!userSession || !userSession.userId) {
    return json({ error: "Non authentifié." }, { status: 401 });
  }
  
  // Idéalement, on vérifierait aussi que notificationId appartient à userSession.userId
  // mais markNotificationAsRead ne prend que notificationId.
  // Cette vérification de propriété devrait être dans le service.

  const notificationId = params.id;

  if (!notificationId) {
    return json({ error: 'Notification ID is required' }, { status: 400 });
  }

  try {
    const success = await markNotificationAsRead(notificationId);
    if (success) {
      return json({ success: true });
    }
    return json({ error: 'Failed to mark notification as read' }, { status: 400 });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

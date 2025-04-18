import { json } from '@remix-run/node';
import type { ActionFunctionArgs } from '@remix-run/node';
import { markNotificationAsRead } from '~/services/notifications.service.server';

export async function action({ params }: ActionFunctionArgs) {
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

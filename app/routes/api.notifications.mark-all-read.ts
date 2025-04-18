import { json } from '@remix-run/node';
import type { ActionFunctionArgs } from '@remix-run/node';
import { markAllNotificationsAsRead } from '~/services/notifications.service.server';

export async function action({ request }: ActionFunctionArgs) {
  try {
    const data = await request.json();
    const userId = data.userId;

    if (!userId) {
      return json({ error: 'User ID is required' }, { status: 400 });
    }

    const success = await markAllNotificationsAsRead(userId);
    if (success) {
      return json({ success: true });
    }
    return json({ error: 'Failed to mark all notifications as read' }, { status: 400 });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { json } from '@remix-run/node';
import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { 
  getNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  getUnreadNotificationsCount 
} from '~/services/notifications.service.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');

  if (!userId) {
    return json({ error: 'userId is required' }, { status: 400 });
  }

  try {
    const [notifications, unreadCount] = await Promise.all([
      getNotifications(userId),
      getUnreadNotificationsCount(userId)
    ]);

    return json({
      notifications: notifications.map(notification => ({
        ...notification,
        timestamp: notification.timestamp instanceof Date 
          ? notification.timestamp.toISOString()
          : notification.timestamp.toDate().toISOString()
      })),
      unreadCount
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return json({ error: 'Failed to fetch notifications' }, { status: 500 });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const url = new URL(request.url);
  const segments = url.pathname.split('/');
  const notificationId = segments[segments.length - 2];
  const action = segments[segments.length - 1];

  if (request.method === 'POST') {
    try {
      if (action === 'read' && notificationId) {
        const success = await markNotificationAsRead(notificationId);
        if (success) {
          return json({ success: true });
        }
      } else if (action === 'mark-all-read') {
        const data = await request.json();
        const success = await markAllNotificationsAsRead(data.userId);
        if (success) {
          return json({ success: true });
        }
      }
      return json({ error: 'Operation failed' }, { status: 400 });
    } catch (error) {
      console.error('Error processing notification action:', error);
      return json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  return json({ error: 'Method not allowed' }, { status: 405 });
}

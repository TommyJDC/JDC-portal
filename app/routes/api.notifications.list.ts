import { json } from '@remix-run/node';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { 
  getNotifications, 
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

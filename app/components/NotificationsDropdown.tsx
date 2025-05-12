import React, { useState, useEffect, Fragment } from 'react'; // Ajout de Fragment
import { Menu, Transition } from '@headlessui/react';
import { FaBell, FaCheck, FaTrash, FaInfoCircle } from 'react-icons/fa';
import { Link, useFetcher } from '@remix-run/react';

export interface NotificationDisplay {
  id: string;
  title: string;
  message: string;
  type?: string;
  userId: string;
  isRead: boolean;
  timestamp: string;
  source?: string;
  link?: string;
}

interface NotificationActionResponse {
  success?: boolean;
  message?: string;
  error?: string;
  transactionHash?: string;
}

interface NotificationsDropdownProps {
  notifications?: NotificationDisplay[];
  notificationCount?: number;
  onMarkAllAsRead?: () => void;
  onMarkAsRead?: (id: string) => void;
  onClearAll?: () => void;
  userId?: string;
}

export function NotificationsDropdown({
  notifications: initialNotifications,
  notificationCount: initialCount = 0,
  onMarkAllAsRead,
  onMarkAsRead,
  onClearAll,
  userId
}: NotificationsDropdownProps) {
  const [notifications, setNotifications] = useState<NotificationDisplay[]>(initialNotifications || []);
  const [notificationCount, setNotificationCount] = useState<number>(initialCount);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPlaceholder, setIsPlaceholder] = useState<boolean>(false);
  // isOpen est géré par Headless UI Menu
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  
  const notificationsFetcher = useFetcher<{ notifications: NotificationDisplay[], unreadCount: number, error?: string, isPlaceholder?: boolean }>();
  const testNotificationFetcher = useFetcher<{ success: boolean, message?: string, error?: string }>();
  
  useEffect(() => {
    fetchNotifications();
  }, [userId]); // Re-fetch si userId change

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchNotifications();
      }
    }, 30000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = new Date();
        if (now.getTime() - lastRefresh.getTime() > 10000) {
          fetchNotifications();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [lastRefresh]);
  
  useEffect(() => {
    if (notificationsFetcher.data) {
      setNotifications(notificationsFetcher.data.notifications || []);
      setNotificationCount(notificationsFetcher.data.unreadCount || 0);
      setIsPlaceholder(notificationsFetcher.data.isPlaceholder || false);
      setIsLoading(false);
      setLastRefresh(new Date());
    }
  }, [notificationsFetcher.data]);
  
  useEffect(() => {
    if (notificationsFetcher.state === 'idle' && notificationsFetcher.data) {
      const response = notificationsFetcher.data as NotificationActionResponse;
      if (response.success || response.error) { // Rafraîchir sur succès ou erreur d'action
        setTimeout(fetchNotifications, 1000);
      }
    }
  }, [notificationsFetcher.state, notificationsFetcher.data]);
  
  const fetchNotifications = () => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (import.meta.env.DEV) {
      params.append('dev_bypass', 'true');
      params.append('force_examples', 'true');
    } else {
      params.append('force_examples', 'true');
    }
    params.append('userId', userId || 'all');
    params.append('includeAll', 'true');
    const url = `/api/notifications?${params.toString()}`;
    notificationsFetcher.load(url);
  };
  
  const handleNotificationAction = (actionUrl: string) => {
    const formData = new FormData();
    const devParam = import.meta.env.DEV ? '?dev_bypass=true' : '';
    notificationsFetcher.submit(formData, { method: 'post', action: `${actionUrl}${devParam}` });
    // Le useEffect sur notificationsFetcher.state et .data gérera le rafraîchissement
  };

  const handleMarkAllAsRead = () => onMarkAllAsRead ? onMarkAllAsRead() : handleNotificationAction('/api/notifications/mark-all-read');
  const handleMarkAsRead = (id: string) => onMarkAsRead ? onMarkAsRead(id) : handleNotificationAction(`/api/notifications/${id}/read`);
  const deleteNotification = async (notificationId: string) => {
    try {
      console.log(`[NotificationsDropdown] Début de la suppression de la notification ${notificationId}`);
      
      if (!notificationId) {
        console.error('[NotificationsDropdown] ID de notification manquant');
        throw new Error('ID de notification requis');
      }

      // Sauvegarder l'état actuel pour restauration en cas d'erreur
      const previousNotifications = [...notifications];
      
      // Optimistic update
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      setNotificationCount(prev => Math.max(0, prev - 1));
      
      const formData = new FormData();
      formData.append('action', 'delete');
      formData.append('notificationId', notificationId);

      console.log(`[NotificationsDropdown] Envoi de la requête de suppression pour ${notificationId}`);
      const response = await fetch('/api/notifications', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      console.log(`[NotificationsDropdown] Réponse de suppression pour ${notificationId}:`, result);

      if (!result.success) {
        console.error(`[NotificationsDropdown] Échec de la suppression de ${notificationId}:`, result.message);
        // Restaurer l'état précédent en cas d'erreur
        setNotifications(previousNotifications);
        setNotificationCount(prev => prev + 1);
        throw new Error(result.message || 'Erreur lors de la suppression');
      }

      // Rafraîchir la liste des notifications après une suppression réussie
      await fetchNotifications();
      
    } catch (error) {
      console.error(`[NotificationsDropdown] Erreur lors de la suppression de ${notificationId}:`, {
        error,
        message: error instanceof Error ? error.message : 'Erreur inconnue'
      });
      // L'état a déjà été restauré dans le bloc try si nécessaire
    }
  };
  
  const handleClearAll = async () => {
    try {
      console.log('[NotificationsDropdown] Début de la suppression de toutes les notifications');
      
      // Sauvegarder l'état actuel
      const previousNotifications = [...notifications];
      const previousNotificationCount = notificationCount;
      
      // Optimistic update
      setNotifications([]);
      setNotificationCount(0);
      
      const formData = new FormData();
      formData.append('action', 'clearAll');

      console.log('[NotificationsDropdown] Envoi de la requête de suppression globale');
      const response = await fetch('/api/notifications', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      console.log('[NotificationsDropdown] Réponse de suppression globale:', result);

      if (!result.success) {
        console.error('[NotificationsDropdown] Échec de la suppression globale:', result.message);
        // Restaurer l'état précédent
        setNotifications(previousNotifications);
        setNotificationCount(previousNotificationCount);
        throw new Error(result.message || 'Erreur lors de la suppression globale');
      }

      // Rafraîchir la liste des notifications
      await fetchNotifications();
      
    } catch (error) {
      console.error('[NotificationsDropdown] Erreur lors de la suppression globale:', {
        error,
        message: error instanceof Error ? error.message : 'Erreur inconnue'
      });
      // L'état a déjà été restauré dans le bloc try si nécessaire
    }
  };

  const createTestNotification = () => { /* ... reste inchangé ... */ };
  const handleReinitNotifications = () => { /* ... reste inchangé ... */ };

  return (
    <Menu as="div" className="relative inline-block text-left">
      <Menu.Button 
        className="relative p-2 rounded-full text-text-secondary hover:text-text-primary hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-opacity-50 transition-colors"
        aria-label={`Notifications${notificationCount > 0 ? ` (${notificationCount} non lues)` : ''}`}
      >
        <FaBell className="h-6 w-6" />
        {notificationCount > 0 && (
          <span className="absolute top-0 right-0 transform translate-x-1/3 -translate-y-1/3 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
            {notificationCount > 9 ? '9+' : notificationCount}
          </span>
        )}
      </Menu.Button>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 mt-2 w-80 sm:w-96 origin-top-right rounded-lg bg-white/5 backdrop-blur-lg shadow-2xl border border-white/10 focus:outline-none divide-y divide-white/10 z-50">
          <div className="p-3">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-text-primary">Notifications</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchNotifications()}
                  className="text-brand-blue text-xs hover:text-brand-blue-light transition-colors p-1 rounded-md hover:bg-white/5"
                  disabled={isLoading} title="Rafraîchir les notifications"
                >
                  <svg className={`inline-block w-3.5 h-3.5 mr-1 ${isLoading ? 'animate-spin' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className="inline text-xs">{isLoading ? "..." : "Actualiser"}</span>
                </button>
                {notificationCount > 0 && !isPlaceholder && (
                  <button onClick={handleMarkAllAsRead} className="text-brand-blue text-xs hover:text-brand-blue-light transition-colors p-1 rounded-md hover:bg-white/5">
                    <FaCheck className="mr-1 inline h-3 w-3" /> <span className="inline">Tout lire</span>
                  </button>
                )}
                {notifications.length > 0 && !isPlaceholder && (
                  <button onClick={handleClearAll} className="text-xs text-text-secondary hover:text-red-500 transition-colors p-1 rounded-md hover:bg-white/5">
                    Vider
                  </button>
                )}
                {/* Boutons DEV ... */}
              </div>
            </div>
            {isPlaceholder && (
              <div className="bg-ui-background/50 p-2 mb-2 rounded-md text-xs text-text-secondary flex items-center">
                <FaInfoCircle className="text-brand-blue mr-2" /> Les notifications affichées sont des exemples.
              </div>
            )}
            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {isLoading && notifications.length === 0 ? ( // Afficher chargement seulement si pas de notifs existantes
                <div className="text-center text-text-secondary py-4">Chargement...</div>
              ) : notifications.length === 0 ? (
                <div className="text-center text-text-secondary py-4">Aucune notification</div>
              ) : (
                notifications.map((notification) => (
                  <Menu.Item key={`${notification.source || 'unknown'}-${notification.id}`}>
                    {({ active }) => (
                      <div
                        className={`flex items-start p-2 rounded-md transition-colors ${
                          active ? 'bg-white/20' : '' // Hover plus visible
                        } ${!notification.isRead ? 'bg-brand-blue/20' : 'bg-white/5'}`} // Fond différent pour non lues et lues
                      >
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => !isPlaceholder && !notification.isRead && handleMarkAsRead(notification.id)}>
                          {notification.link && !isPlaceholder ? (
                            <Link to={notification.link} className="block"><NotificationContent notification={notification} /></Link>
                          ) : ( <NotificationContent notification={notification} /> )}
                        </div>
                        <div className="flex flex-col items-center space-y-1 ml-2 pt-0.5">
                          {!notification.isRead && !isPlaceholder && (
                            <div className="w-2 h-2 bg-brand-blue rounded-full flex-shrink-0" title="Non lue" />
                          )}
                          {!isPlaceholder && (
                            <button onClick={(e) => { e.stopPropagation(); deleteNotification(notification.id);}}
                              className="text-text-tertiary hover:text-red-500 p-0.5" title="Supprimer">
                              <FaTrash size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </Menu.Item>
                ))
              )}
            </div>
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}

const NotificationContent: React.FC<{ notification: NotificationDisplay }> = ({ notification }) => {
  const timeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffInSeconds < 60) return 'À l\'instant';
    if (diffInSeconds < 3600) return `Il y a ${Math.floor(diffInSeconds / 60)} min`;
    if (diffInSeconds < 86400) return `Il y a ${Math.floor(diffInSeconds / 3600)} h`;
    return `Il y a ${Math.floor(diffInSeconds / 86400)} j`;
  };
  return (
    <>
      <p className={`text-sm font-medium truncate ${notification.isRead ? 'text-text-secondary' : 'text-text-primary'}`}>
        {notification.title || notification.message}
      </p>
      {notification.title && notification.title !== notification.message && (
        <p className={`text-xs line-clamp-2 ${notification.isRead ? 'text-text-tertiary' : 'text-text-secondary'}`}> 
          {notification.message}
        </p>
      )}
      <p className="text-xs text-text-tertiary/70 mt-1 flex justify-between">
        <span>{timeAgo(notification.timestamp)}</span>
        {notification.source && (<span className="italic">{notification.source === 'blockchain' ? 'Blockchain' : 'Système'}</span>)}
      </p>
    </>
  );
};

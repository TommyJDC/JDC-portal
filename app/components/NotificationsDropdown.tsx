import React, { useState, useEffect } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { FaBell, FaCheck, FaTrash, FaInfoCircle } from 'react-icons/fa';
import { Link, useFetcher } from '@remix-run/react';

// Interface pour une notification à afficher
export interface NotificationDisplay {
  id: string;
  title: string;
  message: string;
  type?: string;
  userId: string;
  isRead: boolean;
  timestamp: string;
  source?: string;
  link?: string; // Lien optionnel vers une page détaillée
}

// Interface pour le type de réponse des actions sur les notifications
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
  const [isOpen, setIsOpen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  
  // Utiliser useFetcher pour récupérer les notifications depuis l'API
  const notificationsFetcher = useFetcher<{ notifications: NotificationDisplay[], unreadCount: number, error?: string, isPlaceholder?: boolean }>();
  
  // Fetcher pour la création de notifications de test
  const testNotificationFetcher = useFetcher<{ success: boolean, message?: string, error?: string }>();
  
  // Charger les notifications au chargement du composant
  useEffect(() => {
    fetchNotifications();
  }, []);

  // Rafraîchir automatiquement les notifications toutes les 30 secondes
  useEffect(() => {
    // Intervalle de rafraîchissement (30 secondes)
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        console.log('Rafraîchissement automatique des notifications...');
        fetchNotifications();
      }
    }, 30000);
    
    // Événement de focus sur la fenêtre pour rafraîchir les notifications
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Ne rafraîchir que si la dernière mise à jour date de plus de 10 secondes
        const now = new Date();
        const timeSinceLastRefresh = now.getTime() - lastRefresh.getTime();
        if (timeSinceLastRefresh > 10000) {
          console.log('Rafraîchissement des notifications après retour sur la page...');
          fetchNotifications();
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Nettoyer les intervalles et écouteurs d'événements
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [lastRefresh]);
  
  // Mettre à jour les notifications quand la requête est terminée
  useEffect(() => {
    if (notificationsFetcher.data) {
      setNotifications(notificationsFetcher.data.notifications || []);
      setNotificationCount(notificationsFetcher.data.unreadCount || 0);
      setIsPlaceholder(notificationsFetcher.data.isPlaceholder || false);
      setIsLoading(false);
      setLastRefresh(new Date());
    }
  }, [notificationsFetcher.data]);
  
  // Surveiller les réponses du fetcher pour gérer les erreurs et le rafraîchissement
  useEffect(() => {
    // Si on vient de faire une action (delete ou mark as read)
    if (notificationsFetcher.state === 'idle' && notificationsFetcher.data) {
      const response = notificationsFetcher.data as NotificationActionResponse;
      if (response.success) {
        console.log('[NotificationsDropdown] Action réussie:', response.message);
        // Rafraîchir les notifications après une action réussie
        setTimeout(fetchNotifications, 1000);
      } else if (response.error) {
        console.error('[NotificationsDropdown] Erreur:', response.error);
        // Rafraîchir quand même pour s'assurer d'avoir les données à jour
        setTimeout(fetchNotifications, 1000);
      }
    }
  }, [notificationsFetcher.state, notificationsFetcher.data]);
  
  // Fonction pour récupérer les notifications depuis l'API
  const fetchNotifications = () => {
    setIsLoading(true);
    const params = new URLSearchParams();
    
    // En mode développement, utiliser le bypass et forcer les exemples
    if (import.meta.env.DEV) {
      params.append('dev_bypass', 'true');
      params.append('force_examples', 'true');
    } else {
      // Même en production, forcer l'affichage des exemples si aucune notification n'est disponible
      params.append('force_examples', 'true');
    }
    
    // Ajouter le paramètre userId si disponible, sinon utiliser 'all'
    params.append('userId', userId || 'all');
    
    // Ajouter le paramètre includeAll pour récupérer toutes les notifications pertinentes
    params.append('includeAll', 'true');
    
    const queryString = params.toString();
    const url = `/api/notifications${queryString ? `?${queryString}` : ''}`;
    console.log('Fetching notifications from URL:', url);
    notificationsFetcher.load(url);
  };
  
  // Fonction pour marquer toutes les notifications comme lues
  const handleMarkAllAsRead = () => {
    if (onMarkAllAsRead) {
      onMarkAllAsRead();
    } else {
      // Marquer toutes les notifications comme lues via l'API
      const formData = new FormData();
      notificationsFetcher.submit(formData, {
        method: 'post',
        action: `/api/notifications/mark-all-read${import.meta.env.DEV ? '?dev_bypass=true' : ''}`,
      });
    }
    // Rafraîchir après l'action
    setTimeout(fetchNotifications, 1000);
  };
  
  // Fonction pour marquer une notification comme lue
  const handleMarkAsRead = (id: string) => {
    if (onMarkAsRead) {
      onMarkAsRead(id);
    } else {
      // Marquer la notification comme lue via l'API
      const formData = new FormData();
      notificationsFetcher.submit(formData, {
        method: 'post',
        action: `/api/notifications/${id}/read${import.meta.env.DEV ? '?dev_bypass=true' : ''}`,
      });
    }
    // Rafraîchir après l'action
    setTimeout(fetchNotifications, 1000);
  };
  
  // Fonction pour vider la liste des notifications
  const handleClearAll = () => {
    if (onClearAll) {
      onClearAll();
    } else {
      // Supprimer toutes les notifications via l'API
      notifications.forEach(notification => {
        if (!isPlaceholder) {
          deleteNotification(notification.id);
        }
      });
    }
    // Rafraîchir après l'action
    setTimeout(fetchNotifications, 1000);
  };

  // Fonction pour supprimer une notification
  const deleteNotification = (id: string) => {
    console.log(`[NotificationsDropdown] Tentative de suppression de la notification: ${id}`);
    
    // Supprimer la notification via l'API
    const formData = new FormData();
    
    // Paramètres pour le développement
    const devParam = import.meta.env.DEV ? '?dev_bypass=true' : '';
    
    notificationsFetcher.submit(formData, {
      method: 'post',
      action: `/api/notifications/${id}/delete${devParam}`,
    });
  };

  // Fonction pour créer une notification de test
  const createTestNotification = () => {
    const formData = new FormData();
    testNotificationFetcher.submit(formData, {
      method: 'post',
      action: `/api/test-notification${import.meta.env.DEV ? '?dev_bypass=true' : ''}`,
    });
    
    // Rafraîchir les notifications après un court délai
    setTimeout(fetchNotifications, 5000);
  };

  // Fonction pour réinitialiser et forcer la création d'une notification (mode dev uniquement)
  const handleReinitNotifications = () => {
    fetch(`/api/reinit-notifications?dev_bypass=true`)
      .then(response => response.json())
      .then(data => {
        console.log('Réponse de réinitialisation:', data);
        // Attendre un peu pour laisser le temps à la blockchain de traiter
        setTimeout(fetchNotifications, 5000);
      })
      .catch(error => {
        console.error('Erreur lors de la réinitialisation:', error);
      });
  };

  return (
    <Menu as="div" className="relative inline-block text-left">
      <Menu.Button 
        className="relative text-jdc-gray-300 hover:text-white transition-colors p-1.5 rounded-full hover:bg-jdc-blue-light/20 focus:outline-none focus:ring-2 focus:ring-jdc-yellow focus:ring-opacity-50"
        aria-label={`Notifications${notificationCount > 0 ? ` (${notificationCount} non lues)` : ''}`}
      >
        <FaBell className="text-xl" />
        {notificationCount > 0 && (
          <span className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {notificationCount > 9 ? '9+' : notificationCount}
          </span>
        )}
      </Menu.Button>

      <Transition
        as={React.Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="fixed left-20 md:left-64 top-8 mt-0 w-96 origin-top-left rounded-md bg-gray-800 shadow-2xl border border-gray-700 hover:border-jdc-blue transition-all duration-300 ease-in-out focus:outline-none divide-y divide-gray-700 z-50">
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-white">Notifications</h3>
              <div className="flex gap-4">
                {/* Bouton de rafraîchissement */}
                <button
                  onClick={() => fetchNotifications()}
                  className="text-jdc-blue text-sm hover:text-blue-400 transition-colors"
                  disabled={isLoading}
                  title="Rafraîchir les notifications"
                >
                  <svg 
                    className={`inline-block w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} 
                    xmlns="http://www.w3.org/2000/svg" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className="inline">{isLoading ? "..." : "Actualiser"}</span>
                </button>

                {/* Bouton "Tout marquer comme lu" visible s'il y a des notifications non lues */}
                {notificationCount > 0 && !isPlaceholder && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-jdc-yellow text-sm hover:text-yellow-300 transition-colors"
                  >
                    <FaCheck className="mr-1 inline" />
                    <span className="inline">Tout marquer comme lu</span>
                  </button>
                )}
                {/* Bouton "Vider la liste" visible s'il y a des notifications (lues ou non) */}
                {notifications.length > 0 && !isPlaceholder && (
                  <button
                    onClick={handleClearAll}
                    className="text-sm text-yellow-400 hover:text-yellow-300 transition-colors py-1 px-2 rounded hover:bg-gray-800"
                  >
                    Vider la liste
                  </button>
                )}
                
                {/* Bouton de test de notification (visible uniquement en développement) */}
                {import.meta.env.DEV && (
                  <button
                    onClick={createTestNotification}
                    disabled={testNotificationFetcher.state === 'submitting'}
                    className="text-sm text-green-400 hover:text-green-300 transition-colors py-1 px-2 rounded hover:bg-gray-800 ml-2"
                  >
                    {testNotificationFetcher.state === 'submitting' ? 'Création...' : 'Test Notif'}
                  </button>
                )}

                {/* Bouton de réinitialisation des notifications (visible uniquement en développement) */}
                {import.meta.env.DEV && (
                  <button
                    onClick={handleReinitNotifications}
                    className="text-sm text-red-400 hover:text-red-300 transition-colors py-1 px-2 rounded hover:bg-gray-800 ml-2"
                  >
                    Réinit
                  </button>
                )}
              </div>
            </div>

            {/* Afficher un message de debug en DEV, caché en production */}
            {import.meta.env.DEV && (
              <div className="bg-gray-900 p-2 mb-3 rounded-md text-xs text-gray-400">
                <div>Count: {notificationCount}, Source: {notifications.length > 0 ? notifications[0].source : 'none'}</div>
                <div>UserId: {userId || 'non spécifié'}, Placeholder: {isPlaceholder ? 'oui' : 'non'}</div>
              </div>
            )}

            {import.meta.env.DEV && (
              <div className="p-2 border-t border-jdc-gray-700 text-xs text-jdc-gray-400">
                <div>Count: {notificationCount}, Source: {notifications.length > 0 ? notifications[0].source : 'none'}</div>
                {testNotificationFetcher.data?.message && (
                  <div className="text-green-400">{testNotificationFetcher.data.message}</div>
                )}
                {testNotificationFetcher.data?.error && (
                  <div className="text-red-400">{testNotificationFetcher.data.error}</div>
                )}
              </div>
            )}

            {isPlaceholder && (
              <div className="bg-jdc-blue-dark/30 p-2 mb-3 rounded-md text-xs text-jdc-gray-300 flex items-center">
                <FaInfoCircle className="text-jdc-yellow mr-2" />
                Les notifications affichées sont des exemples et ne représentent pas de données réelles.
              </div>
            )}

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {isLoading ? (
                <div className="text-center text-jdc-gray-400 py-4">
                  Chargement...
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center text-jdc-gray-400 py-4">
                  Aucune notification
                </div>
              ) : (
                notifications.map((notification) => (
                  <Menu.Item key={`${notification.source || 'unknown'}-${notification.id}`}>
                    {({ active }) => (
                      <div
                        className={`flex items-start p-3 rounded-md ${
                          active ? 'bg-jdc-blue-light/10' : ''
                        } ${!notification.isRead ? 'bg-jdc-blue-dark/30' : ''}`}
                      >
                        <div className="flex-1 min-w-0" onClick={() => !isPlaceholder && handleMarkAsRead(notification.id)}>
                          {notification.link && !isPlaceholder ? (
                            <Link
                              to={notification.link}
                              className="block"
                            >
                              <NotificationContent notification={notification} />
                            </Link>
                          ) : (
                            <NotificationContent notification={notification} />
                          )}
                        </div>
                        <div className="flex flex-col items-end">
                          {!notification.isRead && !isPlaceholder && (
                            <div className="w-2 h-2 bg-jdc-yellow rounded-full ml-2 mt-2 flex-shrink-0" />
                          )}
                          {!isPlaceholder && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(notification.id);
                              }}
                              className="text-gray-400 hover:text-red-500 mt-2"
                              title="Supprimer cette notification"
                            >
                              <FaTrash size={12} />
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
      <p className="text-sm text-white font-medium truncate">
        {notification.title || notification.message}
      </p>
      {notification.title && notification.title !== notification.message && (
        <p className="text-sm text-jdc-gray-300 line-clamp-2"> 
          {notification.message}
        </p>
      )}
      <p className="text-xs text-jdc-gray-400 mt-1 flex justify-between">
        <span>{timeAgo(notification.timestamp)}</span>
        {notification.source && (
          <span className="italic">
            {notification.source === 'blockchain' ? 'Blockchain' : 'Système'}
          </span>
        )}
      </p>
    </>
  );
};
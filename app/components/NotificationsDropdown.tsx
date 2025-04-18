import React from 'react';
import { Menu, Transition } from '@headlessui/react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell, faCheck } from '@fortawesome/free-solid-svg-icons';
import { Link } from '@remix-run/react';

import type { Notification as FirestoreNotification } from '~/types/firestore.types';

export interface NotificationDisplay extends Omit<FirestoreNotification, 'timestamp'> {
  timestamp: string;
}

interface NotificationsDropdownProps {
  notifications: NotificationDisplay[];
  notificationCount: number;
  onMarkAllAsRead: () => void;
  onMarkAsRead: (id: string) => void;
}

export const NotificationsDropdown: React.FC<NotificationsDropdownProps> = ({
  notifications,
  notificationCount,
  onMarkAllAsRead,
  onMarkAsRead,
}) => {
  return (
    <Menu as="div" className="relative inline-block text-left">
      <Menu.Button 
        className="relative text-jdc-gray-300 hover:text-white transition-colors p-1.5 rounded-full hover:bg-jdc-blue-light/20 focus:outline-none focus:ring-2 focus:ring-jdc-yellow focus:ring-opacity-50"
        aria-label={`Notifications${notificationCount > 0 ? ` (${notificationCount} non lues)` : ''}`}
      >
        <FontAwesomeIcon icon={faBell} className="text-xl" />
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
        <Menu.Items className="absolute right-0 mt-2 w-96 origin-top-right rounded-md bg-jdc-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none divide-y divide-jdc-gray-700">
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-white">Notifications</h3>
              {notificationCount > 0 && (
                <button
                  onClick={onMarkAllAsRead}
                  className="text-jdc-yellow text-sm hover:text-jdc-yellow-light transition-colors"
                >
                  <FontAwesomeIcon icon={faCheck} className="mr-1" />
                  Tout marquer comme lu
                </button>
              )}
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="text-center text-jdc-gray-400 py-4">
                  Aucune notification
                </div>
              ) : (
                notifications.map((notification) => (
                  <Menu.Item key={notification.id}>
                    {({ active }) => (
                      <div
                        className={`flex items-start p-3 rounded-md ${
                          active ? 'bg-jdc-blue-light/10' : ''
                        } ${!notification.read ? 'bg-jdc-blue-dark/30' : ''}`}
                      >
                        <div className="flex-1 min-w-0" onClick={() => onMarkAsRead(notification.id)}>
                          {notification.link ? (
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
                        {!notification.read && (
                          <div className="w-2 h-2 bg-jdc-yellow rounded-full ml-2 mt-2 flex-shrink-0" />
                        )}
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
};

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
        {notification.title}
      </p>
      <p className="text-sm text-jdc-gray-300 line-clamp-2">
        {notification.message}
      </p>
      <p className="text-xs text-jdc-gray-400 mt-1">
        {timeAgo(notification.timestamp)}
      </p>
    </>
  );
};

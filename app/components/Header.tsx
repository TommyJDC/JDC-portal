import React, { Fragment } from 'react';
import { Link, NavLink, Form } from '@remix-run/react';
import { 
  FaBars,
  FaUserCircle,
  FaSignOutAlt,
  FaSignInAlt,
  FaCog,
  FaTachometerAlt,
  FaTicketAlt,
  FaTruck,
  FaSearch,
  FaFileAlt,
  FaChevronDown,
  FaBug,
  FaUser,
  FaGoogle
} from 'react-icons/fa';
import { Button } from './ui/Button';
import type { UserSession } from '~/services/session.server';
import type { UserProfile, Notification } from '~/types/firestore.types';
import { Menu, Transition } from '@headlessui/react';

import { NotificationsDropdown, type NotificationDisplay } from './NotificationsDropdown';
import { useEffect, useState } from 'react';
import { ClientOnly } from './ClientOnly';

interface HeaderProps {
  user: UserSession | null;
  profile: UserProfile | null;
  onToggleMobileMenu: () => void;
  onLoginClick: () => void;
  loadingAuth: boolean;
}

// Main navigation items
const navItems = [
  { name: 'Tableau de Bord', to: '/dashboard', icon: FaTachometerAlt },
];

// Technique menu items
const techniqueItems = [
  { name: 'Tickets SAP', to: '/tickets-sap', icon: FaTicketAlt },
  { 
    name: 'Installations',
    subItems: [
      { name: 'Kezia', to: '/installations/kezia', icon: FaFileAlt },
      { name: 'CHR', to: '/installations/chr', icon: FaFileAlt },
      { name: 'HACCP', to: '/installations/haccp', icon: FaFileAlt },
      { name: 'Tabac', to: '/installations/tabac', icon: FaFileAlt },
    ]
  },
];

// Logistique menu items
const logistiqueItems = [
  { name: 'Envois CTN', to: '/envois-ctn', icon: FaTruck },
  { name: 'Recherche Articles', to: '/articles', icon: FaSearch },
];

// Commercial menu items (vide pour le moment)
const commercialItems: { name: string; to: string; icon: any; disabled?: boolean }[] = [];

// Define Admin item separately
const adminItem = { name: 'Admin', to: '/admin', icon: FaCog };

const JDC_LOGO_URL = "https://www.jdc.fr/images/logo_jdc_blanc.svg";

export const Header: React.FC<HeaderProps> = ({ user, profile, onToggleMobileMenu, onLoginClick, loadingAuth }) => {
  const [notifications, setNotifications] = useState<NotificationDisplay[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    if (user) {
      // Initialiser les notifications
      const fetchNotifications = async () => {
        try {
          const response = await fetch(`/api/notifications/list?userId=${user.userId}`);
          if (response.ok) {
            const data = await response.json();
            setNotifications(data.notifications.map((notification: any) => ({
              ...notification,
              timestamp: notification.timestamp
            })));
            setNotificationCount(data.unreadCount);
          }
        } catch (error) {
          console.error('Error fetching notifications:', error);
        }
      };

      fetchNotifications();

      // Rafraîchir toutes les 30 secondes
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const handleMarkAsRead = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: 'POST',
      });
      if (response.ok) {
        setNotifications(prev => 
          prev.map(notif => 
            notif.id === id ? { ...notif, read: true } : notif
          )
        );
        setNotificationCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleClearAll = async () => {
    if (!user) return;
    try {
      const response = await fetch('/api/notifications/clear', {
        method: 'POST',
      });
      if (response.ok) {
        setNotifications([]);
        setNotificationCount(0);
      }
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    try {
      const response = await fetch(`/api/notifications/mark-all-read`, {
        method: 'POST',
        body: JSON.stringify({ userId: user.userId }),
      });
      if (response.ok) {
        setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
        setNotificationCount(0);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };
  const linkActiveClass = "text-jdc-yellow relative after:content-[''] after:absolute after:bottom-[-0.5rem] after:left-0 after:w-full after:h-[2px] after:bg-jdc-yellow after:transform after:scale-x-100 after:transition-transform";
  const linkInactiveClass = "text-jdc-gray-300 hover:text-jdc-yellow transition-colors relative after:content-[''] after:absolute after:bottom-[-0.5rem] after:left-0 after:w-full after:h-[2px] after:bg-jdc-yellow after:transform after:scale-x-0 hover:after:scale-x-100 after:transition-transform";
  const menuButtonClass = `${linkInactiveClass} font-medium flex items-center transition-all duration-200 ease-in-out hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75`;
  const menuItemBaseClass = 'group flex w-full items-center rounded-md px-2 py-2 text-sm';

  // Determine if the Admin link should be shown
  const showAdminLink = !loadingAuth && profile?.role?.toLowerCase() === 'admin';
  
  // Logs pour le débogage
  console.log('Header - loadingAuth:', loadingAuth);
  console.log('Header - profile:', profile);
  console.log('Header - profile?.role:', profile?.role);
  console.log('Header - profile?.role?.toLowerCase():', profile?.role?.toLowerCase());
  console.log('Header - showAdminLink:', showAdminLink);

  return (
    <header className="bg-jdc-blue-dark border-b border-jdc-gray-800 py-3 px-4 md:px-6 sticky top-0 z-40 shadow-lg backdrop-blur-sm bg-opacity-95">
      <div className="flex justify-between items-center max-w-7xl mx-auto">
        {/* Left Section: Logo, Mobile Button, Desktop Nav */}
        <div className="flex items-center space-x-4 md:space-x-6">
          <Link to={user ? "/dashboard" : "/"} className="flex-shrink-0">
            <img src={JDC_LOGO_URL} alt="JDC Logo" className="h-8 w-auto" />
          </Link>
          {/* Mobile Menu Button */}
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden text-jdc-gray-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-jdc-yellow focus:ring-opacity-50"
            aria-label="Ouvrir le menu"
            aria-expanded="false"
            aria-haspopup="true"
          >
                  <FaBars className="text-lg" />
          </button>

          {/* Desktop Navigation */}
          {user && !loadingAuth && (
            <nav className="hidden md:flex space-x-6 items-center">
              {/* Regular Nav Items */}
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `${isActive ? linkActiveClass : linkInactiveClass} font-medium flex items-center transition-transform duration-200 ease-in-out hover:scale-105`}
                  prefetch="intent"
                >
                  <item.icon className="mr-1.5" />
                  {item.name}
                </NavLink>
              ))}

              {/* Technique Menu */}
              <Menu as="div" className="relative inline-block text-left">
                <div>
                  <Menu.Button className={menuButtonClass}>
                    <span>Technique</span>
                    <FaChevronDown className="ml-1.5 h-4 w-4" aria-hidden="true" />
                  </Menu.Button>
                </div>
                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-100"
                  enterFrom="transform opacity-0 scale-95"
                  enterTo="transform opacity-100 scale-100"
                  leave="transition ease-in duration-75"
                  leaveFrom="transform opacity-100 scale-100"
                  leaveTo="transform opacity-0 scale-95"
                >
                  <Menu.Items className="absolute left-0 mt-2 w-48 origin-top-left divide-y divide-jdc-gray-700 rounded-md bg-jdc-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                    <div className="px-1 py-1">
                      {techniqueItems.map((item) => 
                        item.subItems ? (
                          <div key={item.name} className="py-1">
                            <div className="px-3 py-1 text-xs font-semibold text-jdc-gray-400 uppercase">
                              {item.name}
                            </div>
                            {item.subItems.map((subItem) => (
                              <Menu.Item key={subItem.name}>
                                {({ active }) => (
                                  <NavLink
                                    to={subItem.to}
                                    className={`${menuItemBaseClass} ${
                                      active ? 'bg-jdc-blue text-white' : 'text-jdc-gray-300'
                                    } hover:bg-jdc-gray-700 hover:text-white pl-6`}
                                  >
                                    <subItem.icon className="mr-2 h-5 w-5" aria-hidden="true" />
                                    {subItem.name}
                                  </NavLink>
                                )}
                              </Menu.Item>
                            ))}
                          </div>
                        ) : (
                          <Menu.Item key={item.name}>
                            {({ active }) => (
                              <NavLink
                                to={item.to}
                                className={`${menuItemBaseClass} ${
                                  active ? 'bg-jdc-blue text-white' : 'text-jdc-gray-300'
                                } hover:bg-jdc-gray-700 hover:text-white`}
                              >
                                <item.icon className="mr-2 h-5 w-5" aria-hidden="true" />
                                {item.name}
                              </NavLink>
                            )}
                          </Menu.Item>
                        )
                      )}
                    </div>
                  </Menu.Items>
                </Transition>
              </Menu>

              {/* Logistique Menu */}
              <Menu as="div" className="relative inline-block text-left">
                <div>
                  <Menu.Button className={menuButtonClass}>
                    <span>Logistique</span>
                    <FaChevronDown className="ml-1.5 h-4 w-4" aria-hidden="true" />
                  </Menu.Button>
                </div>
                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-100"
                  enterFrom="transform opacity-0 scale-95"
                  enterTo="transform opacity-100 scale-100"
                  leave="transition ease-in duration-75"
                  leaveFrom="transform opacity-100 scale-100"
                  leaveTo="transform opacity-0 scale-95"
                >
                  <Menu.Items className="absolute left-0 mt-2 w-48 origin-top-left divide-y divide-jdc-gray-700 rounded-md bg-jdc-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                    <div className="px-1 py-1">
                      {logistiqueItems.map((item) => (
                        <Menu.Item key={item.name}>
                          {({ active }) => (
                            <NavLink
                              to={item.to}
                              className={`${menuItemBaseClass} ${
                                active ? 'bg-jdc-blue text-white' : 'text-jdc-gray-300'
                              } hover:bg-jdc-gray-700 hover:text-white`}
                            >
                              <item.icon className="mr-2 h-5 w-5" aria-hidden="true" />
                              {item.name}
                            </NavLink>
                          )}
                        </Menu.Item>
                      ))}
                    </div>
                  </Menu.Items>
                </Transition>
              </Menu>

              {/* Commercial Menu */}
              <Menu as="div" className="relative inline-block text-left">
                <div>
                  <Menu.Button className={`${menuButtonClass} opacity-50 cursor-not-allowed`}>
                    <span>Commercial</span>
                    <FaChevronDown className="ml-1.5 h-4 w-4" aria-hidden="true" />
                  </Menu.Button>
                </div>
                <Transition
                  as={Fragment}
                  enter="transition ease-out duration-100"
                  enterFrom="transform opacity-0 scale-95"
                  enterTo="transform opacity-100 scale-100"
                  leave="transition ease-in duration-75"
                  leaveFrom="transform opacity-100 scale-100"
                  leaveTo="transform opacity-0 scale-95"
                >
                  <Menu.Items className="absolute left-0 mt-2 w-48 origin-top-left divide-y divide-jdc-gray-700 rounded-md bg-jdc-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                    <div className="px-1 py-1">
                      {commercialItems.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-jdc-gray-400">
                          Aucun élément disponible
                        </div>
                      ) : (
                        commercialItems.map((item) => (
                          <Menu.Item key={item.name}>
                            {({ active }) => (
                              <NavLink
                                to={item.to}
                                className={`${menuItemBaseClass} ${
                                  active ? 'bg-jdc-blue text-white' : 'text-jdc-gray-300'
                                } hover:bg-jdc-gray-700 hover:text-white`}
                              >
                                <item.icon className="mr-2 h-5 w-5" aria-hidden="true" />
                                {item.name}
                              </NavLink>
                            )}
                          </Menu.Item>
                        ))
                      )}
                    </div>
                  </Menu.Items>
                </Transition>
              </Menu>

              {/* Admin Link */}
              {showAdminLink && (
                <NavLink
                  to={adminItem.to}
                  className={({ isActive }) => `${isActive ? linkActiveClass : linkInactiveClass} font-medium flex items-center transition-transform duration-200 ease-in-out hover:scale-105`}
                >
                  <adminItem.icon className="mr-1.5" />
                  {adminItem.name}
                </NavLink>
              )}
              
            </nav>
          )}
          {/* Loading Placeholder */}
          {loadingAuth && <div className="hidden md:block text-jdc-gray-400 text-sm">Chargement...</div>}
        </div>

        {/* Right Section: Search, Notifications, and User Actions */}
        <div className="flex items-center space-x-4">
          {user && (
            <>
              {/* Search Bar */}
              <div className="hidden lg:flex items-center relative">
                <div className="relative">
                  <input
                    type="search"
                    placeholder="Rechercher..."
                    className="bg-jdc-gray-800/50 text-jdc-gray-300 text-sm rounded-full pl-10 pr-4 py-1.5 w-48 focus:w-64 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-jdc-yellow/50 placeholder-jdc-gray-500"
                    aria-label="Barre de recherche"
                    role="searchbox"
                    aria-expanded="false"
                  />
                  <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-jdc-gray-500" />
                </div>
              </div>

              {/* Notifications */}
              <ClientOnly>
                {() => (
                  <NotificationsDropdown
                    notifications={notifications}
                    notificationCount={notificationCount}
                    onMarkAllAsRead={handleMarkAllAsRead}
                    onMarkAsRead={handleMarkAsRead}
                    onClearAll={handleClearAll}
                  />
                )}
              </ClientOnly>
            </>
          )}
          {loadingAuth ? (
            <div className="h-8 w-20 bg-jdc-gray-700 rounded animate-pulse"></div>
          ) : user ? (
            <Menu as="div" className="relative inline-block text-left">
              <Menu.Button 
                className="flex items-center space-x-2 text-jdc-gray-300 hover:text-white transition-colors p-1 rounded-full hover:bg-jdc-blue-light/20 focus:outline-none focus:ring-2 focus:ring-jdc-yellow focus:ring-opacity-50"
                aria-label="Menu utilisateur"
                aria-haspopup="true"
              >
                <FaUserCircle className="text-xl" />
                <span className="hidden sm:inline font-medium">
                  {profile?.displayName || user.displayName || user.email?.split('@')[0] || 'Utilisateur'}
                </span>
                <FaChevronDown className="hidden sm:inline h-4 w-4" />
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
                <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right rounded-md bg-jdc-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none divide-y divide-jdc-gray-700">
                  <div className="px-1 py-1">
                    <Menu.Item>
                      {({ active }) => (
                        <div className={`${menuItemBaseClass} ${active ? 'bg-jdc-blue text-white' : 'text-jdc-gray-300'}`}>
                          <FaUser className="mr-2" />
                          <div className="flex flex-col">
                            <span className="font-medium">{profile?.displayName || user.displayName}</span>
                            <span className="text-xs opacity-75">{user.email}</span>
                          </div>
                        </div>
                      )}
                    </Menu.Item>
                  </div>
                  <div className="px-1 py-1">
                    <Form method="post" action="/logout" className="w-full">
                      <Menu.Item>
                        {({ active }) => (
                          <button
                            type="submit"
                            className={`${menuItemBaseClass} w-full ${
                              active ? 'bg-red-600 text-white' : 'text-jdc-gray-300'
                            }`}
                          >
                            <FaSignOutAlt className="mr-2" />
                            Déconnexion
                          </button>
                        )}
                      </Menu.Item>
                    </Form>
                  </div>
                </Menu.Items>
              </Transition>
            </Menu>
          ) : (
            <div className="flex items-center space-x-2">
              <Form method="post" action="/auth/google">
                <Button type="submit" variant="secondary" size="sm" leftIcon={<FaGoogle />}>
                  <span className="hidden sm:inline">Google</span>
                </Button>
              </Form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

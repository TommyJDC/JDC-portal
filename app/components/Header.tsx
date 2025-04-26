import { Fragment, useEffect, useState } from 'react';
import { Link, NavLink, Form } from '@remix-run/react';
import {
  FaBars,
  FaUserCircle,
  FaSignOutAlt,
  FaCog,
  FaTachometerAlt,
  FaTicketAlt,
  FaTruck,
  FaSearch,
  FaFileAlt,
  FaChevronDown,
  FaUser,
  FaGoogle
} from 'react-icons/fa';
import { Menu, Transition } from '@headlessui/react';
// Firebase Client SDK imports
import { getFirestore, collection, query, orderBy, limit, onSnapshot, Timestamp } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { firebaseConfig } from '~/firebase.config';

// Initialize Firebase client-side
const firebaseApp = initializeApp(firebaseConfig);
import { Button } from './ui/Button';
import { ClientOnly } from './ClientOnly';
import { NotificationsDropdown, type NotificationDisplay } from './NotificationsDropdown';
import type { UserSession } from '~/services/session.server';
import type { UserProfile, Notification } from '~/types/firestore.types';

interface HeaderProps {
  user: UserSession | null;
  profile: UserProfile | null;
  onToggleMobileMenu: () => void;
  onLoginClick: () => void; // Keep onLoginClick as it's used in the parent component
  loadingAuth: boolean;
}

// Main navigation items
const navItems = [
  { name: 'Tableau de Bord', to: '/dashboard', icon: FaTachometerAlt },
];

// Technique menu items
const techniqueItems = [
  { name: 'Tickets SAP', to: '/tickets-sap', icon: FaTicketAlt },
  { name: 'Archive SAP', to: '/sap-archive', icon: FaFileAlt }, // Ajout du lien vers l'archive
  {
    name: 'Installations',
    subItems: [
      { name: 'Kezia', to: '/installations/kezia-firestore', icon: FaFileAlt },
      { name: 'CHR', to: '/installations/chr-firestore', icon: FaFileAlt },
      { name: 'HACCP', to: '/installations/haccp-firestore', icon: FaFileAlt },
      { name: 'Tabac', to: '/installations/tabac-firestore', icon: FaFileAlt },
    ]
  },
];

// Logistique menu items
const logistiqueItems = [
  { name: 'Envois CTN', to: '/envois-ctn', icon: FaTruck },
  { name: 'Recherche Articles', to: '/articles', icon: FaSearch },
];

// Commercial menu items
const commercialItems = [
  { name: 'Upload Menus', to: '/commercial/upload', icon: FaFileAlt }
];

// Define Admin item separately
const adminItem = { name: 'Admin', to: '/admin', icon: FaCog };

const JDC_LOGO_URL = "https://www.jdc.fr/images/logo_jdc_blanc.svg";

export const Header: React.FC<HeaderProps> = ({ user, profile, onToggleMobileMenu, onLoginClick, loadingAuth }) => {
  const [notifications, setNotifications] = useState<NotificationDisplay[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);

  // Real-time notification listener
  useEffect(() => {
    // Ensure user and profile are loaded before setting up listener
    if (!user?.userId || !profile) {
      setNotifications([]);
      setNotificationCount(0);
      return; // Exit if no user or profile
    }

    const db = getFirestore(firebaseApp);
    const notificationsRef = collection(db, 'notifications');

    // Query latest 100 notifications, order by creation time
    // Filtering by role/sector will happen client-side after fetching
    const q = query(notificationsRef, orderBy('createdAt', 'desc'), limit(100));

    const unsubscribe = onSnapshot(q, (querySnapshot: { docs: any[] }) => {
      const allNotifications = querySnapshot.docs.map((doc: { id: string; data: () => any }) => {
        const data = doc.data();
        // Convert Firestore Timestamp to JS Date
        const createdAtDate = data.createdAt instanceof Timestamp 
          ? data.createdAt.toDate() 
          : (data.createdAt ? new Date(data.createdAt) : new Date()); // Fallback if not Timestamp
        
        // Return as Notification first for filtering (using the imported type)
        return {
          id: doc.id,
          ...data,
          createdAt: createdAtDate, // Use Date object
        } as Notification; // Use the imported Notification type
      });

      // Filter notifications based on user profile (client-side)
      const filteredNotifications = allNotifications.filter((notif: Notification & { userId?: string; targetRoles?: string[]; sector?: string[] }) => {
        if (profile.role === 'Admin') return true; // Admins see all
        if (notif.userId === profile.uid) return true; // Targeted to user
        
        // Check roles - ensure targetRoles and profile.role exist
        if (notif.targetRoles && Array.isArray(notif.targetRoles) && profile.role && notif.targetRoles.includes(profile.role)) return true; 
        
        // Check sectors - ensure sector, profile.secteurs exist and are arrays
        if (notif.sector && Array.isArray(notif.sector) && profile.secteurs && Array.isArray(profile.secteurs) && notif.sector.some((s: string) => profile.secteurs.includes(s))) return true; // Explicitly type s
        
        return false; // User should not see this notification
      });

      // Map to NotificationDisplay format for the dropdown component
      const displayNotifications = filteredNotifications.map(notif => {
        // Ensure createdAt is a Date before calling toISOString()
        const createdAtDate = notif.createdAt instanceof Date 
          ? notif.createdAt 
          : (notif.createdAt as Timestamp).toDate(); // Cast to Timestamp if not Date, then convert

        return {
          ...notif,
          // Convert Date to string (ISO format) for NotificationDisplay.timestamp
          timestamp: createdAtDate.toISOString(), 
        };
      });

      setNotifications(displayNotifications);
      setNotificationCount(displayNotifications.filter((n: NotificationDisplay) => !n.read).length);

    }, (error) => {
      console.error("Error fetching notifications in real-time:", error);
      // Optionally clear state or show an error message
      setNotifications([]);
      setNotificationCount(0);
    });

    // Cleanup subscription on component unmount or when user/profile changes
    return () => unsubscribe();

  }, [user?.userId, profile]); // Re-run effect if user or profile changes

  // --- Handler functions remain largely the same, they modify data which triggers the listener ---

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
  const linkActiveClass = "text-jdc-yellow font-semibold flex items-center transition-colors duration-200 ease-in-out hover:scale-105 text-lg";
  const linkInactiveClass = "text-jdc-gray-300 hover:text-jdc-yellow font-semibold flex items-center transition-colors duration-200 ease-in-out hover:scale-105 text-lg";
  const menuButtonClass = `text-jdc-gray-300 hover:text-jdc-yellow font-semibold flex items-center transition-colors duration-200 ease-in-out hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 text-lg`;
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
<header className="bg-gray-900 p-4 shadow-lg border-b border-gray-800 sticky top-0 z-40">
      <div className="flex justify-between items-center max-w-7xl mx-auto px-4">
        {/* Logo */}
        <div className="flex items-center">
          <Link to={user ? "/dashboard" : "/"} className="flex-shrink-0">
            <img 
              src={JDC_LOGO_URL} 
              alt="JDC Logo" 
              className="h-8 w-auto"
              width={120}
              height={32}
            />
          </Link>
          {/* Mobile Menu Button */}
          {/* Mobile Menu Button */}
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden ml-4 text-gray-400 hover:text-white"
            aria-label="Menu mobile"
            aria-expanded="false"
          >
            <FaBars className="w-5 h-5" />
          </button>

          {/* Desktop Navigation */}
          {user && !loadingAuth && (
            <nav className="hidden md:flex space-x-6 items-center">
              {/* Regular Nav Items */}
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => 
                    `flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                      isActive 
                        ? 'bg-gray-800 text-white' 
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`
                  }
                  prefetch="intent"
                >
                  <item.icon className="mr-2 w-5 h-5" />
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
                                    active ? 'bg-jdc-gray-700 text-white' : 'text-jdc-gray-300'
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
                                  active ? 'bg-jdc-gray-700 text-white' : 'text-jdc-gray-300'
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
                                active ? 'bg-jdc-gray-700 text-white' : 'text-jdc-gray-300'
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
                  <Menu.Button className={menuButtonClass}>
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
                                active ? 'bg-jdc-gray-700 text-white' : 'text-jdc-gray-300'
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
                  <adminItem.icon className="mr-1.5 w-5 h-5" />
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
                  />
                  <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-jdc-gray-500 w-5 h-5" />
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
                <FaUserCircle className="w-5 h-5" />
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
                        <div className={`${menuItemBaseClass} ${active ? 'bg-jdc-gray-700 text-white' : 'text-jdc-gray-300'}`}>
                          <FaUser className="mr-2 w-5 h-5" />
                          <div className="flex flex-col">
                            <span className="font-medium">{profile?.displayName || user.displayName}</span>
                            <span className="text-xs opacity-75">{user.email}</span>
                          </div>
                        </div>
                      )}
                    </Menu.Item>
                  </div>
                  <div className="px-1 py-1">
                     <NavLink
                      to="/user-profile"
                      className={({ isActive }) => `${menuItemBaseClass} ${
                        isActive ? 'bg-jdc-gray-700 text-white' : 'text-jdc-gray-300'
                      }`}
                    >
                      <FaUser className="mr-2 w-5 h-5" />
                      Mon Profil
                    </NavLink>
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
                            <FaSignOutAlt className="mr-2 w-5 h-5" />
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

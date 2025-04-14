import React, { Fragment } from 'react'; // Import Fragment
import { Link, NavLink, Form } from '@remix-run/react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faUserCircle, faSignOutAlt, faSignInAlt, faCog, faTachometerAlt, faTicketAlt, faTruck, faSearch, faSheetPlastic, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { faGoogle } from '@fortawesome/free-brands-svg-icons';
 import { Button } from './ui/Button';
 import type { UserSession } from '~/services/session.server';
 import type { UserProfile } from '~/types/firestore.types';
 import { Menu, Transition } from '@headlessui/react'; // Import Headless UI Menu

 interface HeaderProps {
   user: UserSession | null;
  profile: UserProfile | null;
  onToggleMobileMenu: () => void;
  onLoginClick: () => void;
  loadingAuth: boolean;
}

// Main navigation items (excluding installations dropdown)
const navItems = [
  { name: 'Tableau de Bord', to: '/dashboard', icon: faTachometerAlt },
  { name: 'Tickets SAP', to: '/tickets-sap', icon: faTicketAlt },
  { name: 'Envois CTN', to: '/envois-ctn', icon: faTruck },
  { name: 'Recherche Articles', to: '/articles', icon: faSearch },
  // Removed 'Install Kezia'
];

// Items for the Installations dropdown
const installationItems = [
    { name: 'Kezia', to: '/installations/kezia', disabled: false, icon: faSheetPlastic }, // Added icon
    { name: 'CHR', to: '#', disabled: true, icon: faSheetPlastic }, // Placeholder link
    { name: 'HACCP', to: '#', disabled: true, icon: faSheetPlastic }, // Placeholder link
    { name: 'Tabac', to: '#', disabled: true, icon: faSheetPlastic }, // Placeholder link
];

// Define Admin item separately
const adminItem = { name: 'Admin', to: '/admin', icon: faCog };

const JDC_LOGO_URL = "https://www.jdc.fr/images/logo_jdc_blanc.svg";

export const Header: React.FC<HeaderProps> = ({ user, profile, onToggleMobileMenu, onLoginClick, loadingAuth }) => {
  const linkActiveClass = "text-jdc-yellow";
  const linkInactiveClass = "text-jdc-gray-300 hover:text-jdc-yellow transition-colors";
  // Base classes for menu button to match nav links
  const menuButtonClass = `${linkInactiveClass} font-medium flex items-center transition-transform duration-200 ease-in-out hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75`;
  // Base classes for menu items
  const menuItemBaseClass = "group flex w-full items-center rounded-md px-3 py-2 text-sm"; // Adjusted padding/alignment

  // Determine if the Admin link should be shown
  const showAdminLink = !loadingAuth && profile?.role?.toLowerCase() === 'admin';

  return (
    <header className="bg-jdc-blue-dark border-b border-jdc-gray-800 py-3 px-4 md:px-6 sticky top-0 z-40">
      <div className="flex justify-between items-center max-w-7xl mx-auto">
        {/* Left Section: Logo, Mobile Button, Desktop Nav */}
        <div className="flex items-center space-x-4 md:space-x-6">
           <Link to={user ? "/dashboard" : "/"} className="flex-shrink-0">
             <img src={JDC_LOGO_URL} alt="JDC Logo" className="h-8 w-auto" />
           </Link>
           {/* Mobile Menu Button */}
           <button
             onClick={onToggleMobileMenu}
             className="md:hidden text-jdc-gray-300 hover:text-white focus:outline-none"
             aria-label="Ouvrir le menu"
           >
             <FontAwesomeIcon icon={faBars} size="lg" />
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
                   <FontAwesomeIcon icon={item.icon} className="mr-1.5" />
                   {item.name}
                 </NavLink>
               ))}

               {/* Installations Dropdown Menu */}
               <Menu as="div" className="relative inline-block text-left">
                 <div>
                   <Menu.Button className={menuButtonClass}>
                     <span>Installations</span>
                     <FontAwesomeIcon icon={faChevronDown} className="ml-1.5 h-4 w-4" aria-hidden="true" />
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
                     <div className="px-1 py-1 ">
                       {installationItems.map((item) => (
                         <Menu.Item key={item.name} disabled={item.disabled}>
                           {({ active, disabled }) => (
                             <NavLink
                               to={item.to}
                               className={`${menuItemBaseClass} ${
                                 active ? 'bg-jdc-blue text-white' : 'text-jdc-gray-300'
                               } ${
                                 disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-jdc-gray-700 hover:text-white'
                               }`}
                               onClick={(e) => { if (disabled) e.preventDefault(); }}
                               aria-disabled={disabled}
                             >
                               <FontAwesomeIcon icon={item.icon} className="mr-2 h-5 w-5" aria-hidden="true" />
                               {item.name}
                               {disabled && <span className="text-xs ml-1 opacity-75">(Bientôt)</span>}
                             </NavLink>
                           )}
                         </Menu.Item>
                       ))}
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
                    <FontAwesomeIcon icon={adminItem.icon} className="mr-1.5" />
                   {adminItem.name}
                 </NavLink>
               )}
             </nav>
           )}
           {/* Loading Placeholder */}
           {loadingAuth && <div className="hidden md:block text-jdc-gray-400 text-sm">Chargement...</div>}
        </div>

        {/* Right Section: User Actions */}
        <div className="flex items-center space-x-3">
          {loadingAuth ? (
             <div className="h-8 w-20 bg-jdc-gray-700 rounded animate-pulse"></div>
          ) : user ? (
            <>
              <span className="text-jdc-gray-300 hidden sm:inline" title={user.email ?? ''}>
                <FontAwesomeIcon icon={faUserCircle} className="mr-1" />
                {profile?.displayName || user.displayName || user.email?.split('@')[0] || 'Utilisateur'}
              </span>
              <Form method="post" action="/logout">
                <Button type="submit" variant="secondary" size="sm" title="Déconnexion">
                  <FontAwesomeIcon icon={faSignOutAlt} />
                  <span className="sr-only sm:not-sr-only sm:ml-1">Déconnexion</span>
                </Button>
              </Form>
            </>
          ) : (
            <div className="flex items-center space-x-2">
               <Button variant="primary" size="sm" onClick={onLoginClick} leftIcon={<FontAwesomeIcon icon={faSignInAlt} />}>
                 Connexion
                </Button>
                <Form method="post" action="/auth/google">
                  <Button type="submit" variant="secondary" size="sm" leftIcon={<FontAwesomeIcon icon={faGoogle} />}>
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

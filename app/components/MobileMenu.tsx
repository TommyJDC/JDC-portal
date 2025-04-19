import React from 'react';
import { Link, NavLink } from '@remix-run/react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
 import { faTimes, faUserCircle, faSignOutAlt, faSignInAlt, faTachometerAlt, faTicketAlt, faTruck, faCog, faBug, faSearch, faSheetPlastic } from '@fortawesome/free-solid-svg-icons'; // Added faCog, faBug, faSheetPlastic
 import { Button } from './ui/Button';
 // Use UserSession from server loader instead of AppUser from client-side auth
 // import type { AppUser } from '~/services/auth.service';
 import type { UserSession } from '~/services/session.server'; // Import UserSession
 import type { UserProfile } from '~/types/firestore.types'; // Import UserProfile

 interface MobileMenuProps {
   isOpen: boolean;
   onClose: () => void;
   user: UserSession | null; // Use UserSession type
   profile: UserProfile | null; // Use profile from context
   onLoginClick: () => void;
   // Remove onLogoutClick as it's handled by Header form
   loadingAuth: boolean; // Add loadingAuth prop
 }

const navItems = [
  { name: 'Tableau de Bord', to: '/dashboard', icon: faTachometerAlt },
  { name: 'Tickets SAP', to: '/tickets-sap', icon: faTicketAlt },
  { name: 'Envois CTN', to: '/envois-ctn', icon: faTruck },
  { name: 'Recherche Articles', to: '/articles', icon: faSearch },
];

// Installation items (now part of Technique section)
const techniqueInstallationItems = [
  { name: 'Kezia', to: '/installations/kezia', icon: faSheetPlastic },
  { name: 'CHR', to: '/installations/chr', icon: faSheetPlastic },
  { name: 'HACCP', to: '/installations/haccp', icon: faSheetPlastic },
  { name: 'Tabac', to: '/installations/tabac', icon: faSheetPlastic },
];

// Define Admin item separately
const adminItem = { name: 'Admin', to: '/admin', icon: faCog };

// Debug item - always visible
const debugItem = { name: 'Diagnostic', to: '/debug-index', icon: faBug };

 const JDC_LOGO_URL = "https://www.jdc.fr/images/logo_jdc_blanc.svg"; // Re-add logo URL if needed

 export const MobileMenu: React.FC<MobileMenuProps> = ({ isOpen, onClose, user, profile, onLoginClick, loadingAuth }) => { // Removed onLogoutClick
  const linkActiveClass = "text-jdc-yellow bg-jdc-gray-800/50 border-l-2 border-jdc-yellow";
  const linkInactiveClass = "text-jdc-gray-300 hover:text-white hover:bg-jdc-gray-700/50 hover:border-l-2 hover:border-jdc-yellow/50";
  const linkBaseClass = "flex items-center px-3 py-2 rounded-md text-base font-medium transition-all duration-200 ease-in-out";

  // Determine if the Admin link should be shown
  const showAdminLink = !loadingAuth && profile?.role?.toLowerCase() === 'admin';

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
      onClick={onClose}
      aria-hidden="true"
    >
      <div
        className="fixed inset-y-0 left-0 w-72 bg-jdc-blue-darker/95 shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Menu Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-jdc-gray-800">
           <Link to={user ? "/dashboard" : "/"} onClick={onClose}>
             <img src={JDC_LOGO_URL} alt="JDC Logo" className="h-8 w-auto" />
           </Link>
          <button
            onClick={onClose}
            className="text-jdc-gray-400 hover:text-white focus:outline-none"
            aria-label="Fermer le menu"
          >
            <FontAwesomeIcon icon={faTimes} size="lg" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-2 py-4 space-y-1">
          {loadingAuth ? (
             <div className="px-3 py-2 text-jdc-gray-400">Chargement...</div>
          ) : user ? (
            <>
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose} // Close menu on link click
                  className={({ isActive }) => `${linkBaseClass} ${isActive ? linkActiveClass : linkInactiveClass}`}
                  prefetch="intent" // Keep prefetch for other items
                >
                  <FontAwesomeIcon icon={item.icon} className="mr-3 h-5 w-5" />
                  {item.name}
                </NavLink>
              ))}

              {/* Technique Section with Installations */}
              <div className="pt-2 mt-2 border-t border-jdc-gray-700/50">
                <span className="px-3 text-xs font-semibold uppercase text-jdc-gray-400">Technique - Installations</span>
                {techniqueInstallationItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    className={({ isActive }) => `${linkBaseClass} pl-6 ${isActive ? linkActiveClass : linkInactiveClass}`}
                    prefetch="intent"
                  >
                    <FontAwesomeIcon icon={item.icon} className="mr-3 h-5 w-5" />
                    {item.name}
                  </NavLink>
                ))}
              </div>

              {/* Conditionally render Admin link */}
              {showAdminLink && (
                <NavLink
                  to={adminItem.to}
                  onClick={onClose}
                  className={({ isActive }) => `${linkBaseClass} ${isActive ? linkActiveClass : linkInactiveClass}`}
                  // Removed prefetch="intent" for Admin link
                >
                  <FontAwesomeIcon icon={adminItem.icon} className="mr-3 h-5 w-5" />
                  {adminItem.name}
                </NavLink>
              )}
              
              {/* Debug Link - Only visible for admins */}
              {showAdminLink && (
                <NavLink
                  to={debugItem.to}
                  onClick={onClose}
                  className={({ isActive }) => `${linkBaseClass} ${isActive ? linkActiveClass : linkInactiveClass}`}
                >
                  <FontAwesomeIcon icon={debugItem.icon} className="mr-3 h-5 w-5" />
                  {debugItem.name}
                </NavLink>
              )}
            </>
          ) : (
            <div className="px-3 py-2 text-jdc-gray-400">Veuillez vous connecter.</div>
          )}
        </nav>

        {/* User Info / Actions Footer */}
        <div className="border-t border-jdc-gray-800 p-4 bg-jdc-blue-dark/50">
          {loadingAuth ? (
            <div className="h-10 bg-jdc-gray-700 rounded animate-pulse"></div>
          ) : user ? (
            <div className="space-y-3">
              <div className="flex items-center space-x-3 text-sm text-jdc-gray-300 p-2 rounded-lg bg-jdc-gray-800/30">
                <FontAwesomeIcon icon={faUserCircle} className="h-6 w-6" />
                <div className="flex flex-col">
                  <span className="font-medium truncate" title={user.email ?? ''}>
                    {profile?.displayName || user.displayName || user.email?.split('@')[0]}
                  </span>
                  <span className="text-xs text-jdc-gray-400 truncate">
                    {user.email}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <Button 
              variant="primary" 
              size="sm" 
              onClick={() => { onLoginClick(); onClose(); }} 
              className="w-full transition-transform hover:scale-105" 
              leftIcon={<FontAwesomeIcon icon={faSignInAlt} />}
            >
              Connexion
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

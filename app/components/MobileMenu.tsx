import React from 'react';
import { Link, NavLink, Form } from '@remix-run/react'; // Ajout de Form
import {
  FaTimes,
  FaUserCircle,
  FaSignOutAlt,
  FaSignInAlt,
  FaTachometerAlt,
  FaTicketAlt,
  FaTruck,
  FaCog,
  FaSearch,
  FaFileAlt,
  FaChartLine
} from 'react-icons/fa';
 import { Button } from './ui/Button';
 // Use UserSession from server loader instead of AppUser from client-side auth
 // import type { AppUser } from '~/services/auth.service';
 import type { UserSessionData } from '~/services/session.server'; // Import UserSessionData
 import type { UserProfile } from '~/types/firestore.types'; // Import UserProfile

 interface MobileMenuProps {
   isOpen: boolean;
   onClose: () => void;
   user: UserSessionData | null; // Use UserSessionData type
   profile: UserProfile | null; // Use profile from context
   onLoginClick: () => void;
   // Remove onLogoutClick as it's handled by Header form
   loadingAuth: boolean; // Add loadingAuth prop
 }

// Main navigation items
const navItems = [
  { name: 'Tableau de Bord', to: '/dashboard', icon: FaTachometerAlt },
  { name: 'Dashboard Directeur', to: '/directeur-dashboard', icon: FaChartLine },
];

// Technique menu items
const techniqueItems = [
  { name: 'Suivie des SAP', to: '/tickets-sap', icon: FaTicketAlt },
  { name: 'Archive SAP', to: '/sap-archive', icon: FaFileAlt },
  { name: 'Installations Kezia', to: '/installations/kezia-firestore', icon: FaFileAlt },
  { name: 'Installations CHR', to: '/installations/chr-firestore', icon: FaFileAlt },
  { name: 'Installations HACCP', to: '/installations/haccp-firestore', icon: FaFileAlt },
  { name: 'Installations Tabac', to: '/installations/tabac-firestore', icon: FaFileAlt },
];

// Logistique menu items
const logistiqueItems = [
  { name: 'Envois CTN', to: '/envois-ctn', icon: FaTruck },
  { name: 'Recherche Articles', to: '/articles', icon: FaSearch },
  { name: 'Suivie demande de RMA', to: '/logistique/grenoble', icon: FaTruck },
];

// Commercial menu items
const commercialItems = [
  { name: 'Upload Menus', to: '/commercial/upload', icon: FaFileAlt },
  { name: 'Tickets SAP', to: '/commercial/tickets-sap-create', icon: FaTicketAlt },
];

// Define Admin item separately
const adminItem = { name: 'Admin', to: '/admin', icon: FaCog };

 const JDC_LOGO_URL = "https://www.jdc.fr/images/logo_jdc_blanc.svg"; // Re-add logo URL if needed

 export const MobileMenu: React.FC<MobileMenuProps> = ({ isOpen, onClose, user, profile, onLoginClick, loadingAuth }) => {
  const linkActiveClass = "text-brand-blue bg-ui-border font-semibold"; // Actif: texte bleu, fond légèrement contrastant
  const linkInactiveClass = "text-text-secondary hover:text-text-primary hover:bg-ui-border";
  const linkBaseClass = "flex items-center px-3 py-2 rounded-md text-base font-medium transition-colors duration-150";

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
        className="fixed inset-y-0 left-0 w-72 p-4 shadow-2xl border-r border-white/20 bg-white/10 backdrop-blur-md z-50 flex flex-col transform" // Utilisation des classes Tailwind pour glassmorphisme
        onClick={(e) => e.stopPropagation()}
      >
        {/* Menu Header */}
        <div className="flex items-center justify-between px-2 py-3 border-b border-white/10"> {/* Bordure cohérente */}
           <Link to={user ? "/dashboard" : "/"} onClick={onClose} className="text-xl font-bold text-text-primary">
             JDC Portal {/* Correspond au Header */}
           </Link>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary focus:outline-none p-1 rounded-md hover:bg-ui-border"
            aria-label="Fermer le menu"
          >
            <FaTimes size={18} />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {loadingAuth ? (
             <div className="px-3 py-2 text-text-secondary">Chargement...</div>
          ) : user ? (
            <>
              {/* Regular Nav Items */}
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose} // Close menu on link click
                  className={({ isActive }) => `${linkBaseClass} ${isActive ? linkActiveClass : linkInactiveClass}`}
                  prefetch="intent"
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                </NavLink>
              ))}

              {/* Technique Section */}
              <div className="pt-3 mt-3 border-t border-white/10"> {/* Bordure cohérente */}
                <span className="px-3 text-xs font-semibold uppercase text-text-tertiary tracking-wider">Technique</span>
                {techniqueItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    className={({ isActive }) => `${linkBaseClass} pl-6 ${isActive ? linkActiveClass : linkInactiveClass}`}
                    prefetch="intent"
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </NavLink>
                ))}
              </div>

              {/* Logistique Section */}
              <div className="pt-3 mt-3 border-t border-white/10"> {/* Bordure cohérente */}
                <span className="px-3 text-xs font-semibold uppercase text-text-tertiary tracking-wider">Logistique</span>
                {logistiqueItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    className={({ isActive }) => `${linkBaseClass} pl-6 ${isActive ? linkActiveClass : linkInactiveClass}`}
                    prefetch="intent"
                  >
                    <item.icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </NavLink>
                ))}
              </div>

              {/* Commercial Section */}
              <div className="pt-3 mt-3 border-t border-white/10"> {/* Bordure cohérente */}
                <span className="px-3 text-xs font-semibold uppercase text-text-tertiary tracking-wider">Commercial</span>
                {commercialItems.length === 0 ? (
                   <div className="px-3 py-2 text-sm text-text-secondary">
                     Aucun élément disponible
                   </div>
                ) : (
                  commercialItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onClose}
                      className={({ isActive }) => `${linkBaseClass} pl-6 ${isActive ? linkActiveClass : linkInactiveClass}`}
                      prefetch="intent"
                    >
                      <item.icon className="mr-3 h-5 w-5" />
                      {item.name}
                    </NavLink>
                  ))
                )}
              </div>


              {/* Conditionally render Admin link */}
              {showAdminLink && (
                <div className="pt-3 mt-3 border-t border-white/10"> {/* Bordure cohérente */}
                  <NavLink
                    to={adminItem.to}
                    onClick={onClose}
                    className={({ isActive }) => `${linkBaseClass} ${isActive ? linkActiveClass : linkInactiveClass}`}
                    prefetch="intent"
                  >
                    <adminItem.icon className="mr-3 h-5 w-5" />
                    {adminItem.name}
                  </NavLink>
                </div>
              )}
            </>
          ) : (
            <div className="px-3 py-2 text-text-secondary">Veuillez vous connecter.</div>
          )}
        </nav>

        {/* User Info / Actions Footer */}
        <div className="mt-auto border-t border-white/10 p-4 bg-white/5"> {/* Footer avec fond légèrement différent et bordure cohérente */}
          {loadingAuth ? (
            <div className="h-10 bg-ui-border rounded animate-pulse"></div>
          ) : user ? (
            <div className="space-y-3">
              <div className="flex items-center space-x-3 text-sm text-text-primary p-2 rounded-lg bg-ui-border">
                <FaUserCircle className="h-6 w-6 text-brand-blue" />
                <div className="flex flex-col overflow-hidden">
                  <span className="font-medium truncate" title={user.email ?? ''}>
                    {profile?.displayName || user.displayName || user.email?.split('@')[0]}
                  </span>
                  <span className="text-xs text-text-secondary truncate">
                    {user.email}
                  </span>
                </div>
              </div>
               {/* Bouton Déconnexion */}
              <Form method="post" action="/logout" onSubmit={onClose}>
                <Button
                  type="submit"
                  variant="ghost" // ou un variant stylé pour la déconnexion
                  size="sm"
                  className="w-full !justify-start text-text-secondary hover:text-text-primary hover:!bg-ui-border"
                  leftIcon={<FaSignOutAlt />}
                >
                  Déconnexion
                </Button>
              </Form>
            </div>
          ) : (
            <Button 
              variant="primary" // Ce variant devrait utiliser bg-brand-blue
              size="sm" 
              onClick={() => { onLoginClick(); onClose(); }} 
              className="w-full transition-transform hover:scale-105 bg-brand-blue hover:bg-brand-blue-dark text-white"
              leftIcon={<FaSignInAlt />}
            >
              Connexion
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

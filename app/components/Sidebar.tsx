import React, { useState } from 'react';
import { Link, NavLink, Form, useLocation } from '@remix-run/react';
import type { UserSessionData } from '~/services/session.server';
import type { UserProfile } from '~/types/firestore.types';
import {
  FaTachometerAlt, FaTicketAlt, FaBuilding, FaTruck, FaUpload, FaCog, FaSignOutAlt, FaChevronDown, FaChevronUp, FaChartLine
} from 'react-icons/fa'; // Icônes existantes
import { Squares2X2Icon, ArrowPathIcon, CogIcon } from '@heroicons/react/24/outline'; // Nouvelles icônes pour un look plus moderne si besoin

interface SidebarProps {
  user: UserSessionData | null;
  profile: UserProfile | null;
  // isOpen et onClose ne sont plus nécessaires pour une sidebar fixe à gauche
}

// Styles pour les liens de la sidebar (adaptés au nouveau thème)
const baseLinkStyle = "flex items-center px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-150";
const activeLinkStyle = "bg-gradient-to-br from-brand-blue/60 to-brand-blue-dark/60 text-white backdrop-blur-sm"; // Glassmorphism actif
const inactiveLinkStyle = "text-text-secondary hover:text-text-primary hover:bg-white/10"; // Hover effet glassmorphism

const SidebarLink: React.FC<{ to: string; icon: React.ReactNode; label: string; active?: boolean; }> = ({ to, icon, label, active }) => (
  <NavLink
    to={to}
    className={`${baseLinkStyle} ${active ? activeLinkStyle : inactiveLinkStyle}`}
  >
    <span className="mr-3">{icon}</span>
    {label}
  </NavLink>
);

const SidebarMenu: React.FC<{ label: string; icon: React.ReactNode; open: boolean; onClick: () => void; active?: boolean; children: React.ReactNode; }> = 
  ({ label, icon, open, onClick, active, children }) => (
  <div>
    <button
      onClick={onClick}
      className={`${baseLinkStyle} w-full justify-between ${active ? "text-text-primary" : inactiveLinkStyle}`}
    >
      <div className="flex items-center">
        <span className="mr-3">{icon}</span>
        {label}
      </div>
      {open ? <FaChevronUp className="h-4 w-4" /> : <FaChevronDown className="h-4 w-4" />}
    </button>
    {open && <div className="mt-1 pl-4 space-y-1">{children}</div>}
  </div>
);

const SidebarSubLink: React.FC<{ to: string; label: string; icon?: React.ReactNode; }> = ({ to, label, icon }) => {
  const location = useLocation();
  const isActive = location.pathname.startsWith(to);
  return (
    <NavLink
      to={to}
      className={`${baseLinkStyle} text-xs ${isActive ? activeLinkStyle : inactiveLinkStyle}`}
    >
      {icon && <span className="mr-3">{icon}</span>}
      {label}
    </NavLink>
  );
};


export const Sidebar: React.FC<SidebarProps> = ({ user, profile }) => {
  const location = useLocation();
  const isAdmin = profile?.role?.toLowerCase() === 'admin';
  const isDirecteur = profile?.role?.toLowerCase() === 'directeur';
  const isAlexis = user?.email === 'alexis.lhersonneau@jdc.fr';
  // Les secteurs sont utilisés pour conditionner l'affichage de certains liens
  const secteurs = isAdmin ? ['CHR', 'Tabac', 'HACCP', 'Kezia'] : (profile?.secteurs || []);
  const [openMenus, setOpenMenus] = useState<{ [key: string]: boolean }>({
    installations: location.pathname.startsWith('/installations'),
    logistique: location.pathname.startsWith('/envois-ctn') || location.pathname.startsWith('/articles') || location.pathname.startsWith('/logistique'),
    commercial: location.pathname.startsWith('/commercial'),
  });

  const toggleMenu = (key: string) => setOpenMenus(prev => ({ ...prev, [key]: !prev[key] }));

  // Si pas d'utilisateur, on pourrait masquer la sidebar ou afficher un message,
  // mais pour l'instant, on la rend toujours pour la structure.
  // Le contenu des liens sera conditionné par `user` et `profile` si nécessaire.

  return (
    <aside 
      className="hidden md:flex md:flex-col md:w-64 border-r border-white/20 backdrop-blur-md bg-white/10 shadow-2xl"
      style={{ 
        boxShadow: '8px 0 32px 0 rgba(31, 38, 135, 0.15)'
      }}
    >
      <div className="p-4 border-b border-white/20">
        <h2 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Navigation</h2>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {/* Liens principaux */}
        <SidebarLink to="/dashboard" icon={<FaTachometerAlt />} label="Dashboard" active={location.pathname.startsWith('/dashboard')} />
        {(isAdmin || isAlexis) && (
          <SidebarLink to="/directeur-dashboard" icon={<FaChartLine />} label="Dashboard Directeur" active={location.pathname.startsWith('/directeur-dashboard')} />
        )}
        <SidebarLink to="/tickets-sap" icon={<FaTicketAlt />} label="Tickets SAP" active={location.pathname.startsWith('/tickets-sap')} />

        {/* Menu Installations */}
        <SidebarMenu
          label="Installations"
          icon={<FaBuilding />}
          open={!!openMenus['installations']}
          onClick={() => toggleMenu('installations')}
          active={location.pathname.startsWith('/installations')}
        >
          {secteurs.includes('CHR') && <SidebarSubLink to="/installations/chr-firestore" label="CHR" />}
          {secteurs.includes('Tabac') && <SidebarSubLink to="/installations/tabac-firestore" label="Tabac" />}
          {secteurs.includes('HACCP') && <SidebarSubLink to="/installations/haccp" label="HACCP" />}
          {secteurs.includes('Kezia') && <SidebarSubLink to="/installations/kezia-firestore" label="Kezia" />}
        </SidebarMenu>

        {/* Menu Logistique */}
        <SidebarMenu
          label="Logistique"
          icon={<FaTruck />}
          open={!!openMenus['logistique']}
          onClick={() => toggleMenu('logistique')}
          active={location.pathname.startsWith('/envois-ctn') || location.pathname.startsWith('/articles') || location.pathname.startsWith('/logistique')}
        >
          <SidebarSubLink to="/envois-ctn" label="Envois CTN" />
          <SidebarSubLink to="/articles" label="Articles" />
          <SidebarSubLink to="/logistique/grenoble" label="Grenoble" />
        </SidebarMenu>
        
        {/* Menu Commercial */}
        <SidebarMenu
          label="Commercial"
          icon={<FaUpload />}
          open={!!openMenus['commercial']}
          onClick={() => toggleMenu('commercial')}
          active={location.pathname.startsWith('/commercial')}
        >
          <SidebarSubLink to="/commercial/upload" label="Upload" />
          <SidebarSubLink to="/commercial/tickets-sap-create" label="Tickets SAP" />
        </SidebarMenu>

        {/* Lien Admin */}
        {isAdmin && (
          <SidebarLink to="/admin" icon={<FaCog />} label="Admin" active={location.pathname.startsWith('/admin')} />
        )}
      </nav>

      {/* Section inférieure de la Sidebar (ex: Déconnexion, liens ressources) */}
      {user && (
        <div className="p-4 border-t border-white/20 mt-auto">
          <Form method="post" action="/logout">
            <button
              type="submit"
              className={`${baseLinkStyle} w-full ${inactiveLinkStyle}`}
            >
              <FaSignOutAlt className="mr-3" />
              Déconnexion
            </button>
          </Form>
        </div>
      )}
    </aside>
  );
};

// MobileNavBar a été supprimée de ce fichier.
// L'export par défaut est retiré car Sidebar est le seul composant principal exporté.

import React, { useState } from 'react';
import { Link, useLocation, Form } from '@remix-run/react';
import { FaTachometerAlt, FaTicketAlt, FaFileAlt, FaTruck, FaSignOutAlt, FaCogs, FaSearch, FaUserCircle, FaChevronDown, FaChevronUp, FaBoxOpen, FaBuilding, FaUpload } from 'react-icons/fa';
import { WeatherWidget } from './WeatherWidget';
import { NotificationsDropdown } from './NotificationsDropdown';
import type { UserSession } from '~/services/session.server';
import type { UserProfile } from '~/types/firestore.types';

interface SidebarProps {
  user: UserSession | null;
  profile: UserProfile | null;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ user, profile, isOpen = true, onClose }) => {
  const location = useLocation();
  const isAdmin = profile?.role === 'Admin';
  const secteurs = isAdmin ? ['CHR', 'Tabac', 'HACCP', 'Kezia'] : (profile?.secteurs || []);
  const [openMenus, setOpenMenus] = useState<{ [key: string]: boolean }>({});

  const toggleMenu = (key: string) => setOpenMenus(m => ({ ...m, [key]: !m[key] }));

  return (
    <aside
      className={`
        fixed top-0 left-0 h-full z-40
        bg-gradient-to-br from-jdc-blue/80 via-gray-900/90 to-jdc-yellow-900/60
        bg-opacity-80 backdrop-blur-2xl shadow-2xl border-r border-white/20
        flex flex-col justify-between
        w-20 md:w-72
        transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
        hidden md:flex
      `}
      style={{ boxShadow: '0 12px 32px 0 rgba(31, 38, 135, 0.18)' }}
    >
      {/* Logo, recherche, notifications, profil */}
      <div>
        <div className="flex flex-col items-center md:items-stretch gap-4 py-6 px-2">
          <Link to="/dashboard" className="flex justify-center mb-2">
            <img src="https://www.jdc.fr/images/logo_jdc_blanc.svg" alt="JDC" className="h-12 w-auto drop-shadow-xl hover:scale-105 transition-transform duration-200" />
          </Link>
          <div className="h-1 w-2/3 mx-auto bg-gradient-to-r from-jdc-yellow/40 via-white/10 to-jdc-blue/40 rounded-full mb-2" />
          {/* Recherche globale */}
          <div className="hidden md:flex items-center relative mb-2">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-jdc-yellow-300 w-5 h-5" />
            <input
              type="search"
              placeholder="Rechercher..."
              className="bg-white/20 text-jdc-gray-100 text-sm rounded-full pl-10 pr-4 py-2 w-full focus:w-56 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-jdc-yellow/50 placeholder-jdc-gray-400 shadow"
              aria-label="Barre de recherche"
              role="searchbox"
            />
          </div>
          {/* Notifications */}
          {user && (
            <div className="flex justify-center mb-2">
              <NotificationsDropdown
                notifications={[]}
                notificationCount={2}
                onMarkAllAsRead={() => {}}
                onMarkAsRead={() => {}}
                onClearAll={() => {}}
              />
            </div>
          )}
          {/* Profil utilisateur */}
          {user && profile && (
            <div className="flex flex-col items-center md:items-start gap-1 mb-2">
              <FaUserCircle className="w-10 h-10 text-jdc-yellow-200 drop-shadow-lg" />
              <span className="font-bold text-white text-base truncate w-full text-center md:text-left drop-shadow">{profile.displayName || user.displayName || user.email}</span>
              <span className="text-xs text-jdc-yellow-200 font-bold uppercase tracking-wide">{profile.role}</span>
              {profile.secteurs && profile.secteurs.length > 0 && (
                <span className="text-xs text-jdc-gray-200 font-medium truncate w-full">{profile.secteurs.join(', ')}</span>
              )}
              <Link to="/user-profile" className="mt-1 text-xs text-jdc-blue underline hover:text-jdc-yellow">Mon profil</Link>
            </div>
          )}
          <div className="h-1 w-2/3 mx-auto bg-gradient-to-r from-jdc-yellow/40 via-white/10 to-jdc-blue/40 rounded-full my-2" />
          {/* Météo (optionnel) */}
          <div className="hidden md:block mb-2">
            <WeatherWidget city="Paris" />
          </div>
        </div>
        {/* Navigation principale enrichie */}
        <nav className="flex flex-col gap-2 mt-2 px-2">
          <SidebarLink to="/dashboard" icon={<FaTachometerAlt />} label="Dashboard" active={location.pathname.startsWith('/dashboard')} />
          <SidebarLink to="/tickets-sap" icon={<FaTicketAlt />} label="Tickets SAP" active={location.pathname.startsWith('/tickets-sap')} />
          {/* Installations sous-menu */}
          <SidebarMenu
            label="Installations"
            icon={<FaBuilding />}
            open={openMenus['installations']}
            onClick={() => toggleMenu('installations')}
            active={location.pathname.startsWith('/installations')}
          >
            {secteurs.includes('CHR') && <SidebarSubLink to="/installations/chr-firestore" label="CHR" />}
            {secteurs.includes('Tabac') && <SidebarSubLink to="/installations/tabac-firestore" label="Tabac" />}
            {secteurs.includes('HACCP') && <SidebarSubLink to="/installations/haccp" label="HACCP" />}
            {secteurs.includes('Kezia') && <SidebarSubLink to="/installations/kezia-firestore" label="Kezia" />}
          </SidebarMenu>
          {/* Logistique sous-menu */}
          <SidebarMenu
            label="Logistique"
            icon={<FaTruck />}
            open={openMenus['logistique']}
            onClick={() => toggleMenu('logistique')}
            active={location.pathname.startsWith('/envois-ctn') || location.pathname.startsWith('/articles')}
          >
            <SidebarSubLink to="/envois-ctn" label="Envois CTN" />
            <SidebarSubLink to="/articles" label="Articles" />
            <SidebarSubLink to="/logistique/grenoble" label="Grenoble" />
          </SidebarMenu>
          {/* Commercial sous-menu */}
          <SidebarMenu
            label="Commercial"
            icon={<FaUpload />}
            open={openMenus['commercial']}
            onClick={() => toggleMenu('commercial')}
            active={location.pathname.startsWith('/commercial')}
          >
            <SidebarSubLink to="/commercial/upload" label="Upload" />
          </SidebarMenu>
          {/* Admin */}
          {isAdmin && (
            <SidebarLink to="/admin" icon={<FaCogs />} label="Admin" active={location.pathname.startsWith('/admin')} />
          )}
        </nav>
      </div>
      {/* Déconnexion en bas (mobile uniquement) */}
      <div className="mb-6 px-4 md:hidden">
        {user && profile && (
          <div className="flex flex-col items-center gap-2">
            <Form method="post" action="/logout" className="w-full">
              <button
                type="submit"
                className="flex items-center gap-2 w-full justify-center mt-2 px-3 py-2 rounded-lg bg-red-600/80 text-white font-bold hover:bg-red-700 transition"
              >
                <FaSignOutAlt /> <span>Déconnexion</span>
              </button>
            </Form>
          </div>
        )}
      </div>
      {/* Overlay mobile */}
      {onClose && isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 z-30 md:hidden"
          onClick={onClose}
          aria-label="Fermer la navigation"
        />
      )}
    </aside>
  );
};

// Barre de navigation mobile en bas (à inclure dans le layout principal)
export const MobileNavBar = ({ profile }: { profile: UserProfile | null }) => {
  const location = useLocation();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const isAdmin = profile?.role === 'Admin';
  const secteurs = isAdmin ? ['CHR', 'Tabac', 'HACCP', 'Kezia'] : (profile?.secteurs || []);
  const handleMenu = (menu: string) => setOpenMenu(openMenu === menu ? null : menu);
  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 bg-gradient-to-t from-jdc-blue/90 via-gray-900/95 to-jdc-yellow-900/80 backdrop-blur-xl shadow-2xl border-t border-jdc-yellow/20 flex justify-around items-center py-2 md:hidden">
      <Link to="/dashboard" className={`flex flex-col items-center text-xs font-bold ${location.pathname.startsWith('/dashboard') ? 'text-jdc-yellow' : 'text-white hover:text-jdc-yellow'}`}> <FaTachometerAlt className="text-lg mb-1" />Dashboard</Link>
      <Link to="/tickets-sap" className={`flex flex-col items-center text-xs font-bold ${location.pathname.startsWith('/tickets-sap') ? 'text-jdc-yellow' : 'text-white hover:text-jdc-yellow'}`}> <FaTicketAlt className="text-lg mb-1" />SAP</Link>
      {/* Installations menu */}
      <button onClick={() => handleMenu('installations')} className={`flex flex-col items-center text-xs font-bold focus:outline-none ${openMenu === 'installations' || location.pathname.startsWith('/installations') ? 'text-jdc-yellow' : 'text-white hover:text-jdc-yellow'}`}> <FaBuilding className="text-lg mb-1" />Install</button>
      {/* Logistique menu */}
      <button onClick={() => handleMenu('logistique')} className={`flex flex-col items-center text-xs font-bold focus:outline-none ${openMenu === 'logistique' || location.pathname.startsWith('/envois-ctn') || location.pathname.startsWith('/articles') ? 'text-jdc-yellow' : 'text-white hover:text-jdc-yellow'}`}> <FaTruck className="text-lg mb-1" />Logistique</button>
      {/* Commercial menu */}
      <button onClick={() => handleMenu('commercial')} className={`flex flex-col items-center text-xs font-bold focus:outline-none ${openMenu === 'commercial' || location.pathname.startsWith('/commercial') ? 'text-jdc-yellow' : 'text-white hover:text-jdc-yellow'}`}> <FaUpload className="text-lg mb-1" />Commercial</button>
      {/* Admin */}
      {isAdmin && (
        <Link to="/admin" className={`flex flex-col items-center text-xs font-bold ${location.pathname.startsWith('/admin') ? 'text-jdc-yellow' : 'text-white hover:text-jdc-yellow'}`}> <FaCogs className="text-lg mb-1" />Admin</Link>
      )}
      {/* Sous-menus déroulants */}
      {openMenu === 'installations' && (
        <div className="absolute bottom-14 left-0 w-full bg-jdc-blue/95 border-t border-jdc-yellow/20 shadow-xl rounded-t-2xl flex flex-col animate-fade-in-up z-50">
          {secteurs.includes('CHR') && <Link to="/installations/chr-firestore" className="py-3 text-center text-jdc-yellow font-bold border-b border-jdc-yellow/10" onClick={() => setOpenMenu(null)}>CHR</Link>}
          {secteurs.includes('Tabac') && <Link to="/installations/tabac-firestore" className="py-3 text-center text-jdc-yellow font-bold border-b border-jdc-yellow/10" onClick={() => setOpenMenu(null)}>Tabac</Link>}
          {secteurs.includes('HACCP') && <Link to="/installations/haccp" className="py-3 text-center text-jdc-yellow font-bold border-b border-jdc-yellow/10" onClick={() => setOpenMenu(null)}>HACCP</Link>}
          {secteurs.includes('Kezia') && <Link to="/installations/kezia-firestore" className="py-3 text-center text-jdc-yellow font-bold" onClick={() => setOpenMenu(null)}>Kezia</Link>}
        </div>
      )}
      {openMenu === 'logistique' && (
        <div className="absolute bottom-14 left-0 w-full bg-jdc-blue/95 border-t border-jdc-yellow/20 shadow-xl rounded-t-2xl flex flex-col animate-fade-in-up z-50">
          <Link to="/envois-ctn" className="py-3 text-center text-jdc-yellow font-bold border-b border-jdc-yellow/10" onClick={() => setOpenMenu(null)}>Envois CTN</Link>
          <Link to="/articles" className="py-3 text-center text-jdc-yellow font-bold border-b border-jdc-yellow/10" onClick={() => setOpenMenu(null)}>Articles</Link>
          <Link to="/logistique/grenoble" className="py-3 text-center text-jdc-yellow font-bold" onClick={() => setOpenMenu(null)}>Grenoble</Link>
        </div>
      )}
      {openMenu === 'commercial' && (
        <div className="absolute bottom-14 left-0 w-full bg-jdc-blue/95 border-t border-jdc-yellow/20 shadow-xl rounded-t-2xl flex flex-col animate-fade-in-up z-50">
          <Link to="/commercial/upload" className="py-3 text-center text-jdc-yellow font-bold" onClick={() => setOpenMenu(null)}>Upload</Link>
        </div>
      )}
    </nav>
  );
};

// Lien principal stylé
const SidebarLink = ({ to, icon, label, active }: { to: string; icon: React.ReactNode; label: string; active?: boolean }) => (
  <Link
    to={to}
    className={`flex items-center gap-4 px-5 py-3 rounded-xl font-semibold text-base transition-all duration-200 shadow-sm
      ${active ? 'bg-jdc-yellow/90 text-gray-900 shadow-yellow-400/30 scale-105 ring-2 ring-jdc-yellow/60' : 'text-white hover:bg-jdc-yellow/70 hover:text-gray-900 hover:scale-105'}
      group relative overflow-hidden`}
    style={{ boxShadow: active ? '0 0 12px 2px #facc15aa' : undefined }}
  >
    <span className={`text-2xl drop-shadow-lg ${active ? 'text-jdc-yellow' : 'text-jdc-blue group-hover:text-jdc-yellow'}`}>{icon}</span>
    <span className="hidden md:inline font-bold tracking-wide">{label}</span>
    {active && <span className="absolute right-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-jdc-yellow animate-pulse" />}
  </Link>
);

// Sous-menu stylé
const SidebarMenu = ({ label, icon, open, onClick, active, children }: { label: string; icon: React.ReactNode; open: boolean; onClick: () => void; active?: boolean; children: React.ReactNode }) => (
  <div className="w-full">
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-4 px-5 py-3 rounded-xl font-semibold text-base transition-all duration-200 w-full shadow-sm
        ${active ? 'bg-jdc-yellow/20 text-jdc-yellow' : 'text-white hover:bg-jdc-yellow/30 hover:text-jdc-yellow'}
        group relative overflow-hidden`}
    >
      <span className={`text-2xl drop-shadow-lg ${active ? 'text-jdc-yellow' : 'text-jdc-blue group-hover:text-jdc-yellow'}`}>{icon}</span>
      <span className="hidden md:inline font-bold tracking-wide">{label}</span>
      {open ? <FaChevronUp className="ml-auto" /> : <FaChevronDown className="ml-auto" />}
    </button>
    <div className={`transition-all duration-300 overflow-hidden ${open ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'} pl-2`}>{open && <div className="ml-4 flex flex-col gap-1 mb-2">{children}</div>}</div>
  </div>
);

// Lien de sous-menu stylé
const SidebarSubLink = ({ to, label }: { to: string; label: string }) => {
  const location = useLocation();
  const active = location.pathname.startsWith(to);
  return (
    <Link
      to={to}
      className={`text-sm py-2 px-4 rounded-lg transition-all duration-200 font-semibold tracking-wide
        ${active ? 'bg-jdc-yellow/80 text-gray-900 shadow scale-105' : 'text-jdc-gray-200 hover:bg-jdc-yellow/20 hover:text-jdc-yellow'}
      `}
    >
      {label}
    </Link>
  );
};

export default Sidebar; 
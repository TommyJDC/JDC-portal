import { Fragment } from 'react';
import { Link, Form } from '@remix-run/react';
import { FaBars, FaUserCircle, FaChevronDown, FaGoogle } from 'react-icons/fa';
import { Button } from './ui/Button';
import { WeatherWidget } from './WeatherWidget';
import { NotificationsDropdown } from './NotificationsDropdown';
import type { UserSession } from '~/services/session.server';
import type { UserProfile } from '~/types/firestore.types';

interface HeaderProps {
  user: UserSession | null;
  profile: UserProfile | null;
  onToggleMobileMenu: () => void;
  onLoginClick: () => void;
  loadingAuth: boolean;
}

export const Header: React.FC<HeaderProps> = ({ user, profile, onToggleMobileMenu, onLoginClick, loadingAuth }) => {
  return (
    <header className="fixed left-0 top-0 w-full backdrop-blur-md bg-gradient-to-br from-jdc-blue/80 via-gray-900/90 to-jdc-yellow-900/60 shadow-2xl border-b border-jdc-yellow/30 z-50 animate-fade-in-up">
      <div className="flex justify-between items-center w-full px-4 gap-6 py-2">
        {/* Logo et météo */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden text-jdc-yellow-200 hover:text-white bg-white/10 rounded-full p-2 shadow focus:outline-none focus:ring-2 focus:ring-jdc-yellow"
            aria-label="Menu mobile"
            aria-expanded="false"
          >
            <FaBars className="w-6 h-6" />
          </button>
          <Link to={user ? "/dashboard" : "/"} className="flex-shrink-0 group">
            <img 
              src="https://www.jdc.fr/images/logo_jdc_blanc.svg" 
              alt="JDC Logo" 
              className="h-12 w-auto drop-shadow-xl group-hover:scale-105 transition-transform duration-200"
              width={160}
              height={40}
            />
          </Link>
          <div className="hidden md:block ml-4">
            <WeatherWidget city="Paris" />
          </div>
        </div>
        {/* Recherche globale */}
        <div className="hidden lg:flex items-center relative flex-1 justify-center">
          <input
            type="search"
            placeholder="Rechercher..."
            className="bg-white/10 text-jdc-gray-100 text-sm rounded-full pl-10 pr-4 py-2 w-64 focus:w-80 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-jdc-yellow/50 placeholder-jdc-gray-400 shadow"
            aria-label="Barre de recherche"
            role="searchbox"
          />
        </div>
        {/* Notifications et profil */}
        <div className="flex items-center space-x-4">
          {user && (
            <NotificationsDropdown
              notifications={[]}
              notificationCount={0}
              onMarkAllAsRead={() => {}}
              onMarkAsRead={() => {}}
              onClearAll={() => {}}
            />
          )}
          {loadingAuth ? (
            <div className="h-8 w-20 bg-jdc-gray-700 rounded animate-pulse"></div>
          ) : user ? (
            <div className="flex items-center space-x-2">
              <FaUserCircle className="w-7 h-7 text-jdc-yellow-200" />
              <span className="hidden sm:inline font-bold">
                {profile?.displayName || user.displayName || user.email?.split('@')[0] || 'Utilisateur'}
              </span>
              <FaChevronDown className="hidden sm:inline h-4 w-4" />
            </div>
          ) : (
            <Form method="post" action="/auth/google">
              <Button type="submit" variant="secondary" size="sm" leftIcon={<FaGoogle />}>Google</Button>
            </Form>
          )}
        </div>
      </div>
    </header>
  );
};
